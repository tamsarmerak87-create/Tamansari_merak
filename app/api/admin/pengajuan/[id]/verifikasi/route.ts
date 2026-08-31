import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, isPetugas } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { isFinalDocument } from "@/services/official-document";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getAdminSession(request, { cookie: "any" });
    if (session.error || !session.profile || !isPetugas(session.profile)) return NextResponse.json({ ok: false, error: "Sesi admin tidak valid." }, { status: 401 });
    const { id } = await params;
    if (!UUID_REGEX.test(id)) return NextResponse.json({ ok: false, error: "ID pengajuan tidak valid." }, { status: 400 });
    const { data, error } = await createSupabaseAdminClient().from("pengajuan_surat").select("status,document_locked,issued_at,verification_token").eq("id", id).maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!isFinalDocument(data)) return NextResponse.json({ ok: false, error: "Surat final tidak tersedia." }, { status: 404 });
    return NextResponse.redirect(new URL(`/verifikasi/${data.verification_token}`, request.url));
}