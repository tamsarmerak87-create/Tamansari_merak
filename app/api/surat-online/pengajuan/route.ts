import { NextResponse } from "next/server";
import { createSubmission, removeSubmissionAttachments } from "@/services/surat-online.service";

const FILE_PATH_KEYS = ["file_ktp", "file_kk", "file_pendukung"] as const;

function collectUploadedPaths(body: unknown) {
  if (!body || typeof body !== "object") return [];
  return FILE_PATH_KEYS.map((key) => (body as Record<string, unknown>)[key]).filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

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

    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { ok: false, error: "Endpoint pengajuan hanya menerima JSON data teks dan path file. Upload file harus langsung ke Supabase Storage bucket surat." },
        { status: 415 },
      );
    }

    const body = await request.json();
    const uploadedPaths = collectUploadedPaths(body);
    let data;
    try {
      data = await createSubmission(body);
    } catch (error) {
      if (uploadedPaths.length > 0) await removeSubmissionAttachments(uploadedPaths).catch((cleanupError) => console.error("[PENGAJUAN CLEANUP ERROR]", cleanupError));
      throw error;
    }
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
