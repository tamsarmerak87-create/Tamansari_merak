import { NextResponse } from "next/server";
import { createSubmission } from "@/services/surat-online.service";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const data = await createSubmission(formData);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("===== SURAT ONLINE ERROR =====");
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        stack: process.env.NODE_ENV === "development"
          ? (error instanceof Error ? error.stack : undefined)
          : undefined,
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Gunakan POST untuk mengirim pengajuan." });
}
