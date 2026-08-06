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
      console.error("SUPABASE ADMIN SELECT ERROR");
      console.dir(error, { depth: null });
      throw error;
    }

    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (error) {
    console.error("===== FULL ERROR =====");
    console.dir(error, { depth: null });

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
            : error,
      },
      { status: 500 },
    );
  }
}
