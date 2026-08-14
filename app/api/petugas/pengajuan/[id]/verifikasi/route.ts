import { NextResponse, type NextRequest } from "next/server";
import { jsPDF } from "jspdf";
import { getAdminSession, isPetugas } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { normalizeWorkflowRole } from "@/services/verification-workflow";

type StageRow = { id: string; pengajuan_id: string; tahap: number; nama_tahap: string; role_petugas: string; status: string };
type AuditPayload = { pengajuan_id: string; status: string; catatan: string; created_at: string };

const NEXT_STAGE_LABEL: Record<number, string> = { 1: "Petugas Lapangan", 2: "Kepala Seksi", 3: "Seklur", 4: "Lurah" };
const CURRENT_STAGE_LABEL: Record<number, string> = { 1: "Staff Pelayanan", 2: "Petugas Lapangan", 3: "Kepala Seksi", 4: "Seklur", 5: "Lurah" };
const DRAFT_ROLE_STATUSES: Record<string, string> = { staff_pelayanan: "DRAFT_DIVERIFIKASI_STAFF", petugas_lapangan: "DRAFT_DIVERIFIKASI_LAPANGAN", kepala_seksi: "DRAFT_DIVERIFIKASI_KASI", seklur: "DRAFT_DIVERIFIKASI_SEKLUR", lurah: "SIGNED" };
const REQUIRED_DRAFT_ROLES = ["staff_pelayanan", "petugas_lapangan", "kepala_seksi", "seklur"];

