import { NextResponse, type NextRequest } from "next/server";
import { jsPDF } from "jspdf";
import { getAdminSession, isPetugas } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { normalizeWorkflowRole } from "@/services/verification-workflow";

type AnyRow = Record<string, any>;
function jsonError(message: string, status = 400) { return NextResponse.json({ ok: false, error: message }, { status }); }
function pickName(row: AnyRow) { return row.nama_pemohon ?? row.nama_lengkap ?? row.nama ?? "-"; }
function pickLayanan(row: AnyRow) { const l = Array.isArray(row.layanan) ? row.layanan[0] : row.layanan; return l?.nama ?? row.jenis_surat ?? "Surat Keterangan"; }

function buildPdf(row: AnyRow, version: number) {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const layanan = pickLayanan(row);
    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text("PEMERINTAH KOTA CILEGON", 105, 18, { align: "center" });
    doc.text("KELURAHAN TAMANSARI", 105, 28, { align: "center" });
    doc.line(20, 38, 190, 38);
    doc.setFontSize(13); doc.text(String(layanan).toUpperCase(), 105, 54, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    doc.text(`Nomor Pengajuan: ${row.nomor_pengajuan ?? row.id}`, 20, 72);
    [["Nama", pickName(row)], ["NIK", row.nik], ["Alamat", row.alamat], ["Jenis Layanan", layanan], ["Keperluan", row.keperluan ?? row.keterangan ?? "-"]].forEach(([k, v], i) => {
        const y = 88 + i * 10; doc.text(String(k), 25, y); doc.text(":", 65, y); doc.text(String(v ?? "-"), 70, y, { maxWidth: 115 });
    });
    doc.text("Surat ini dibuat berdasarkan data pengajuan yang sedang dibuka dan dokumen pemohon yang telah diverifikasi Staff.", 20, 150, { maxWidth: 170 });
    doc.text(`Cilegon, ${new Date().toLocaleDateString("id-ID")}`, 140, 190);
    doc.text("Lurah Tamansari", 140, 202);
    doc.setFont("helvetica", "bold"); doc.text("(Menunggu TTD Lurah)", 140, 225);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(`DRAFT v${version} - surat-hasil-pelayanan.pdf`, 20, 282);
    return Buffer.from(doc.output("arraybuffer"));
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    const session = await getAdminSession(request, { cookie: "petugas" });
    if (session.error || !session.profile) return jsonError("Session petugas tidak valid.", 401);
    if (!isPetugas(session.profile)) return jsonError("Akses khusus petugas.", 403);
    const workflowRole = normalizeWorkflowRole(session.profile.role);
    if (workflowRole !== "staff_pelayanan") return jsonError("Hanya Staff Pelayanan yang dapat membuat surat untuk TTD Lurah.", 403);

    const supabase = createSupabaseAdminClient();
    if (!supabase) return jsonError("Supabase service role belum dikonfigurasi.", 500);

    const { data: activeStage, error: stageError } = await supabase.from("verifikasi_pengajuan").select("id,role_petugas,status").eq("pengajuan_id", id).eq("role_petugas", workflowRole).eq("status", "Disetujui").maybeSingle();
    if (stageError) return jsonError(stageError.message, 500);
    if (!activeStage) return jsonError("Surat hanya dapat dibuat setelah seluruh pemeriksaan Staff selesai.", 403);

    const body = await request.json().catch(() => ({})) as { action?: "generate" | "confirm" };
    const { data: existingDocs } = await supabase.from("dokumen_pengajuan").select("*").eq("pengajuan_id", id).ilike("jenis", "%Surat Hasil Pelayanan%");
    const activeDraft = (existingDocs ?? []).find((d: AnyRow) => d.status === "DRAFT");
    const activeReady = (existingDocs ?? []).find((d: AnyRow) => ["SIAP_DIVERIFIKASI", "FINAL", "TERBIT"].includes(String(d.status)));

    const now = new Date().toISOString();
    if (body.action === "confirm") {
        if (!activeDraft) return jsonError("Draft surat belum tersedia.");
        await supabase.from("dokumen_pengajuan").update({ status: "SIAP_DIVERIFIKASI" }).eq("id", activeDraft.id);
        await supabase.from("audit_pengajuan").insert({ pengajuan_id: id, user_id: session.profile.id, nama_petugas: session.profile.nama_lengkap ?? session.profile.username, role: workflowRole, aksi: "SURAT_DIKONFIRMASI", action: "SURAT_DIKONFIRMASI", status: "SIAP_DIVERIFIKASI", catatan: "Surat dikonfirmasi Staff untuk verifikasi berjenjang.", metadata: { dokumen_id: activeDraft.id }, created_at: now });
        return NextResponse.json({ ok: true, data: { ...activeDraft, status: "SIAP_DIVERIFIKASI" } });
    }

    if (activeDraft || activeReady) return jsonError("Surat aktif sudah tersedia. Tidak dapat membuat surat ganda.", 409);
    const { data: pengajuan, error: pengajuanError } = await supabase.from("pengajuan_surat").select("*, layanan(*)").eq("id", id).maybeSingle();
    if (pengajuanError) return jsonError(pengajuanError.message, 500);
    if (!pengajuan) return jsonError("Pengajuan tidak ditemukan.", 404);
    const { count } = await supabase.from("dokumen_pengajuan").select("id", { count: "exact", head: true }).eq("pengajuan_id", id).ilike("jenis", "%Surat Hasil Pelayanan%");
    const version = (count ?? 0) + 1;
    const path = `surat-hasil-pelayanan/${id}/v${version}-${Date.now()}-surat-hasil-pelayanan.pdf`;
    const { data: uploaded, error: uploadError } = await supabase.storage.from("surat").upload(path, buildPdf(pengajuan, version), { contentType: "application/pdf", upsert: false });
    if (uploadError) return jsonError(uploadError.message, 500);

    const { data: doc, error: insertError } = await supabase.from("dokumen_pengajuan").insert({ pengajuan_id: id, nama_file: "surat-hasil-pelayanan.pdf", jenis: `Surat Hasil Pelayanan v${version}`, url_file: uploaded.path, status: "DRAFT", metadata: { version, active: true, generated_at: now, generated_by: session.profile.id } }).select("*").single();
    if (insertError) return jsonError(insertError.message, 500);

    await supabase.from("audit_pengajuan").insert({ pengajuan_id: id, user_id: session.profile.id, nama_petugas: session.profile.nama_lengkap ?? session.profile.username, role: workflowRole, aksi: "SURAT_DRAFT_DIBUAT", action: "SURAT_DRAFT_DIBUAT", status: "DRAFT", catatan: `Draft surat hasil pelayanan versi ${version} dibuat otomatis.`, metadata: { dokumen_id: doc.id, version, file_path: uploaded.path }, created_at: now });
    const { data: signed } = await supabase.storage.from("surat").createSignedUrl(uploaded.path, 60 * 10);
    return NextResponse.json({ ok: true, data: { ...doc, file_url: signed?.signedUrl ?? "", signed_url: signed?.signedUrl ?? "", version } });
}