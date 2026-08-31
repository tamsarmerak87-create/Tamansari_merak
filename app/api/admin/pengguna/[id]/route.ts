import { NextResponse, type NextRequest } from "next/server";
import { canManageUsers, getAdminSession } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { isWargaEmploymentStatus, isWargaMaritalStatus, isWargaReligion, normalizeWargaEmploymentStatus } from "@/lib/warga-profile-options";

const editableFields = [
    "nama_lengkap", "nik", "email", "nomor_hp", "nomor_whatsapp", "nomor_kk",
    "tempat_lahir", "tanggal_lahir", "jenis_kelamin", "alamat", "rt", "rw",
    "kelurahan", "kecamatan", "agama", "status_perkawinan", "status_pekerjaan",
] as const;

function jsonError(message: string, status: number) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

async function authorize(request: NextRequest) {
    const session = await getAdminSession(request, { cookie: "admin" });
    if (session.error || !session.profile) return { error: jsonError("Session admin tidak valid.", 401) };
    if (!canManageUsers(session.profile)) return { error: jsonError("Akses khusus admin.", 403) };
    return { error: null };
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const access = await authorize(request);
    if (access.error) return access.error;

    const { id } = await context.params;
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return jsonError("Payload tidak valid.", 400);

    const updates: Record<string, string | null> = {};
    for (const field of editableFields) {
        if (!(field in body)) continue;
        if (typeof body[field] !== "string" && body[field] !== null) return jsonError(`Field ${field} tidak valid.`, 400);
        const value = typeof body[field] === "string" ? body[field].trim() : null;
        updates[field] = value || null;
    }
    if (!updates.nama_lengkap || !updates.nik || !updates.email) return jsonError("Nama lengkap, NIK, dan email wajib diisi.", 400);
    if (!updates.status_perkawinan || !isWargaMaritalStatus(updates.status_perkawinan)) return jsonError("Status perkawinan tidak valid.", 400);
    if (updates.agama && !isWargaReligion(updates.agama)) return jsonError("Agama tidak valid.", 400);
    updates.status_pekerjaan = normalizeWargaEmploymentStatus(updates.status_pekerjaan) || null;
    if (!updates.status_pekerjaan || !isWargaEmploymentStatus(updates.status_pekerjaan)) return jsonError("Status pekerjaan tidak valid.", 400);

    const supabase = createSupabaseAdminClient();
    const { data: existing, error: existingError } = await supabase
        .from("warga_profiles")
        .select("id,email")
        .eq("id", id)
        .maybeSingle();
    if (existingError) return jsonError(existingError.message, 500);
    if (!existing) return jsonError("Pengguna tidak ditemukan.", 404);

    if (updates.email !== existing.email) {
        const { error: authError } = await supabase.auth.admin.updateUserById(id, { email: updates.email ?? undefined });
        if (authError) return jsonError(authError.message, 400);
    }

    const { data, error } = await supabase
        .from("warga_profiles")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
    if (error) return jsonError(error.message, 400);
    return NextResponse.json({ ok: true, data });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const access = await authorize(request);
    if (access.error) return access.error;

    const { id } = await context.params;
    const supabase = createSupabaseAdminClient();
    const { data: existing, error: existingError } = await supabase
        .from("warga_profiles")
        .select("id")
        .eq("id", id)
        .maybeSingle();
    if (existingError) return jsonError(existingError.message, 500);
    if (!existing) return jsonError("Pengguna tidak ditemukan.", 404);

    // Removing the Auth user also removes its profile through the existing FK cascade.
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) return jsonError(error.message, 400);
    return NextResponse.json({ ok: true });
}