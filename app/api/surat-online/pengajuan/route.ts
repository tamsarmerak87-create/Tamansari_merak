import { NextResponse } from "next/server";
import { createSubmission } from "@/services/surat-online.service";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (process.env.NODE_ENV !== "production") {
      console.info("[PENGAJUAN REQUEST]", {
        endpoint: "/api/surat-online/pengajuan",
        contentType,
        payloadBytes: Number.isFinite(contentLength) ? contentLength : 0,
        hasMultipartFile: contentType.includes("multipart/form-data"),
      });
    }

    const body = contentType.includes("application/json")
      ? await request.json()
      : await request.formData();
    const data = await createSubmission(body);
    return NextResponse.json({
      ok: true,
      message: "Pengajuan berhasil dikirim.",
      data,
    }, { status: 201 });
  } catch (error) {
    console.error("[PENGAJUAN ERROR]", error);

    const message = error instanceof Error ? error.message : "Gagal mengirim pengajuan.";
    const status = message.includes("terlalu besar")
      ? 413
      : message.includes("wajib") || message.includes("tidak valid") || message.includes("harus") || message.includes("tidak ditemukan")
        ? 400
        : 500;

    return NextResponse.json(
      {
        ok: false,
        error: message,
        details: error instanceof Error && "details" in error ? error.details : undefined,
        hint: error instanceof Error && "hint" in error ? error.hint : undefined,
        code: error instanceof Error && "code" in error ? error.code : undefined,
      },
      { status },
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Gunakan POST untuk mengirim pengajuan." });
}
