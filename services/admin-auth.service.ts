export type AdminPortalRole = "admin" | "petugas";

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
    return role === "admin" || role === "petugas";
}

function mapPetugasToAdminProfile(row: PetugasRow): AdminPortalProfile {
    const normalizedRole: AdminPortalRole = row.role === "admin" ? "admin" : "petugas";
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

export async function logoutAdminPortal() {
    await fetch("/api/admin/auth/logout", { method: "POST", credentials: "include" });
}