import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";

function jsonError(message: string, status = 400) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
    const session = await getAdminSession(request);
    if (session.error) return jsonError("Session admin tidak valid.", 401);

    const supabase = createSupabaseAdminClient();
    if (!supabase) return jsonError("Supabase service role belum dikonfigurasi.", 500);

    const formData = await request.formData();
    const pengajuanId = String(formData.get("pengajuan_id") ?? "");
    const file = formData.get("file") as File | null;

    if (!pengajuanId || !file) return jsonError("ID pengajuan dan file wajib diisi.");

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `pendukung/${pengajuanId}-${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("surat").upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) return jsonError(uploadError.message, 500);

    const url = supabase.storage.from("surat").getPublicUrl(path).data.publicUrl;
    const { data, error: insertError } = await supabase
        .from("dokumen_pengajuan")
        .insert({ pengajuan_id: pengajuanId, nama_file: file.name, jenis: "Hasil Surat", url_file: url })
        .select("*")
        .single();

    if (insertError) return jsonError(insertError.message, 500);
    return NextResponse.json({ ok: true, data, url });
}
