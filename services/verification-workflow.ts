export type WorkflowRole = "staff_pelayanan" | "petugas_lapangan" | "kepala_seksi" | "seklur" | "lurah";

export type VerificationStage = {
    tahap: number;
    nama_tahap: string;
    role_petugas: WorkflowRole;
};

export const VERIFICATION_STAGES: VerificationStage[] = [
    { tahap: 1, nama_tahap: "Verifikasi Staff Pelayanan", role_petugas: "staff_pelayanan" },
    { tahap: 2, nama_tahap: "Verifikasi Petugas Lapangan", role_petugas: "petugas_lapangan" },
    { tahap: 3, nama_tahap: "Verifikasi Kepala Seksi", role_petugas: "kepala_seksi" },
    { tahap: 4, nama_tahap: "Verifikasi Seklur", role_petugas: "seklur" },
    { tahap: 5, nama_tahap: "Persetujuan Lurah", role_petugas: "lurah" },
];

export function isWorkflowRole(role?: string | null): role is WorkflowRole {
    return VERIFICATION_STAGES.some((stage) => stage.role_petugas === role);
}

export function createVerificationRows(pengajuanId: string) {
    return VERIFICATION_STAGES.map((stage) => ({
        pengajuan_id: pengajuanId,
        tahap: stage.tahap,
        nama_tahap: stage.nama_tahap,
        role_petugas: stage.role_petugas,
        status: "Menunggu",
    }));
}

export function getActiveStage<T extends { tahap?: number | null; status?: string | null }>(stages?: T[] | null) {
    const ordered = [...(stages ?? [])].sort((a, b) => Number(a.tahap ?? 0) - Number(b.tahap ?? 0));
    return ordered.find((stage) => stage.status === "Menunggu") ?? null;
}

export function displayWorkflowRole(role?: string | null) {
    const stage = VERIFICATION_STAGES.find((item) => item.role_petugas === role);
    return stage?.nama_tahap.replace(/^Verifikasi\s+|^Persetujuan\s+/, "") ?? role ?? "Petugas";
}