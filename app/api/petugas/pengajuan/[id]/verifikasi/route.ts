import { NextResponse, type NextRequest } from "next/server";
import { jsPDF } from "jspdf";
import { getAdminSession, isPetugas } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { normalizeWorkflowRole } from "@/services/verification-workflow";

type StageRow = { id: string; pengajuan_id: string; tahap: number; nama_tahap: string; role_petugas: string; status: string };
type SupabaseError = { message?: string; details?: string; hint?: string; code?: string };
type PengajuanRow = Record<string, unknown>;
type DocumentRow = { id: string; status?: string | null; metadata?: Record<string, unknown> | null };
type DraftVerificationMeta = { draft_verification?: Record<string, { result?: string }> };

const NEXT_STAGE_LABEL: Record<number, string> = { 1: "Petugas Lapangan", 2: "Kepala Seksi", 3: "Seklur", 4: "Lurah" };
const CURRENT_STAGE_LABEL: Record<number, string> = { 1: "Staff Pelayanan", 2: "Petugas Lapangan", 3: "Kepala Seksi", 4: "Seklur", 5: "Lurah" };
const DRAFT_ROLE_STATUSES: Record<string, string> = { staff_pelayanan: "DRAFT_DIVERIFIKASI_STAFF", petugas_lapangan: "DRAFT_DIVERIFIKASI_LAPANGAN", kepala_seksi: "DRAFT_DIVERIFIKASI_KASI", seklur: "DRAFT_DIVERIFIKASI_SEKLUR", lurah: "SIGNED" };
const REQUIRED_DRAFT_ROLES = ["staff_pelayanan", "petugas_lapangan", "kepala_seksi", "seklur"];

