import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, isPetugasRole, requireAdmin } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";

type PetugasUpdatePayload = {
    nama_lengkap?: string;
    username?: string;
    nip?: string;
    jabatan?: string;
    role?: string;
    is_active?: boolean;
};

function jsonError(message: string, status = 400) {
    return NextResponse.json({ ok: false, message }, { status });
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const session = await getAdminSession(request);
    if (session.error) return jsonError("Session admin tidak valid.", 401);
    const adminOnlyError = requireAdmin(session.profile);
    if (adminOnlyError) return jsonError("Hanya Administrator yang dapat melihat detail petugas.", 403);
    const { id } = await context.params;
    const supabase = createSupabaseAdminClient();
    if (!supabase) return jsonError("Supabase service role belum dikonfigurasi.", 500);

    const { data, error } = await supabase
        .from("petugas")
        .select("id,username,nama_lengkap,nip,jabatan,role,is_active,created_at,updated_at")
        .eq("id", id)
        .maybeSingle();

    if (error) return jsonError(error.message, 500);
    if (!data) return jsonError("Petugas tidak ditemukan.", 404);
    return NextResponse.json({ ok: true, data });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const session = await getAdminSession(request);
    if (session.error) return jsonError("Session admin tidak valid.", 401);
    const adminOnlyError = requireAdmin(session.profile);
    if (adminOnlyError) return jsonError("Hanya Administrator yang dapat mengubah petugas.", 403);
    const { id } = await context.params;
    const body = (await request.json()) as PetugasUpdatePayload;
    const role = body.role?.trim();
    if (!isPetugasRole(role)) return jsonError(`Role tidak valid: ${role}`);

    const supabase = createSupabaseAdminClient();
    if (!supabase) return jsonError("Supabase service role belum dikonfigurasi.", 500);

    const payload = {
        username: body.username?.trim(),
        nama_lengkap: body.nama_lengkap?.trim(),
        nip: body.nip?.trim() || null,
        jabatan: body.jabatan?.trim() || null,
        role,
        is_active: body.is_active,
    };

    const { data, error } = await supabase
        .from("petugas")
        .update(payload)
        .eq("id", id)
        .select("id,username,nama_lengkap,nip,jabatan,role,is_active")
        .single();

    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true, data });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const session = await getAdminSession(request);
    if (session.error) return jsonError("Session admin tidak valid.", 401);
    const adminOnlyError = requireAdmin(session.profile);
    if (adminOnlyError) return jsonError("Hanya Administrator yang dapat menghapus petugas.", 403);
    const { id } = await context.params;
    const supabase = createSupabaseAdminClient();
    if (!supabase) return jsonError("Supabase service role belum dikonfigurasi.", 500);
    const { error } = await supabase.from("petugas").delete().eq("id", id);
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true });
}
