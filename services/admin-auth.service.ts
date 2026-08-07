import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/services/supabase";

export type AdminPortalRole = "admin" | "petugas";

export type AdminPortalProfile = {
    id: string;
    user_id: string;
    full_name?: string | null;
    email?: string | null;
    role: AdminPortalRole;
    is_active?: boolean | null;
};

type PetugasRow = {
    id: string;
    nama?: string | null;
    nama_lengkap?: string | null;
    full_name?: string | null;
    email?: string | null;
    role?: string | null;
    jabatan?: string | null;
    is_active?: boolean | null;
    aktif?: boolean | null;
    status?: string | null;
};

function client() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
    return supabase;
}

export function isAdminPortalRole(role?: string | null): role is AdminPortalRole {
    return role === "admin" || role === "petugas";
}

function mapPetugasToAdminProfile(row: PetugasRow, user: User): AdminPortalProfile {
    const normalizedRole: AdminPortalRole = row.role === "admin" ? "admin" : "petugas";
    return {
        id: row.id,
        user_id: row.id,
        full_name: row.full_name ?? row.nama_lengkap ?? row.nama ?? row.jabatan ?? "Petugas Kelurahan",
        email: row.email ?? user.email,
        role: normalizedRole,
        is_active: row.is_active ?? row.aktif ?? row.status !== "nonaktif",
    };
}

export async function getCurrentAdminPortalUser(): Promise<{ user: User | null; profile: AdminPortalProfile | null }> {
    const supabase = client();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    const user = userData.user;
    if (!user) return { user: null, profile: null };

    const { data: petugas, error: petugasError } = await supabase
        .from("petugas")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

    if (petugasError) throw petugasError;
    if (petugas) {
        const profile = mapPetugasToAdminProfile(petugas as PetugasRow, user);
        if (profile.is_active !== false) return { user, profile };
    }

    return { user, profile: null };
}

export async function loginAdminPortal(email: string, password: string) {
    const supabase = client();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const current = await getCurrentAdminPortalUser();
    if (!current.profile) {
        await supabase.auth.signOut();
        throw new Error("Akun ini bukan petugas/admin.");
    }

    return current;
}

export async function logoutAdminPortal() {
    await client().auth.signOut();
}