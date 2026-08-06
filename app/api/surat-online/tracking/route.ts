import { NextResponse } from "next/server";
import { searchSubmission } from "@/services/surat-online.service";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() ?? "";
    if (!query) {
      return NextResponse.json({ ok: false, error: "Query pencarian wajib diisi." }, { status: 400 });
    }

    const data = await searchSubmission(query);

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Gagal mengambil data layanan." }, { status: 500 });
  }
}
