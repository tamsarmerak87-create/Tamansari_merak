import { type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/services/supabase";

export const allowedRoles = [
    "admin",
    "staff_pelayanan",
    "petugas_lapangan",
    "kepala_seksi",
    "seklur",
    "lurah",
] as const;

export type PetugasRole = (typeof allowedRoles)[number];

export type PetugasProfile = {
    id: string;
    username: string;
    nama_lengkap?: string | null;
    nip?: string | null;
    jabatan?: string | null;
    role: PetugasRole;
    is_active: boolean;
};

export function isPetugasRole(role?: string | null): role is PetugasRole {
    return allowedRoles.includes(role as PetugasRole);
}

export async function getAdminSession(request: NextRequest) {
    const petugasId = request.cookies.get("tamsar_petugas_session")?.value ?? request.cookies.get("tamsar_admin_session")?.value;
    if (!petugasId) return { error: "UNAUTHENTICATED" as const, profile: null };

    const supabase = createSupabaseAdminClient();
    if (!supabase) return { error: "SUPABASE_NOT_CONFIGURED" as const, profile: null };

    const { data, error } = await supabase
        .from("petugas")
        .select("id,username,nama_lengkap,nip,jabatan,role,is_active")
        .eq("id", petugasId)
        .eq("is_active", true)
        .maybeSingle();

    if (error || !data || !isPetugasRole(data.role)) return { error: "FORBIDDEN" as const, profile: null };

    return { error: null, profile: data as PetugasProfile };
}
