import { type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/services/supabase";

export const workflowRoles = [
    "admin",
    "staff_pelayanan",
    "petugas_lapangan",
    "kepala_seksi",
    "seklur",
    "lurah",
] as const;

export type WorkflowRole = (typeof workflowRoles)[number];

export type AdminRole = "admin";

export type PetugasRole = Exclude<WorkflowRole, "admin">;

export type PetugasProfile = {
    id: string;
    username: string;
    nama_lengkap?: string | null;
    nip?: string | null;
    jabatan?: string | null;
    role: WorkflowRole;
    is_active: boolean;
};

export function isAdminRole(role?: string | null): role is AdminRole {
    return role === "admin";
}

export function isPetugasRole(role?: string | null): role is PetugasRole {
    return workflowRoles.includes(role as WorkflowRole) && role !== "admin";
}

export function isAdmin(user?: { role?: string | null } | null) {
    return isAdminRole(user?.role);
}

export function isPetugas(user?: { role?: string | null } | null) {
    return Boolean(user?.role && isPetugasRole(user.role));
}

export function requireAdmin(user?: { role?: string | null } | null) {
    return isAdmin(user) ? null : "FORBIDDEN" as const;
}

export function hasFullAdminAccess(user?: { role?: string | null } | null) {
    return isAdmin(user);
}

export function allowFullAdminAccess(user?: { role?: string | null } | null) {
    return hasFullAdminAccess(user);
}

export function requireActiveAdmin(user?: { role?: string | null; is_active?: boolean | null } | null) {
    if (!user || user.is_active === false) return "UNAUTHENTICATED" as const;
    return requireAdmin(user);
}

type SessionCookieScope = "admin" | "petugas" | "any";

export async function getAdminSession(request: NextRequest, options: { cookie?: SessionCookieScope } = {}) {
    const cookie = options.cookie ?? "any";
    const petugasId = cookie === "admin"
        ? request.cookies.get("tamsar_admin_session")?.value
        : cookie === "petugas"
            ? request.cookies.get("tamsar_petugas_session")?.value
            : request.cookies.get("tamsar_admin_session")?.value ?? request.cookies.get("tamsar_petugas_session")?.value;
    if (!petugasId) return { error: "UNAUTHENTICATED" as const, profile: null };

    const supabase = createSupabaseAdminClient();
    if (!supabase) return { error: "SUPABASE_NOT_CONFIGURED" as const, profile: null };

    const { data, error } = await supabase
        .from("petugas")
        .select("id,username,nama_lengkap,nip,jabatan,role,is_active")
        .eq("id", petugasId)
        .eq("is_active", true)
        .maybeSingle();

    if (error || !data || (!isAdminRole(data.role) && !isPetugasRole(data.role))) return { error: "FORBIDDEN" as const, profile: null };

    return { error: null, profile: data as PetugasProfile };
}

export function requirePetugas(user?: { role?: string | null } | null) {
    return isPetugas(user) ? null : "FORBIDDEN" as const;
}
