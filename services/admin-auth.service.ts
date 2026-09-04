import { isAdmin, isPetugas, type WorkflowRole } from "@/services/admin-session";

export type AdminPortalRole = WorkflowRole;

export type AdminPortalUser = {
    id: string;
    username: string;
};

export type AdminPortalProfile = {
    id: string;
    user_id: string;
    full_name?: string | null;
    email?: string | null;
    username?: string | null;
    role: AdminPortalRole;
    is_active?: boolean | null;
};

type PetugasRow = {
    id: string;
    nama?: string | null;
    nama_lengkap?: string | null;
    full_name?: string | null;
    email?: string | null;
    username?: string | null;
    role?: string | null;
    jabatan?: string | null;
    is_active?: boolean | null;
    aktif?: boolean | null;
    status?: string | null;
};

export function isAdminPortalRole(role?: string | null): role is AdminPortalRole {
    return isAdmin(role ? { role } : null) || isPetugas(role ? { role } : null);
}

function mapPetugasToAdminProfile(row: PetugasRow): AdminPortalProfile {
    const normalizedRole: AdminPortalRole = isAdminPortalRole(row.role) ? (row.role as AdminPortalRole) : "staff_pelayanan";
    return {
        id: row.id,
        user_id: row.id,
        full_name: row.full_name ?? row.nama_lengkap ?? row.nama ?? row.jabatan ?? "Petugas Kelurahan",
        email: row.email ?? null,
        username: row.username ?? null,
        role: normalizedRole,
        is_active: row.is_active ?? row.aktif ?? row.status !== "nonaktif",
    };
}

export async function getCurrentAdminPortalUser(): Promise<{ user: AdminPortalUser | null; profile: AdminPortalProfile | null }> {
    const response = await fetch("/api/admin/auth/me", { credentials: "include", cache: "no-store" });
    if (response.status === 401) return { user: null, profile: null };
    if (!response.ok) throw new Error("Gagal memeriksa sesi petugas.");
    const data = (await response.json()) as { user: AdminPortalUser | null; profile: PetugasRow | null };
    return {
        user: data.user,
        profile: data.profile ? mapPetugasToAdminProfile(data.profile) : null,
    };
}

export async function getCurrentPetugasPortalUser(): Promise<{ user: AdminPortalUser | null; profile: AdminPortalProfile | null }> {
    const response = await fetch("/api/petugas/auth/me", { credentials: "include", cache: "no-store" });
    if (response.status === 401 || response.status === 403) return { user: null, profile: null };
    if (!response.ok) throw new Error("Gagal memeriksa sesi petugas.");
    const data = (await response.json()) as { user: AdminPortalUser | null; profile: PetugasRow | null };
    return {
        user: data.user,
        profile: data.profile ? mapPetugasToAdminProfile(data.profile) : null,
    };
}

export async function loginAdminPortal(username: string, password: string) {
    const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
        throw new Error("Username atau password salah.");
    }

    const data = (await response.json()) as { user: AdminPortalUser; profile: PetugasRow };
    return { user: data.user, profile: mapPetugasToAdminProfile(data.profile) };
}

export async function loginPetugasPortal(username: string, password: string) {
    const response = await fetch("/api/petugas/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
        const data = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(data?.message || (response.status === 503
            ? "Layanan sedang mengalami gangguan koneksi. Silakan coba kembali beberapa saat lagi."
            : response.status >= 500
                ? "Terjadi gangguan internal. Silakan coba kembali beberapa saat lagi."
                : "Username atau password salah."));
    }

    const data = (await response.json()) as { user: AdminPortalUser; profile: PetugasRow };
    return { user: data.user, profile: mapPetugasToAdminProfile(data.profile) };
}

export async function logoutPetugasPortal() {
    await fetch("/api/petugas/auth/logout", { method: "POST", credentials: "include" });
}

export async function logoutAdminPortal() {
    await fetch("/api/admin/auth/logout", { method: "POST", credentials: "include" });
}