import { NextResponse } from "next/server";
import { createSubmission, removeSubmissionAttachments } from "@/services/surat-online.service";
import { createSupabaseAdminClient } from "@/services/supabase";

const FILE_PATH_KEYS = ["file_ktp", "file_kk", "file_pendukung"] as const;

function collectUploadedPaths(body: unknown) {
  if (!body || typeof body !== "object") return [];
  return FILE_PATH_KEYS.map((key) => (body as Record<string, unknown>)[key]).filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { ok: false, error: "Endpoint pengajuan hanya menerima JSON data teks dan path file. Upload file harus langsung ke Supabase Storage bucket surat." },
        { status: 415 },
      );
    }

    const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: "Sesi warga tidak ditemukan. Silakan login kembali." }, { status: 401 });
    }
    const { data: authData, error: authError } = await createSupabaseAdminClient().auth.getUser(accessToken);
    if (authError || !authData.user) return NextResponse.json({ ok: false, error: "Sesi warga tidak valid. Silakan login kembali." }, { status: 401 });

    const body = await request.json();
    const uploadedPaths = collectUploadedPaths(body);
    let data;
    try {
      data = await createSubmission(body, authData.user.id);
    } catch (error) {
      if (uploadedPaths.length > 0) await removeSubmissionAttachments(uploadedPaths).catch(() => console.error("[PENGAJUAN CLEANUP ERROR]", { cleanupFailed: true }));
      throw error;
    }
    return NextResponse.json({
      ok: true,
      message: "Pengajuan berhasil dikirim.",
      data,
    }, { status: 201 });
  } catch (error) {
    const errorRecord = error && typeof error === "object" ? error as Record<string, unknown> : null;
    const message = error instanceof Error
      ? error.message
      : typeof errorRecord?.message === "string"
        ? errorRecord.message
        : "Gagal mengirim pengajuan.";
    console.error("[SURAT ONLINE POST ERROR]", {
      validationError: error instanceof Error && error.name === "ZodError",
    });

    const status = message.includes("terlalu besar")
      ? 413
      : message.includes("wajib") || message.includes("tidak valid") || message.includes("harus") || message.includes("tidak ditemukan")
        ? 400
        : 500;
    const publicMessage = status === 500 ? "Gagal mengirim pengajuan." : message;

    return NextResponse.json(
      {
        ok: false,
        error: publicMessage,
      },
      { status },
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Gunakan POST untuk mengirim pengajuan." });
}
