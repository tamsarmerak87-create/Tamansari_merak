import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/services/supabase";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() ?? "";
    if (!query) {
      return NextResponse.json({ ok: false, error: "Query pencarian wajib diisi." }, { status: 400 });
    }

    const client = createSupabaseAdminClient();
    if (!client) {
      return NextResponse.json({ ok: false, error: "Supabase service role belum dikonfigurasi." }, { status: 500 });
    }

    const { data, error } = await client
      .from("pengajuan_surat")
      .select("*, tracking_pengajuan(*)")
      .or(`nomor_pengajuan.eq.${query},nik.eq.${query}`)
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Gagal mengambil data layanan." }, { status: 500 });
  }
}
