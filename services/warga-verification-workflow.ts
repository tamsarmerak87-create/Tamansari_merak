import { createSupabaseAdminClient } from "@/services/supabase";
import type { PetugasProfile, WorkflowRole } from "@/services/admin-session";

export type WargaVerificationRole = Exclude<WorkflowRole, "admin">;
export type WargaAction = "periksa" | "setujui" | "kembalikan" | "tolak";

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

export function getWargaStageByRole(role?: string | null) {
    return WARGA_WORKFLOW.find((stage) => stage.role === role) ?? null;
}

export function getWargaStageByStatus(status?: string | null) {
    if (!status || status === "Belum Terverifikasi" || status === "Belum Diverifikasi") return WARGA_WORKFLOW[0];
    if (status === "Dikembalikan") return null;
    return WARGA_WORKFLOW.find((stage) => stage.status === status) ?? null;
}

export function getActiveWargaStage(warga: WargaRow) {
    if (!warga.tahap_verifikasi && ["Belum Terverifikasi", "Belum Diverifikasi"].includes(String(warga.status_verifikasi ?? ""))) return WARGA_WORKFLOW[0];
    if (warga.status_verifikasi === "Dikembalikan") return getWargaStageByRole(warga.returned_to_role);
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
    return Boolean(stage && stage.role === user.role && user.is_active !== false && !isWargaAssignedToOtherPetugas(user, warga) && !WARGA_TERMINAL_STATUSES.includes(String(warga.status_verifikasi)));
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
    return [...existing, { ...entry, created_at: new Date().toISOString() }];
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
