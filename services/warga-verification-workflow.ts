import { createSupabaseAdminClient } from "@/services/supabase";
import type { PetugasProfile, WorkflowRole } from "@/services/admin-session";

export type WargaVerificationRole = Exclude<WorkflowRole, "admin">;
export type WargaAction = "periksa" | "simpan" | "setujui" | "kembalikan" | "tolak";

export const WARGA_WORKFLOW = [
    { tahap: 1, role: "staff_pelayanan", label: "Staff Pelayanan", status: "Menunggu Staff Pelayanan", task: "Menunggu Verifikasi Awal" },
    { tahap: 2, role: "petugas_lapangan", label: "Petugas Lapangan", status: "Menunggu Petugas Lapangan", task: "Menunggu Verifikasi Lapangan" },
    { tahap: 3, role: "kepala_seksi", label: "Kasi", status: "Menunggu Kasi", task: "Menunggu Pemeriksaan Kasi" },
    { tahap: 4, role: "seklur", label: "Sek Lur", status: "Menunggu Sek Lur", task: "Menunggu Persetujuan Sek Lur" },
    { tahap: 5, role: "lurah", label: "Lurah", status: "Menunggu Lurah", task: "Menunggu Persetujuan Akhir" },
] as const;

export const WARGA_TERMINAL_STATUSES = ["Terverifikasi", "Ditolak"];
export const WARGA_PENDING_STATUSES = ["Belum Terverifikasi", "Belum Diverifikasi", ...WARGA_WORKFLOW.map((s) => s.status), "Dikembalikan"];

type WargaRow = Record<string, any>;
export type WargaStage = (typeof WARGA_WORKFLOW)[number];

export function normalizeWargaRole(role?: string | null) {
    const normalized = String(role ?? "").toLowerCase().trim().replace(/[\s-]+/g, "_");
    if (["staff", "staff_pelayanan", "pelayanan"].includes(normalized)) return "staff_pelayanan";
    if (["petugas_lapangan", "lapangan"].includes(normalized)) return "petugas_lapangan";
    if (["kasi", "kepala_seksi"].includes(normalized)) return "kepala_seksi";
    if (["seklur", "sek_lur", "sekretaris_lurah"].includes(normalized)) return "seklur";
    if (normalized === "lurah") return "lurah";
    return normalized;
}

export function getWargaStageByRole(role?: string | null) {
    return WARGA_WORKFLOW.find((stage) => stage.role === normalizeWargaRole(role)) ?? null;
}

export function getWargaStageByStatus(status?: string | null) {
    if (!status || status === "Belum Terverifikasi" || status === "Belum Diverifikasi") return WARGA_WORKFLOW[0];
    if (status === "Dikembalikan") return null;
    return WARGA_WORKFLOW.find((stage) => stage.status === status) ?? null;
}

export function getActiveWargaStage(warga: WargaRow) {
    if (warga.status_verifikasi === "Terverifikasi" || warga.tahap_verifikasi === "selesai") return null;
    if (warga.status_verifikasi === "Dikembalikan") return getWargaStageByRole(warga.returned_to_role ?? warga.tahap_verifikasi);
    const byTahapRole = getWargaStageByRole(warga.tahap_verifikasi);
    if (byTahapRole) return byTahapRole;
    if (!warga.tahap_verifikasi && ["Belum Terverifikasi", "Belum Diverifikasi"].includes(String(warga.status_verifikasi ?? ""))) return WARGA_WORKFLOW[0];
    return getWargaStageByStatus(warga.status_verifikasi);
}

export function isPendingWargaVerification(warga: WargaRow) {
    return Boolean(getActiveWargaStage(warga) && !WARGA_TERMINAL_STATUSES.includes(String(warga.status_verifikasi ?? "")));
}

export function getAssignedPetugasId(warga: WargaRow) {
    return warga.handled_by ?? warga.assignment?.petugas_id ?? warga.assignment?.handled_by ?? warga.petugas_id ?? null;
}

export function isWargaAssignedToOtherPetugas(user: PetugasProfile, warga: WargaRow) {
    const assignedId = getAssignedPetugasId(warga);
    return Boolean(assignedId && assignedId !== user.id);
}

export function canHandleWargaStage(user: PetugasProfile, warga: WargaRow) {
    const stage = getActiveWargaStage(warga);
    return Boolean(stage && stage.role === normalizeWargaRole(user.role) && user.is_active !== false && !isWargaAssignedToOtherPetugas(user, warga) && !WARGA_TERMINAL_STATUSES.includes(String(warga.status_verifikasi)));
}

