import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";
import { isPetugas } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";

const failedResponse = () => NextResponse.json({ ok: false, message: "Username atau password salah." }, { status: 401 });

export async function POST(request: NextRequest) {
    try {
        const body = (await request.json()) as { username?: string; password?: string };
        const username = body.username?.trim();
        const password = body.password ?? "";
        if (!username || !password) return failedResponse();

        const supabase = createSupabaseAdminClient();
        if (!supabase) return NextResponse.json({ ok: false, message: "Supabase service role belum dikonfigurasi." }, { status: 500 });

        const { data: petugas, error } = await supabase
            .from("petugas")
            .select("id,username,password_hash,nama_lengkap,nip,jabatan,role,is_active")
            .eq("username", username)
            .eq("is_active", true)
            .maybeSingle();

        if (error || !petugas?.password_hash || !isPetugas(petugas)) return failedResponse();
        const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(petugas.password_hash);
        const valid = isBcryptHash ? await bcrypt.compare(password, petugas.password_hash) : false;
        if (!valid) return failedResponse();

        const { password_hash: _passwordHash, ...safeProfile } = petugas;
        const response = NextResponse.json({ ok: true, user: { id: petugas.id, username: petugas.username }, profile: safeProfile });
        response.cookies.set("tamsar_petugas_session", petugas.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
        return response;
    } catch (error) {
        console.error("[petugas-login]", error);
        return failedResponse();
    }
}