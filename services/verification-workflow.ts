export type WorkflowRole = "staff_pelayanan" | "petugas_lapangan" | "kepala_seksi" | "seklur" | "lurah";
export type WorkflowStatus = "MENUNGGU_STAFF" | "MENUNGGU_PETUGAS_LAPANGAN" | "MENUNGGU_KASI" | "MENUNGGU_SEKLUR" | "MENUNGGU_LURAH" | "REVISI" | "DITOLAK" | "SELESAI" | "DIBATALKAN";

export type VerificationStage = {
    tahap: number;
    nama_tahap: string;
    role_petugas: WorkflowRole;
};

export const VERIFICATION_STATUS = ["Menunggu", "Diproses", "Disetujui", "Ditolak"] as const;
export const FINAL_STATUSES = ["SELESAI", "DIBATALKAN", "DITOLAK", "Selesai", "Ditolak", "Disetujui"] as const;

export const VERIFICATION_STAGES: VerificationStage[] = [
    { tahap: 1, nama_tahap: "Verifikasi Staff Pelayanan", role_petugas: "staff_pelayanan" },
    { tahap: 2, nama_tahap: "Verifikasi Petugas Lapangan", role_petugas: "petugas_lapangan" },
    { tahap: 3, nama_tahap: "Verifikasi Kepala Seksi", role_petugas: "kepala_seksi" },
    { tahap: 4, nama_tahap: "Verifikasi Seklur", role_petugas: "seklur" },
    { tahap: 5, nama_tahap: "Persetujuan Lurah", role_petugas: "lurah" },
];

export const STAGE_WAITING_STATUS: Record<number, WorkflowStatus> = {
    1: "MENUNGGU_STAFF",
    2: "MENUNGGU_PETUGAS_LAPANGAN",
    3: "MENUNGGU_KASI",
    4: "MENUNGGU_SEKLUR",
    5: "MENUNGGU_LURAH",
};

export function isWorkflowRole(role?: string | null): role is WorkflowRole {
    return VERIFICATION_STAGES.some((stage) => stage.role_petugas === role);
}

export function createVerificationRows(pengajuanId: string) {
    return VERIFICATION_STAGES.map((stage) => ({
        pengajuan_id: pengajuanId,
        tahap: stage.tahap,
        nama_tahap: stage.nama_tahap,
        role_petugas: stage.role_petugas,
        status: stage.tahap === 1 ? "Diproses" : "Menunggu",
    }));
}

export function normalizeSubmissionStatus(status?: string | null): WorkflowStatus | string {
    if (!status) return "MENUNGGU_STAFF";
    const normalized = status.toUpperCase().replace(/\s+/g, "_");
    if (normalized === "MENUNGGU_VERIFIKASI") return "MENUNGGU_STAFF";
    if (normalized === "DISETUJUI" || normalized === "SELESAI") return "SELESAI";
    if (normalized === "DITOLAK") return "DITOLAK";
    return normalized;
}

export function isFinalSubmissionStatus(status?: string | null) {
    return FINAL_STATUSES.includes(String(status ?? "") as never) || ["SELESAI", "DIBATALKAN", "DITOLAK"].includes(String(normalizeSubmissionStatus(status)));
}

export function getActiveStage<T extends { tahap?: number | null; status?: string | null }>(stages?: T[] | null) {
    const ordered = [...(stages ?? [])].sort((a, b) => Number(a.tahap ?? 0) - Number(b.tahap ?? 0));
    return ordered.find((stage) => stage.status === "Diproses") ?? ordered.find((stage) => stage.status === "Menunggu") ?? null;
}

export function displayWorkflowRole(role?: string | null) {
    const stage = VERIFICATION_STAGES.find((item) => item.role_petugas === role);
    return stage?.nama_tahap.replace(/^Verifikasi\s+|^Persetujuan\s+/, "") ?? role ?? "Petugas";
}