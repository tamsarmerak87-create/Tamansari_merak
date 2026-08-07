import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, isPetugasRole } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";

type PetugasPayload = {
    nama_lengkap?: string;
    username?: string;
    password?: string;
    nip?: string;
    jabatan?: string;
    role?: string;
    is_active?: boolean;
};

function jsonError(message: string, status = 400) {
    return NextResponse.json({ ok: false, message }, { status });
}

export async function GET(request: NextRequest) {
    const session = await getAdminSession(request);
    if (session.error) return jsonError("Session admin tidak valid.", 401);
    const supabase = createSupabaseAdminClient();
    if (!supabase) return jsonError("Supabase service role belum dikonfigurasi.", 500);

    const { data, error } = await supabase
        .from("petugas")
        .select("id,username,nama_lengkap,nip,jabatan,role,is_active,created_at,updated_at")
        .order("nama_lengkap", { ascending: true });

    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true, data: data ?? [] });
}

export async function POST(request: NextRequest) {
    const session = await getAdminSession(request);
    if (session.error) return jsonError("Session admin tidak valid.", 401);
    const supabase = createSupabaseAdminClient();
    if (!supabase) return jsonError("Supabase service role belum dikonfigurasi.", 500);

    const body = (await request.json()) as PetugasPayload;
    const username = body.username?.trim();
    const password = body.password ?? "";
    const namaLengkap = body.nama_lengkap?.trim();
    const role = body.role?.trim();

    if (!username || !password || !namaLengkap || !isPetugasRole(role)) {
        return jsonError("Nama lengkap, username, password, dan role wajib diisi.");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
        .from("petugas")
        .insert({
            username,
            password_hash: passwordHash,
            nama_lengkap: namaLengkap,
            nip: body.nip?.trim() || null,
            jabatan: body.jabatan?.trim() || null,
            role,
            is_active: body.is_active ?? true,
        })
        .select("id,username,nama_lengkap,nip,jabatan,role,is_active")
        .single();

    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true, data });
}
