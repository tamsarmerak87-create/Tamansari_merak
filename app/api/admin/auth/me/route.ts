import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, requireAdmin } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";

export async function GET(request: NextRequest) {
    const session = await getAdminSession(request, { cookie: "admin" });
    if (session.error || !session.profile) return NextResponse.json({ ok: false }, { status: 401 });
    if (requireAdmin(session.profile)) return NextResponse.json({ ok: false }, { status: 403 });

    const petugasId = session.profile.id;

    const supabase = createSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ ok: false, message: "Supabase service role belum dikonfigurasi." }, { status: 500 });

    const { data: petugas, error } = await supabase
        .from("petugas")
        .select("id,username,nama_lengkap,nip,jabatan,role,is_active")
        .eq("id", petugasId)
        .eq("is_active", true)
        .maybeSingle();

    if (error) {
        console.error("[admin-me]", error);
        return NextResponse.json({ ok: false }, { status: 401 });
    }
    if (!petugas) return NextResponse.json({ ok: false }, { status: 401 });

    const safeProfile = petugas as { id: string; username: string };
    return NextResponse.json({
        ok: true,
        user: { id: safeProfile.id, username: safeProfile.username },
        profile: safeProfile,
    });
}