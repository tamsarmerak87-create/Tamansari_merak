import { ZodError } from "zod";

const unsafePatterns = [/ZodError/i, /too_small/i, /invalid_type/i, /required/i, /Expected /i, /Failed to fetch/i, /PGRST/i, /AuthApiError/i, /JWT/i, /Supabase/i, /stack/i, /database/i, /warga_profiles/i, /pengajuan_surat/i];

function getRateLimitMessage(error: unknown) {
    const candidate = error as { message?: unknown; status?: unknown; statusCode?: unknown } | null;
    const message = candidate?.message instanceof String ? candidate.message.toString() : error instanceof Error ? error.message : typeof error === "string" ? error : "";
    const status = candidate?.status ?? candidate?.statusCode;
    if (!(status === 429 || /only request this after|rate\s*limit|too many requests/i.test(message))) return null;

    const seconds = message.match(/after\s+(\d+)\s*seconds?/i)?.[1];
    return seconds
        ? `Silakan tunggu ${seconds} detik sebelum meminta link reset password lagi.`
        : "Silakan tunggu beberapa saat sebelum meminta link reset password lagi.";
}

export function getFriendlyMessage(error: unknown, fallback = "Terjadi kendala. Silakan coba lagi.") {
    if (error instanceof ZodError) return error.issues[0]?.message || "Data yang dimasukkan belum benar.";
    const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
    const rateLimitMessage = getRateLimitMessage(error);
    if (rateLimitMessage) return rateLimitMessage;
    if (!message || unsafePatterns.some((pattern) => pattern.test(message))) return fallback;
    if (/invalid login credentials/i.test(message)) return "Email atau password tidak valid.";
    if (/email not confirmed|email.*confirm/i.test(message)) return "Email Anda belum dikonfirmasi.";
    if (/unsupported provider|provider.*not enabled/i.test(message)) return "Login dengan Google belum tersedia. Silakan gunakan login email dan password.";
    if (/expired|otp.*invalid|token.*invalid/i.test(message)) return "Link sudah kedaluwarsa. Silakan minta link baru.";
    if (/user not found|tidak ditemukan/i.test(message)) return "Akun belum terdaftar. Silakan daftar terlebih dahulu.";
    if (/email.*registered|already registered|duplicate/i.test(message)) return "Email sudah terdaftar. Silakan masuk.";
    return message;
}

export function apiErrorMessage(error: unknown, fallback = "Permintaan belum berhasil diproses. Silakan coba lagi.") {
    console.error("[app-error]", error);
    return getFriendlyMessage(error, fallback);
}
