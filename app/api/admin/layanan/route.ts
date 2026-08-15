import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, requireAdmin } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";

type LayananPayload = {
    id?: string;
    nama?: string;
    deskripsi?: string | null;
    persyaratan?: string | string[] | null;
    alur?: string | null;
    dasar_hukum?: string | null;
    output?: string | null;
    kanal?: string | null;
    aktif?: boolean;
};

const LAYANAN_SELECT = "id,nama,deskripsi,aktif,persyaratan,alur,dasar_hukum,output,kanal,created_at";

function cleanText(value: unknown) {
    if (value === undefined) return undefined;
    const trimmed = String(value ?? "").trim();
    return trimmed || null;
}

function cleanRequirements(value: LayananPayload["persyaratan"]) {
    if (value === undefined) return undefined;
    if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
    const text = cleanText(value);
    return text ? text.split("\n").map((item) => item.trim()).filter(Boolean) : [];
}

function jsonError(message: string, status = 400) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
    const session = await getAdminSession(request, { cookie: "admin" });
    if (session.error) return jsonError("Session admin tidak valid.", 401);
    const adminOnlyError = requireAdmin(session.profile);
    if (adminOnlyError) return jsonError("Hanya admin yang dapat mengelola layanan.", 403);

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


export async function PUT(request: NextRequest) {
    const session = await getAdminSession(request, { cookie: "admin" });
    if (session.error) return jsonError("Session admin tidak valid.", 401);
    if (requireAdmin(session.profile)) return jsonError("Hanya admin yang dapat mengelola layanan.", 403);

    const supabase = createSupabaseAdminClient();
    if (!supabase) return jsonError("Supabase service role belum dikonfigurasi.", 500);

    const body = (await request.json()) as LayananPayload;
    if (!body.id) return jsonError("ID layanan wajib diisi.");
    const nama = body.nama?.trim();
    if (!nama) return jsonError("Nama layanan wajib diisi.");

    const updatePayload: Record<string, unknown> = { nama };
    for (const key of ["deskripsi", "alur", "dasar_hukum", "output", "kanal"] as const) {
        const value = cleanText(body[key]);
        if (value !== undefined) updatePayload[key] = value;
    }
    const persyaratan = cleanRequirements(body.persyaratan);
    if (persyaratan !== undefined) updatePayload.persyaratan = persyaratan;
    if (typeof body.aktif === "boolean") updatePayload.aktif = body.aktif;

    const { data, error } = await supabase.from("layanan").update(updatePayload).eq("id", body.id).select(LAYANAN_SELECT).single();
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true, data });
}

export async function DELETE(request: NextRequest) {
    const session = await getAdminSession(request, { cookie: "admin" });
    if (session.error) return jsonError("Session admin tidak valid.", 401);
    if (requireAdmin(session.profile)) return jsonError("Hanya admin yang dapat menghapus layanan.", 403);

    const id = new URL(request.url).searchParams.get("id");
    if (!id) return jsonError("ID layanan wajib diisi.");

    const supabase = createSupabaseAdminClient();
    if (!supabase) return jsonError("Supabase service role belum dikonfigurasi.", 500);

    const { count, error: countError } = await supabase.from("pengajuan_surat").select("id", { count: "exact", head: true }).eq("layanan_id", id);
    if (countError) return jsonError(countError.message, 500);
    if ((count ?? 0) > 0) {
        const { data, error } = await supabase.from("layanan").update({ aktif: false }).eq("id", id).select(LAYANAN_SELECT).single();
        if (error) return jsonError(error.message, 500);
        return NextResponse.json({ ok: true, softDeleted: true, data });
    }

    const { error } = await supabase.from("layanan").delete().eq("id", id);
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true, deleted: true });
}
