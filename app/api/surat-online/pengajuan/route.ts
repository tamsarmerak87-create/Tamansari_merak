import { NextResponse } from "next/server";
import { createSubmission } from "@/services/surat-online.service";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const data = await createSubmission(formData);
    return NextResponse.json({
      ok: true,
      message: "Pengajuan berhasil dikirim.",
      data,
    });
  } catch (error) {
    console.error("[PENGAJUAN ERROR]", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal mengirim pengajuan.",
        details: error instanceof Error && "details" in error ? error.details : undefined,
        hint: error instanceof Error && "hint" in error ? error.hint : undefined,
        code: error instanceof Error && "code" in error ? error.code : undefined,
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Gunakan POST untuk mengirim pengajuan." });
}
