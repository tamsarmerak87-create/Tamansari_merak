import { NextResponse } from "next/server";
import { createSubmission } from "@/services/surat-online.service";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const data = await createSubmission(formData);
    return NextResponse.json({ ok: true, data });
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

export async function GET() {
  return NextResponse.json({ ok: true, message: "Gunakan POST untuk mengirim pengajuan." });
}
