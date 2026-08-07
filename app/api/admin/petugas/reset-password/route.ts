import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";

function jsonError(message: string, status = 400) {
    return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(request: NextRequest) {
    const session = await getAdminSession(request);
    if (session.error) return jsonError("Session admin tidak valid.", 401);
    const body = (await request.json()) as { id?: string; passwordBaru?: string; password?: string };
    const id = body.id;
    const passwordBaru = body.passwordBaru ?? body.password ?? "";
    if (!id || passwordBaru.length < 6) return jsonError("ID petugas dan password baru minimal 6 karakter wajib diisi.");

    const supabase = createSupabaseAdminClient();
    if (!supabase) return jsonError("Supabase service role belum dikonfigurasi.", 500);

    const passwordHash = await bcrypt.hash(passwordBaru, 10);
    const { error } = await supabase.from("petugas").update({ password_hash: passwordHash }).eq("id", id);
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true });
}
