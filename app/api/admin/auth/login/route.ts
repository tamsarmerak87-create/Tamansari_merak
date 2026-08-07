import { compare } from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/services/supabase";

type PetugasRow = {
    id: string;
    username: string;
    password_hash: string;
    is_active?: boolean | null;
    role?: string | null;
};

const failedResponse = () => NextResponse.json({ ok: false, message: "Username atau password salah." }, { status: 401 });

export async function POST(request: NextRequest) {
    try {
        const body = (await request.json()) as { username?: string; password?: string };
        const inputUsername = body.username?.trim();
        const password = body.password ?? "";

        if (!inputUsername || !password) return failedResponse();

        const supabase = createSupabaseAdminClient();
        if (!supabase) return NextResponse.json({ ok: false, message: "Supabase service role belum dikonfigurasi." }, { status: 500 });

        const { data: petugas, error } = await supabase
            .from("petugas")
            .select("*")
            .eq("username", inputUsername)
            .eq("is_active", true)
            .maybeSingle();

        if (error) {
            console.error("[admin-login]", error);
            return failedResponse();
        }

        const row = petugas as PetugasRow | null;
        if (!row?.password_hash) return failedResponse();

        const passwordValid = await compare(password, row.password_hash);
        if (!passwordValid) return failedResponse();

        const { password_hash: _passwordHash, ...safeProfile } = row;
        const response = NextResponse.json({
            ok: true,
            user: { id: row.id, username: row.username },
            profile: safeProfile,
        });
        response.cookies.set("tamsar_admin_session", row.id, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 60 * 60 * 8,
        });
        return response;
    } catch (error) {
        console.error("[admin-login]", error);
        return failedResponse();
    }
}