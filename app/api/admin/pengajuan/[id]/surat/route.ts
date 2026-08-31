import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, requireAdmin } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { isFinalDocument } from "@/services/official-document";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function error(message: string, status: number) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getAdminSession(request, { cookie: "admin" });
    if (session.error || !session.profile) return error("Sesi admin tidak valid.", 401);
    if (requireAdmin(session.profile)) return error("Akses khusus admin.", 403);

    const { id } = await params;
    if (!UUID_REGEX.test(id)) return error("ID pengajuan tidak valid.", 400);

    const supabase = createSupabaseAdminClient();
    if (!supabase) return error("Supabase service role belum dikonfigurasi.", 500);

    const { data, error: queryError } = await supabase
        .from("pengajuan_surat")
        .select("status,document_locked,issued_at,verification_token,final_pdf_url")
        .eq("id", id)
        .maybeSingle();
    if (queryError) return error(queryError.message, 500);
    if (!isFinalDocument(data)) return error("Surat final tidak tersedia.", 404);

    const target = `/api/surat/${data.verification_token}/pdf${request.nextUrl.searchParams.get("download") === "1" ? "?download=1" : ""}`;
    return NextResponse.redirect(new URL(target, request.url));
}