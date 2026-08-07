import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/services/supabase";

export type AdminPortalRole = "admin" | "petugas";

export type AdminPortalProfile = {
    user_id: string;
    full_name?: string | null;
    email?: string | null;
    role: AdminPortalRole;
    is_active?: boolean | null;
};

function client() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
    return supabase;
}

export function isAdminPortalRole(role?: string | null): role is AdminPortalRole {
    return role === "admin" || role === "petugas";
}

export async function getCurrentAdminPortalUser(): Promise<{ user: User | null; profile: AdminPortalProfile | null }> {
    const supabase = client();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    const user = userData.user;
    if (!user) return { user: null, profile: null };

    const { data: adminProfile, error: adminError } = await supabase
        .from("admin_profiles")
        .select("user_id,full_name,role,is_active")
        .eq("user_id", user.id)
        .maybeSingle();

    if (adminError) throw adminError;
    if (adminProfile && isAdminPortalRole(adminProfile.role) && adminProfile.is_active !== false) {
        return { user, profile: { ...(adminProfile as AdminPortalProfile), email: user.email } };
    }

    // Fallback untuk instalasi yang menyimpan role admin/petugas pada warga_profiles.
    const { data: wargaProfile, error: wargaError } = await supabase
        .from("warga_profiles")
        .select("id,nama_lengkap,email,role")
        .eq("id", user.id)
        .maybeSingle();

    if (wargaError) throw wargaError;
    if (wargaProfile && isAdminPortalRole(wargaProfile.role)) {
        return {
            user,
            profile: {
                user_id: wargaProfile.id,
                full_name: wargaProfile.nama_lengkap,
                email: wargaProfile.email,
                role: wargaProfile.role,
                is_active: true,
            },
        };
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
        throw new Error("Akses ditolak. Hanya akun role admin atau petugas yang dapat masuk Portal Admin.");
    }

    return current;
}

export async function logoutAdminPortal() {
    await client().auth.signOut();
}