import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, isPetugas } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { normalizeWorkflowRole } from "@/services/verification-workflow";

function jsonError(message: string, status = 400) { return NextResponse.json({ ok: false, error: message }, { status }); }

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    const session = await getAdminSession(request, { cookie: "petugas" });
    if (session.error || !session.profile) return jsonError("Session petugas tidak valid.", 401);
    if (!isPetugas(session.profile)) return jsonError("Akses khusus petugas.", 403);
    const workflowRole = normalizeWorkflowRole(session.profile.role);
    if (workflowRole !== "staff_pelayanan") return jsonError("Hanya Staff Pelayanan yang dapat mengunggah surat untuk TTD Lurah.", 403);

    const supabase = createSupabaseAdminClient();
    if (!supabase) return jsonError("Supabase service role belum dikonfigurasi.", 500);

    const { data: activeStage, error: stageError } = await supabase.from("verifikasi_pengajuan").select("id,role_petugas,status").eq("pengajuan_id", id).eq("role_petugas", workflowRole).eq("status", "Diproses").maybeSingle();
    if (stageError) return jsonError(stageError.message, 500);
    if (!activeStage) return jsonError("Pengajuan tidak berada pada tahap Staff Pelayanan aktif.", 403);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return jsonError("File surat wajib diunggah.");
    if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) return jsonError("Format utama surat untuk TTD Lurah harus PDF.");

    const now = new Date().toISOString();
    const { count } = await supabase.from("dokumen_pengajuan").select("id", { count: "exact", head: true }).eq("pengajuan_id", id).ilike("jenis", "%Surat TTD Lurah%");
    const version = (count ?? 0) + 1;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `surat-ttd-lurah/${id}/v${version}-${Date.now()}-${safeName}`;
    const { data: uploaded, error: uploadError } = await supabase.storage.from("surat").upload(path, file, { contentType: file.type || "application/pdf", upsert: false });
    if (uploadError) return jsonError(uploadError.message, 500);

    const { data: doc, error: insertError } = await supabase.from("dokumen_pengajuan").insert({ pengajuan_id: id, nama_file: file.name, jenis: `Surat TTD Lurah v${version}`, url_file: uploaded.path, status: "Belum diverifikasi" }).select("*").single();
    if (insertError) return jsonError(insertError.message, 500);

    await supabase.from("audit_pengajuan").insert({ pengajuan_id: id, user_id: session.profile.id, nama_petugas: session.profile.nama_lengkap ?? session.profile.username, role: workflowRole, aksi: "SURAT_TTD_LURAH_DIUPLOAD", action: "SURAT_TTD_LURAH_DIUPLOAD", status: "Belum diverifikasi", catatan: `Upload surat TTD Lurah versi ${version}`, metadata: { dokumen_id: doc.id, version, file_path: uploaded.path, uploaded_at: now }, created_at: now });
    const { data: signed } = await supabase.storage.from("surat").createSignedUrl(uploaded.path, 60 * 10);
    return NextResponse.json({ ok: true, data: { ...doc, file_url: signed?.signedUrl ?? "", signed_url: signed?.signedUrl ?? "", versi: version } });
}