export function getValidReturnStages(currentRole?: string | null) {
    const currentIndex = WARGA_WORKFLOW.findIndex((stage) => stage.role === currentRole);
    if (currentIndex <= 0) return [];
    if (currentRole === "kepala_seksi") return WARGA_WORKFLOW.filter((stage) => stage.role === "petugas_lapangan");
    if (currentRole === "seklur") return WARGA_WORKFLOW.filter((stage) => ["kepala_seksi", "petugas_lapangan"].includes(stage.role));
    if (currentRole === "lurah") return WARGA_WORKFLOW.filter((stage) => ["seklur", "kepala_seksi"].includes(stage.role));
    return WARGA_WORKFLOW.slice(0, currentIndex).slice(-1);
}

export function resolveReturnStage(currentRole: string, requestedRole?: string | null) {
    const validStages = getValidReturnStages(currentRole);
    if (!validStages.length) return null;
    return validStages.find((stage) => stage.role === requestedRole) ?? (requestedRole ? null : validStages[0]);
}

export function appendWargaHistory(warga: WargaRow, entry: Record<string, any>) {
    const existing = Array.isArray(warga.verification_history) ? warga.verification_history : Array.isArray(warga.riwayat_verifikasi) ? warga.riwayat_verifikasi : [];
    const stage = getActiveWargaStage({ ...warga, status_verifikasi: entry.status_sesudah ?? warga.status_verifikasi, returned_to_role: entry.returned_to_role ?? warga.returned_to_role });
    return [...existing, { warga_id: warga.id, nama_warga: warga.nama_lengkap ?? warga.nama ?? null, tahap: stage?.label ?? warga.tahap_verifikasi ?? null, ...entry, created_at: new Date().toISOString() }];
}

export async function notifyWargaAccount(warga: WargaRow, title: string, message: string, catatan?: string | null) {
    const supabase = createSupabaseAdminClient();
    if (!supabase || !warga.id) return;
    await supabase.from("warga_notifikasi").insert({ warga_id: warga.id, pengajuan_id: null, title, message, catatan: catatan || null, type: "akun", read: false }).throwOnError();
}

export async function notifyPetugasRole(role: string, title: string, message: string, metadata: Record<string, any>) {
    const supabase = createSupabaseAdminClient();
    if (!supabase) return;
    const { data: officers } = await supabase.from("petugas").select("id").eq("role", role).eq("is_active", true);
    if (!officers?.length) return;
    await supabase.from("petugas_notifikasi").insert(officers.map((p: { id: string }) => ({ petugas_id: p.id, title, message, type: "verifikasi_warga", metadata, read: false }))).throwOnError();
}

export async function notifyPetugasTarget(stage: WargaStage, warga: WargaRow, title: string, message: string, metadata: Record<string, any>) {
    const assignedId = getAssignedPetugasId(warga);
    const supabase = createSupabaseAdminClient();
    if (!supabase) return;
    if (assignedId) {
        await supabase.from("petugas_notifikasi").insert({ petugas_id: assignedId, title, message, type: "verifikasi_warga", metadata, read: false }).throwOnError();
        return;
    }
    await notifyPetugasRole(stage.role, title, message, metadata);
}

export const ACCOUNT_VERIFICATION_BLOCK_MESSAGE = "Akun Anda masih dalam proses verifikasi oleh Kelurahan Tamansari. Layanan akan tersedia setelah verifikasi akun selesai.";

export async function assertWargaAccountVerifiedByNik(nik?: string | null) {
    if (!nik) throw new Error(ACCOUNT_VERIFICATION_BLOCK_MESSAGE);
    const supabase = createSupabaseAdminClient();
    if (!supabase) throw new Error("Supabase service role belum dikonfigurasi.");
    const { data, error } = await supabase
        .from("warga_profiles")
        .select("id, status_verifikasi, tahap_verifikasi")
        .eq("nik", nik)
        .maybeSingle();
    if (error) {
        console.error("SUPABASE WARGA ACCOUNT GUARD ERROR");
        console.dir(error, { depth: null });
        throw new Error(ACCOUNT_VERIFICATION_BLOCK_MESSAGE);
    }
    if (!data || data.status_verifikasi !== "Terverifikasi") throw new Error(ACCOUNT_VERIFICATION_BLOCK_MESSAGE);
    return data;
}

export function getWargaVerificationProgress(warga: WargaRow) {
    const active = getActiveWargaStage(warga);
    const activeIndex = active ? WARGA_WORKFLOW.findIndex((stage) => stage.role === active.role) : WARGA_WORKFLOW.length;
    return [
        { label: "Akun dibuat", state: "done" },
        { label: "Profil tersimpan", state: "done" },
        ...WARGA_WORKFLOW.map((stage, index) => ({
            label: stage.label === "Staff Pelayanan" ? "Verifikasi Staff" : stage.label,
            role: stage.role,
            state: warga.status_verifikasi === "Terverifikasi" || index < activeIndex ? "done" : index === activeIndex ? "current" : "upcoming",
        })),
        { label: "Akun Terverifikasi", state: warga.status_verifikasi === "Terverifikasi" ? "done" : "upcoming" },
    ];
}

