import { ZodError } from "zod";

const unsafePatterns = [/ZodError/i, /too_small/i, /invalid_type/i, /required/i, /Expected /i, /Failed to fetch/i, /PGRST/i, /AuthApiError/i, /JWT/i, /Supabase/i, /stack/i, /database/i, /warga_profiles/i, /pengajuan_surat/i];

export function getFriendlyMessage(error: unknown, fallback = "Terjadi kendala. Silakan coba lagi.") {
    if (error instanceof ZodError) return error.issues[0]?.message || "Data yang dimasukkan belum benar.";
    const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
    if (!message || unsafePatterns.some((pattern) => pattern.test(message))) return fallback;
    if (/invalid login credentials/i.test(message)) return "Email/NIK atau password salah. Silakan periksa kembali.";
    if (/user not found|tidak ditemukan/i.test(message)) return "Akun belum terdaftar. Silakan daftar terlebih dahulu.";
    if (/email.*registered|already registered|duplicate/i.test(message)) return "Email sudah terdaftar. Silakan masuk.";
    return message;
}

export function apiErrorMessage(error: unknown, fallback = "Permintaan belum berhasil diproses. Silakan coba lagi.") {
    console.error("[app-error]", error);
    return getFriendlyMessage(error, fallback);
}
