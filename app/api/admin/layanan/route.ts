import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";

type LayananPayload = {
    nama?: string;
    aktif?: boolean;
};

function jsonError(message: string, status = 400) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
    const session = await getAdminSession(request);
    if (session.error) return jsonError("Session admin tidak valid.", 401);

    const supabase = createSupabaseAdminClient();
    if (!supabase) return jsonError("Supabase service role belum dikonfigurasi.", 500);

    const body = (await request.json()) as LayananPayload;
    const nama = body.nama?.trim();
    if (!nama) return jsonError("Nama layanan wajib diisi.");

    const { data, error } = await supabase
        .from("layanan")
        .insert({ nama, aktif: body.aktif ?? true })
        .select("id,nama,aktif,created_at")
        .single();

    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true, data });
}
