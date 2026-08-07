import { NextResponse, type NextRequest } from "next/server";
import { isPetugasRole } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";

export async function GET(request: NextRequest) {
    const petugasId = request.cookies.get("tamsar_admin_session")?.value;
    if (!petugasId) return NextResponse.json({ ok: false }, { status: 401 });

    const supabase = createSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ ok: false, message: "Supabase service role belum dikonfigurasi." }, { status: 500 });

    const { data: petugas, error } = await supabase
        .from("petugas")
        .select("*")
        .eq("id", petugasId)
        .eq("is_active", true)
        .maybeSingle();

    if (error) {
        console.error("[admin-me]", error);
        return NextResponse.json({ ok: false }, { status: 401 });
    }
    if (!petugas) return NextResponse.json({ ok: false }, { status: 401 });

    if (!isPetugasRole((petugas as { role?: string | null }).role)) {
        return NextResponse.json({ ok: false }, { status: 403 });
    }

    const { password_hash: _passwordHash, ...safeProfile } = petugas as { password_hash?: string; id: string; username: string };
    return NextResponse.json({
        ok: true,
        user: { id: safeProfile.id, username: safeProfile.username },
        profile: safeProfile,
    });
}