function jsonError(message: string, status = 400) { return NextResponse.json({ ok: false, error: message }, { status }); }
function publicSaveError() { return jsonError("Data belum dapat disimpan. Silakan coba lagi.", 500); }
async function writeAudit(supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, payload: AuditPayload) {
    const { error } = await supabase.from("audit_pengajuan").insert(payload);
    if (error) console.error("Audit pengajuan gagal disimpan:", error.message);
}
function encodeInspection(pemeriksaan: unknown, fallback: string) { return JSON.stringify({ pemeriksaan: pemeriksaan ?? null, catatan: fallback }); }
function trackingMessage(stage: StageRow) { return stage.tahap === 5 ? "Pengajuan telah divalidasi Lurah dan surat diterbitkan." : `Pengajuan telah diverifikasi ${CURRENT_STAGE_LABEL[stage.tahap] ?? stage.nama_tahap} dan diteruskan ke ${NEXT_STAGE_LABEL[stage.tahap] ?? "tahap berikutnya"}.`; }
function safeNik(nik?: string | null) { const raw = String(nik ?? ""); return raw.length > 6 ? `${raw.slice(0, 4)}********${raw.slice(-4)}` : "-"; }
function pickName(row: Record<string, any>) { return row.nama_pemohon ?? row.nama_lengkap ?? row.nama ?? "-"; }
function pickLayanan(row: Record<string, any>) { const l = Array.isArray(row.layanan) ? row.layanan[0] : row.layanan; return l?.nama ?? row.jenis_surat ?? "Surat Keterangan"; }
function latestDraft(docs: Record<string, any>[] = []) { return docs.find((d) => ["DRAFT", "DRAFT_DIVERIFIKASI_STAFF", "DRAFT_DIVERIFIKASI_LAPANGAN", "DRAFT_DIVERIFIKASI_KASI", "DRAFT_DIVERIFIKASI_SEKLUR", "SIAP_TTD", "SIGNED"].includes(String(d.status)) && d.metadata?.active !== false) ?? null; }
function draftOk(meta: Record<string, any> = {}) { return REQUIRED_DRAFT_ROLES.every((role) => meta?.draft_verification?.[role]?.result === "SESUAI"); }
function finalPdf(row: Record<string, any>, token: string, version: number, petugasName: string) {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text("PEMERINTAH KOTA CILEGON", 105, 18, { align: "center" }); doc.text("KELURAHAN TAMANSARI", 105, 28, { align: "center" }); doc.line(20, 38, 190, 38);
    doc.setFontSize(13); doc.text(String(pickLayanan(row)).toUpperCase(), 105, 54, { align: "center" }); doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    [["Nomor Pengajuan", row.nomor_pengajuan ?? row.id], ["Nama", pickName(row)], ["NIK", safeNik(row.nik)], ["Alamat", row.alamat], ["Jenis Layanan", pickLayanan(row)]].forEach(([k, v], i) => { const y = 78 + i * 10; doc.text(String(k), 25, y); doc.text(":", 65, y); doc.text(String(v ?? "-"), 70, y, { maxWidth: 115 }); });
    doc.text("Dokumen ini telah diverifikasi berjenjang dan ditandatangani secara elektronik oleh Lurah.", 20, 145, { maxWidth: 170 }); doc.text(`Cilegon, ${new Date().toLocaleDateString("id-ID")}`, 140, 185); doc.text("Lurah Tamansari", 140, 198); doc.setFont("helvetica", "bold"); doc.text(petugasName, 140, 222);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(`Token validasi: ${token}`, 20, 270); doc.text(`Verifikasi: /verifikasi/${token}`, 20, 276); doc.text(`FINAL v${version} - QR/BARCODE: /verifikasi/${token}`, 20, 282);
    return Buffer.from(doc.output("arraybuffer"));
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    const session = await getAdminSession(request, { cookie: "petugas" });
    if (session.error || !session.profile) return jsonError("Session petugas tidak valid.", 401);
    if (!isPetugas(session.profile)) return jsonError("Akses khusus petugas.", 403);
    if (session.profile.is_active === false) return jsonError("Akun petugas tidak aktif.", 403);

    const workflowRole = normalizeWorkflowRole(session.profile.role);
    if (!workflowRole) return jsonError("Role petugas tidak memiliki kewenangan workflow verifikasi.", 403);

    const body = await request.json().catch(() => null) as { action?: string; catatan?: string; pemeriksaan?: unknown } | null;
    const catatan = body?.catatan?.trim() || "Dokumen telah diverifikasi dan lengkap";
    const supabase = createSupabaseAdminClient();
    if (!supabase) return jsonError("Supabase service role belum dikonfigurasi.", 500);

    const now = new Date().toISOString();
    const petugasId = session.profile.id;
    const petugasName = session.profile.nama_lengkap ?? session.profile.username ?? "Petugas Kelurahan";

    const { data: pengajuan, error: pengajuanError } = await supabase.from("pengajuan_surat").select("id,status").eq("id", id).maybeSingle();
    if (pengajuanError) return jsonError(pengajuanError.message, 500);
    if (!pengajuan) return jsonError("Pengajuan tidak ditemukan.", 404);
    if (String(pengajuan.status).toLowerCase() === "selesai") return jsonError("Pengajuan sudah selesai.", 409);

    const { data: stages, error: stageError } = await supabase.from("verifikasi_pengajuan").select("id,pengajuan_id,tahap,nama_tahap,role_petugas,status").eq("pengajuan_id", id).order("tahap", { ascending: true });
    if (stageError) return jsonError(stageError.message, 500);
    const orderedStages = (stages ?? []) as StageRow[];
    const activeStage = orderedStages.find((stage) => stage.status === "Diproses");
    if (!activeStage) return jsonError("Tidak ada tahap aktif yang dapat diproses.", 409);
    if (activeStage.role_petugas !== workflowRole) return jsonError(`Tahap aktif adalah ${activeStage.nama_tahap}; akun ini tidak berwenang memproses tahap tersebut.`, 403);

    const { data: suratDocs } = await supabase.from("dokumen_pengajuan").select("*").eq("pengajuan_id", id).ilike("jenis", "%Surat Hasil Pelayanan%").order("created_at", { ascending: false });
    const activeSurat = latestDraft((suratDocs ?? []) as Record<string, any>[]);

    if (body?.action === "revisi" || body?.action === "tolak") {
        if (!body.catatan?.trim()) return jsonError("Alasan wajib diisi.");
        await supabase.from("verifikasi_pengajuan").update({ status: body.action === "tolak" ? "Ditolak" : "Menunggu", catatan, petugas_id: petugasId, acted_at: now }).eq("id", activeStage.id);
        await supabase.from("verifikasi_pengajuan").update({ status: "Diproses" }).eq("pengajuan_id", id).eq("role_petugas", "staff_pelayanan");
        if (activeSurat) await supabase.from("dokumen_pengajuan").update({ status: "DIKEMBALIKAN", metadata: { ...(activeSurat.metadata ?? {}), active: false, returned_at: now, returned_by: petugasId, return_reason: catatan } }).eq("id", activeSurat.id);
        await supabase.from("tracking_pengajuan").insert({ pengajuan_id: id, status: body.action === "tolak" ? "Ditolak" : "Dikembalikan", keterangan: catatan, petugas: petugasName, created_at: now });
        await writeAudit(supabase, { pengajuan_id: id, status: body.action === "tolak" ? "Ditolak" : "Dikembalikan", catatan, created_at: now });
        return NextResponse.json({ ok: true });
    }

    if (activeStage.tahap > 1 && !activeSurat) return jsonError("Draft surat hasil pelayanan belum tersedia.", 409);

    if (activeSurat && !["simpan", "revisi", "tolak"].includes(String(body?.action ?? ""))) {
        const meta = activeSurat.metadata ?? {};
        const draftVerification = { ...(meta.draft_verification ?? {}), [workflowRole]: { result: "SESUAI", petugas_id: petugasId, petugas: petugasName, acted_at: now, catatan, tahap: activeStage.tahap } };
        const nextDraftStatus = workflowRole === "lurah" ? "SIGNED" : (workflowRole === "seklur" && draftOk({ draft_verification: draftVerification }) ? "SIAP_TTD" : DRAFT_ROLE_STATUSES[workflowRole] ?? activeSurat.status);
        if (workflowRole === "lurah" && !draftOk({ draft_verification: draftVerification })) return jsonError("Surat belum disetujui semua tahap sebelum TTD Lurah.", 409);
        await supabase.from("dokumen_pengajuan").update({ status: nextDraftStatus, metadata: { ...meta, draft_verification: draftVerification, status_updated_at: now } }).eq("id", activeSurat.id);
        await writeAudit(supabase, { pengajuan_id: id, status: nextDraftStatus, catatan, created_at: now });
    }

    if (body?.action === "simpan") {
        const { error: checkError } = await supabase.from("verifikasi_pengajuan").update({ user_id: petugasId, petugas_id: petugasId, nama_petugas: petugasName, catatan, hasil_verifikasi: encodeInspection(body?.pemeriksaan, catatan), updated_at: now }).eq("id", activeStage.id).eq("status", "Diproses");
        if (checkError) { console.error("Pemeriksaan gagal disimpan:", checkError.message); return publicSaveError(); }
        await supabase.from("tracking_pengajuan").insert({ pengajuan_id: id, status: "Diproses", keterangan: "Pengajuan sudah diperiksa petugas pelayanan.", petugas: petugasName, created_at: now });
        await writeAudit(supabase, { pengajuan_id: id, status: "Draft", catatan, created_at: now });
        return NextResponse.json({ ok: true, saved: true });
    }

    const nextStage = orderedStages.find((stage) => stage.tahap === activeStage.tahap + 1) ?? null;
    const { data: updatedStage, error: updateStageError } = await supabase
        .from("verifikasi_pengajuan")
        .update({ status: "Disetujui", petugas_id: petugasId, catatan, acted_at: now })
        .eq("id", activeStage.id)
        .eq("status", "Diproses")
        .select("*")
        .single();
    if (updateStageError) { console.error("Workflow pemeriksaan gagal diperbarui:", updateStageError.message); return publicSaveError(); }

    if (nextStage) {
        const { error: nextError } = await supabase.from("verifikasi_pengajuan").update({ status: "Diproses" }).eq("id", nextStage.id).eq("status", "Menunggu");
        if (nextError) { console.error("Tahap berikutnya gagal diaktifkan:", nextError.message); return publicSaveError(); }
    }

    let finalInfo: Record<string, string> = {};
    if (activeStage.tahap === 5 && activeSurat) {
        if (!draftOk(activeSurat.metadata ?? {})) return jsonError("Surat belum disetujui semua tahap sebelum TTD Lurah.", 409);
        const { data: fullPengajuan } = await supabase.from("pengajuan_surat").select("*, layanan(*)").eq("id", id).maybeSingle();
        const token = crypto.randomUUID().replace(/-/g, "");
        const version = Number(activeSurat.metadata?.version ?? 1);
        const path = `surat-hasil-pelayanan/${id}/final-v${version}-${Date.now()}.pdf`;
        const { error: uploadError } = await supabase.storage.from("surat").upload(path, finalPdf(fullPengajuan ?? {}, token, version, petugasName), { contentType: "application/pdf", upsert: false });
        if (uploadError) return jsonError(uploadError.message, 500);
        await supabase.from("dokumen_pengajuan").update({ status: "TERBIT", metadata: { ...(activeSurat.metadata ?? {}), active: false, final_path: path, token, qr_url: `/verifikasi/${token}`, signed_at: now, signed_by: petugasId } }).eq("id", activeSurat.id);
        finalInfo = { verification_token: token, verification_url: `/verifikasi/${token}`, final_pdf_url: path };
    }
    const pengajuanUpdate = activeStage.tahap === 5
        ? { status: "Selesai", selesai_at: now, selesai_by: petugasId, updated_at: now, ...finalInfo }
        : { status: "Diproses", diproses_at: now, diproses_by: petugasId, updated_at: now };
    const { data: updatedPengajuan, error: updatePengajuanError } = await supabase.from("pengajuan_surat").update(pengajuanUpdate).eq("id", id).select("*").single();
    if (updatePengajuanError) { console.error("Status pengajuan gagal diperbarui:", updatePengajuanError.message); return publicSaveError(); }

    const { error: trackingError } = await supabase.from("tracking_pengajuan").insert({ pengajuan_id: id, status: activeStage.tahap === 5 ? "Selesai" : "Diproses", keterangan: trackingMessage(activeStage), petugas: petugasName, created_at: now });
    if (trackingError) { console.error("Tracking pengajuan gagal disimpan:", trackingError.message); return publicSaveError(); }

    await writeAudit(supabase, { pengajuan_id: id, status: "Disetujui", catatan, created_at: now });

    return NextResponse.json({ ok: true, data: updatedPengajuan, verifikasi: updatedStage });
}