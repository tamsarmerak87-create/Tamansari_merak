import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/services/supabase";

export async function GET() {
  try {
    const client = createSupabaseAdminClient();
    if (!client) {
      return NextResponse.json({ ok: false, error: "Supabase service role belum dikonfigurasi." }, { status: 500 });
    }

    const { data, error } = await client
      .from("pengajuan_surat")
      .select("*, layanan(*)")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Gagal mengambil data pengajuan." }, { status: 500 });
  }
}