function jsonError(message: string, status = 400) { return NextResponse.json({ ok: false, error: message }, { status }); }
function publicSaveError() { return jsonError("Data belum dapat disimpan. Silakan coba lagi.", 500); }
function logError(error: SupabaseError | null | undefined) {
    console.error("[VERIFIKASI_PENGAJUAN]", {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint
    });
}
function logQueryError(operation: string, error: SupabaseError | null) {
    if (!error) return;
    console.error("[VERIFIKASI_PENGAJUAN] QUERY ERROR", {
        operation,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
    });
}
function trackingMessage(stage: StageRow) { return stage.tahap === 5 ? "Pengajuan telah divalidasi Lurah dan surat diterbitkan." : `Pengajuan telah diverifikasi ${CURRENT_STAGE_LABEL[stage.tahap] ?? stage.nama_tahap} dan diteruskan ke ${NEXT_STAGE_LABEL[stage.tahap] ?? "tahap berikutnya"}.`; }
function safeNik(nik?: string | null) { const raw = String(nik ?? ""); return raw.length > 6 ? `${raw.slice(0, 4)}********${raw.slice(-4)}` : "-"; }
function pickName(row: PengajuanRow) { return row.nama_pemohon ?? row.nama_lengkap ?? row.nama ?? "-"; }
function pickLayanan(row: PengajuanRow) { const layanan = row.layanan; const item = Array.isArray(layanan) ? layanan[0] : layanan; return typeof item === "object" && item !== null && "nama" in item ? item.nama : row.jenis_surat ?? "Surat Keterangan"; }
function latestDraft(docs: DocumentRow[] = []) { return docs.find((d) => ["DRAFT", "DRAFT_DIVERIFIKASI_STAFF", "DRAFT_DIVERIFIKASI_LAPANGAN", "DRAFT_DIVERIFIKASI_KASI", "DRAFT_DIVERIFIKASI_SEKLUR", "SIAP_TTD", "SIGNED"].includes(String(d.status)) && d.metadata?.active !== false) ?? null; }
function draftOk(meta: DraftVerificationMeta = {}) { return REQUIRED_DRAFT_ROLES.every((role) => meta.draft_verification?.[role]?.result === "SESUAI"); }
function finalPdf(row: PengajuanRow, token: string, version: number, petugasName: string) {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text("PEMERINTAH KOTA CILEGON", 105, 18, { align: "center" }); doc.text("KELURAHAN TAMANSARI", 105, 28, { align: "center" }); doc.line(20, 38, 190, 38);
    doc.setFontSize(13); doc.text(String(pickLayanan(row)).toUpperCase(), 105, 54, { align: "center" }); doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    [["Nomor Pengajuan", row.nomor_pengajuan ?? row.id], ["Nama", pickName(row)], ["NIK", safeNik(typeof row.nik === "string" ? row.nik : null)], ["Alamat", row.alamat], ["Jenis Layanan", pickLayanan(row)]].forEach(([k, v], i) => { const y = 78 + i * 10; doc.text(String(k), 25, y); doc.text(":", 65, y); doc.text(String(v ?? "-"), 70, y, { maxWidth: 115 }); });
    doc.text("Dokumen ini telah diverifikasi berjenjang dan ditandatangani secara elektronik oleh Lurah.", 20, 145, { maxWidth: 170 }); doc.text(`Cilegon, ${new Date().toLocaleDateString("id-ID")}`, 140, 185); doc.text("Lurah Tamansari", 140, 198); doc.setFont("helvetica", "bold"); doc.text(petugasName, 140, 222);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(`Token validasi: ${token}`, 20, 270); doc.text(`Verifikasi: /verifikasi/${token}`, 20, 276); doc.text(`FINAL v${version} - QR/BARCODE: /verifikasi/${token}`, 20, 282);
    return Buffer.from(doc.output("arraybuffer"));
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        if (!id) return jsonError("Pengajuan tidak ditemukan.", 404);
        const session = await getAdminSession(request, { cookie: "petugas" });
        if (session.error || !session.profile) return jsonError("Sesi petugas tidak valid.", 401);
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
        if (pengajuanError) { logQueryError("SELECT pengajuan_surat", pengajuanError); throw pengajuanError; }
        if (!pengajuan) return jsonError("Pengajuan tidak ditemukan.", 404);
        if (String(pengajuan.status).toLowerCase() === "selesai") return jsonError("Pengajuan sudah selesai.", 409);

        const { data: stages, error: stageError } = await supabase.from("verifikasi_pengajuan").select("id,pengajuan_id,tahap,nama_tahap,role_petugas,status").eq("pengajuan_id", id).order("tahap", { ascending: true });
        if (stageError) { logQueryError("SELECT verifikasi_pengajuan", stageError); throw stageError; }
        const orderedStages = (stages ?? []) as StageRow[];
        const activeStage = orderedStages.find((stage) => stage.status === "Diproses");
        if (!activeStage) return jsonError("Tidak ada tahap aktif yang dapat diproses.", 409);
        if (activeStage.role_petugas !== workflowRole) return jsonError(`Tahap aktif adalah ${activeStage.nama_tahap}; akun ini tidak berwenang memproses tahap tersebut.`, 403);

        const { data: suratDocs, error: suratDocsError } = await supabase.from("dokumen_pengajuan").select("*").eq("pengajuan_id", id).ilike("jenis", "%Surat Hasil Pelayanan%").order("created_at", { ascending: false });
        if (suratDocsError) { logQueryError("SELECT dokumen_pengajuan surat", suratDocsError); throw suratDocsError; }
        const activeSurat = latestDraft((suratDocs ?? []) as DocumentRow[]);

        if (body?.action === "revisi" || body?.action === "tolak") {
            if (!body.catatan?.trim()) return jsonError("Alasan wajib diisi.");
            const { error: currentError } = await supabase.from("verifikasi_pengajuan").update({ status: body.action === "tolak" ? "Ditolak" : "Menunggu", catatan, petugas_id: petugasId, acted_at: now, updated_at: now }).eq("id", activeStage.id);
            if (currentError) { logQueryError("UPDATE verifikasi_pengajuan revisi/tolak", currentError); throw currentError; }
            const { error: staffError } = await supabase.from("verifikasi_pengajuan").update({ status: "Diproses", updated_at: now }).eq("pengajuan_id", id).eq("role_petugas", "staff_pelayanan");
            if (staffError) { logQueryError("UPDATE verifikasi_pengajuan staff active", staffError); throw staffError; }
            if (activeSurat) {
                const { error: returnedError } = await supabase.from("dokumen_pengajuan").update({ status: "DIKEMBALIKAN", metadata: { ...(activeSurat.metadata ?? {}), active: false, returned_at: now, returned_by: petugasId, return_reason: catatan } }).eq("id", activeSurat.id);
                if (returnedError) { logQueryError("UPDATE dokumen_pengajuan dikembalikan", returnedError); throw returnedError; }
            }
            const { error: trackingError } = await supabase.from("tracking_pengajuan").insert({ pengajuan_id: id, status: body.action === "tolak" ? "Ditolak" : "Dikembalikan", keterangan: catatan, created_at: now });
            if (trackingError) { logQueryError("INSERT tracking_pengajuan revisi/tolak", trackingError); throw trackingError; }
            return NextResponse.json({ ok: true });
        }

        if (activeStage.tahap > 1 && !activeSurat) return jsonError("Draft surat hasil pelayanan belum tersedia.", 409);

        if (activeSurat && !["simpan", "revisi", "tolak"].includes(String(body?.action ?? ""))) {
            const meta = activeSurat.metadata ?? {};
            const draftVerification = { ...(meta.draft_verification ?? {}), [workflowRole]: { result: "SESUAI", petugas_id: petugasId, petugas: petugasName, acted_at: now, catatan, tahap: activeStage.tahap } };
            const nextDraftStatus = workflowRole === "lurah" ? "SIGNED" : (workflowRole === "seklur" && draftOk({ draft_verification: draftVerification }) ? "SIAP_TTD" : DRAFT_ROLE_STATUSES[workflowRole] ?? activeSurat.status);
            if (workflowRole === "lurah" && !draftOk({ draft_verification: draftVerification })) return jsonError("Surat belum disetujui semua tahap sebelum TTD Lurah.", 409);
            const { error: draftUpdateError } = await supabase.from("dokumen_pengajuan").update({ status: nextDraftStatus, metadata: { ...meta, draft_verification: draftVerification, status_updated_at: now } }).eq("id", activeSurat.id);
            if (draftUpdateError) { logQueryError("UPDATE dokumen_pengajuan draft", draftUpdateError); throw draftUpdateError; }
        }

        if (body?.action === "simpan") {
            const { data: savedStage, error: saveStageError } = await supabase
                .from("verifikasi_pengajuan")
                .update({
                    petugas_id: petugasId,
                    user_id: petugasId,
                    nama_petugas: petugasName,
                    jabatan: activeStage.nama_tahap,
                    catatan,
                    hasil_verifikasi: "Data dan dokumen dinyatakan lengkap.",
                    updated_at: now
                })
                .eq("id", activeStage.id)
                .select("id")
                .maybeSingle();
            if (saveStageError) { logQueryError("UPDATE verifikasi_pengajuan simpan", saveStageError); throw saveStageError; }
            if (!savedStage) {
                console.error("[VERIFIKASI_PENGAJUAN] SIMPAN TANPA ROW", { pengajuan_id: id, stage_id: activeStage.id, role_petugas: workflowRole });
                return publicSaveError();
            }

            const { error: savePengajuanError } = await supabase
                .from("pengajuan_surat")
                .update({ workflow_status: activeStage.nama_tahap, updated_at: now })
                .eq("id", id);
            if (savePengajuanError) { logQueryError("UPDATE pengajuan_surat simpan", savePengajuanError); throw savePengajuanError; }

            const { error: saveTrackingError } = await supabase
                .from("tracking_pengajuan")
                .insert({ pengajuan_id: id, status: "Diproses", keterangan: `Pengajuan sudah diperiksa ${CURRENT_STAGE_LABEL[activeStage.tahap] ?? activeStage.nama_tahap}.`, created_at: now });
            if (saveTrackingError) { logQueryError("INSERT tracking_pengajuan simpan", saveTrackingError); throw saveTrackingError; }

            return NextResponse.json({ ok: true });
        }

        const nextStage = orderedStages.find((stage) => stage.tahap === activeStage.tahap + 1) ?? null;
        const { data: updatedStage, error: updateStageError } = await supabase
            .from("verifikasi_pengajuan")
            .update({ status: "Disetujui", petugas_id: petugasId, catatan, acted_at: now })
            .eq("id", activeStage.id)
            .eq("status", "Diproses")
            .select("*")
            .single();
        if (updateStageError) { logQueryError("UPDATE verifikasi_pengajuan active", updateStageError); throw updateStageError; }

        if (nextStage) {
            const { error: nextError } = await supabase.from("verifikasi_pengajuan").update({ status: "Diproses", updated_at: now }).eq("id", nextStage.id).eq("status", "Menunggu");
            if (nextError) { logQueryError("UPDATE verifikasi_pengajuan next", nextError); throw nextError; }
        }

        let finalInfo: Record<string, string> = {};
        if (activeStage.tahap === 5 && activeSurat) {
            if (!draftOk(activeSurat.metadata ?? {})) return jsonError("Surat belum disetujui semua tahap sebelum TTD Lurah.", 409);
            const { data: fullPengajuan, error: fullPengajuanError } = await supabase.from("pengajuan_surat").select("*, layanan(*)").eq("id", id).maybeSingle();
            if (fullPengajuanError) { logQueryError("SELECT pengajuan_surat final", fullPengajuanError); throw fullPengajuanError; }
            const token = crypto.randomUUID().replace(/-/g, "");
            const version = Number(activeSurat.metadata?.version ?? 1);
            const path = `surat-hasil-pelayanan/${id}/final-v${version}-${Date.now()}.pdf`;
            const { error: uploadError } = await supabase.storage.from("surat").upload(path, finalPdf(fullPengajuan ?? {}, token, version, petugasName), { contentType: "application/pdf", upsert: false });
            if (uploadError) { logQueryError("UPLOAD surat final", uploadError); throw uploadError; }
            const { error: finalDocError } = await supabase.from("dokumen_pengajuan").update({ status: "TERBIT", metadata: { ...(activeSurat.metadata ?? {}), active: false, final_path: path, token, qr_url: `/verifikasi/${token}`, signed_at: now, signed_by: petugasId } }).eq("id", activeSurat.id);
            if (finalDocError) { logQueryError("UPDATE dokumen_pengajuan final", finalDocError); throw finalDocError; }
            finalInfo = { verification_token: token, verification_url: `/verifikasi/${token}`, final_pdf_url: path };
        }
        const pengajuanUpdate = activeStage.tahap === 5
            ? { status: "Selesai", workflow_status: "Selesai", validated_at: now, validated_by: petugasId, updated_at: now, ...finalInfo }
            : { status: "Diproses", workflow_status: nextStage?.nama_tahap ?? "Diproses", validated_at: now, validated_by: petugasId, updated_at: now };
        const { data: updatedPengajuan, error: updatePengajuanError } = await supabase.from("pengajuan_surat").update(pengajuanUpdate).eq("id", id).select("*").single();
        if (updatePengajuanError) { logQueryError("UPDATE pengajuan_surat", updatePengajuanError); throw updatePengajuanError; }

        const { error: trackingError } = await supabase.from("tracking_pengajuan").insert({ pengajuan_id: id, status: activeStage.tahap === 5 ? "Selesai" : "Diproses", keterangan: trackingMessage(activeStage), created_at: now });
        if (trackingError) { logQueryError("INSERT tracking_pengajuan lanjutkan tahap", trackingError); throw trackingError; }

        return NextResponse.json({ ok: true, data: updatedPengajuan, verifikasi: updatedStage });
    } catch (error) {
        logError(error as SupabaseError);
        return publicSaveError();
    }
}