export async function processWargaVerificationAction(params: { wargaId: string; action: WargaAction; petugas: PetugasProfile; catatan?: string | null; returnedToRole?: string | null; pemeriksaan?: Record<string, any> | null }) {
    const supabase = createSupabaseAdminClient();
    if (!supabase) throw new Error("Supabase service role belum dikonfigurasi.");
    const { data: warga, error: findError } = await supabase.from("warga_profiles").select("*").eq("id", params.wargaId).maybeSingle();
    if (findError) throw new Error(findError.message);
    if (!warga) throw new Error("Data warga tidak ditemukan.");
    const stage = getActiveWargaStage(warga);
    if (!stage || !canHandleWargaStage(params.petugas, warga)) throw new Error("Anda tidak berwenang menangani tahap akun warga ini.");
    const nextStage = WARGA_WORKFLOW[WARGA_WORKFLOW.findIndex((item) => item.role === stage.role) + 1] ?? null;
    const finalApproved = params.action === "setujui" && stage.role === "lurah";
    const returnStage = params.action === "kembalikan" ? resolveReturnStage(stage.role, params.returnedToRole) : null;
    if (params.action === "kembalikan" && !returnStage) throw new Error("Tujuan pengembalian tidak valid untuk tahap ini.");
    if (["kembalikan", "tolak"].includes(params.action) && !String(params.catatan ?? "").trim()) throw new Error("Alasan wajib diisi.");
    if (params.action === "setujui" && !finalApproved && !nextStage) throw new Error("Tahap berikutnya tidak valid.");
    const inspectionOnly = params.action === "periksa" || params.action === "simpan";
    const targetStage = params.action === "kembalikan" ? returnStage : params.action === "setujui" ? nextStage : stage;
    const currentStatus = String(warga.status_verifikasi ?? stage.status);
    const nextStatus = inspectionOnly ? currentStatus : params.action === "tolak" ? "Ditolak" : params.action === "kembalikan" ? "Dikembalikan" : finalApproved ? "Terverifikasi" : targetStage?.status ?? stage.status;
    const history = appendWargaHistory(warga, { action: params.action, keputusan: params.action === "setujui" ? "Disetujui" : params.action === "kembalikan" ? "Dikembalikan" : params.action === "tolak" ? "Ditolak" : "Pemeriksaan disimpan", status_sebelum: warga.status_verifikasi, status_sesudah: nextStatus, tahap: stage.label, role: normalizeWargaRole(params.petugas.role), petugas_id: params.petugas.id, nama_petugas: params.petugas.nama_lengkap ?? params.petugas.username, catatan: params.catatan || null, alasan_pengembalian: params.action === "kembalikan" ? params.catatan : null, returned_to_role: returnStage?.role ?? null, pemeriksaan: params.pemeriksaan ?? null });
    const updatePayload = { status_verifikasi: nextStatus, tahap_verifikasi: inspectionOnly ? warga.tahap_verifikasi ?? stage.role : finalApproved ? "selesai" : targetStage?.role ?? stage.role, handled_by: inspectionOnly ? params.petugas.id : null, returned_to_role: inspectionOnly ? warga.returned_to_role ?? null : returnStage?.role ?? null, alasan_penolakan: params.action === "tolak" || params.action === "kembalikan" ? params.catatan ?? null : null, verified_at: finalApproved ? new Date().toISOString() : null, verified_by: finalApproved ? params.petugas.id : null, verification_history: history };
    const { data, error } = await supabase.from("warga_profiles").update(updatePayload).eq("id", params.wargaId).select("*").single();
    if (error) throw new Error(error.message);
    if (params.action === "setujui") {
        const message = finalApproved ? "Selamat, akun Anda telah terverifikasi. Seluruh layanan Kelurahan Tamansari sekarang dapat digunakan." : targetStage?.role === "petugas_lapangan" ? "Verifikasi Staff telah selesai dan data diteruskan ke Petugas Lapangan." : targetStage?.role === "kepala_seksi" ? "Data Anda sedang diperiksa oleh Kasi." : targetStage?.role === "lurah" ? "Menunggu persetujuan Lurah." : `Data Anda sedang diperiksa oleh ${targetStage?.label}.`;
        await notifyWargaAccount(warga, finalApproved ? "Akun Terverifikasi" : "Verifikasi Akun Berlanjut", message, params.catatan);
        if (targetStage && !finalApproved) await notifyPetugasTarget(targetStage, data, "Verifikasi Akun Warga", `${warga.nama_lengkap ?? warga.nik} menunggu tindakan ${targetStage.label}.`, { warga_id: params.wargaId, tahap_verifikasi: targetStage.role });
    } else if (params.action === "kembalikan") await notifyWargaAccount(warga, "Data Perlu Diperbaiki", "Data akun Anda dikembalikan untuk diperbaiki sebelum verifikasi dilanjutkan.", params.catatan);
    else if (params.action === "tolak") await notifyWargaAccount(warga, "Akun Ditolak", "Verifikasi akun warga Anda ditolak.", params.catatan);
    return data;
}
