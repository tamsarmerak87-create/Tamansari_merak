import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";
import { isAdmin, isPetugas } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { createPortalSessionToken } from "@/lib/portal-session-token";

const CREDENTIAL_ERROR = "Username atau password salah.";
const NETWORK_ERROR = "Layanan sedang mengalami gangguan koneksi. Silakan coba kembali beberapa saat lagi.";
const CONFIGURATION_ERROR = "Konfigurasi layanan belum tersedia.";
const INTERNAL_ERROR = "Terjadi gangguan internal. Silakan coba kembali beberapa saat lagi.";

const failedResponse = () => NextResponse.json({ ok: false, message: CREDENTIAL_ERROR }, { status: 401 });

function supabaseHostname() {
    try {
        return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname || "unknown";
    } catch {
        return "unknown";
    }
}

function errorText(error: unknown) {
    if (!error || typeof error !== "object") return "";
    const candidate = error as { message?: unknown; cause?: { message?: unknown; code?: unknown } };
    return [candidate.message, candidate.cause?.message, candidate.cause?.code].filter((value): value is string => typeof value === "string").join(" ");
}

function isConfigurationError(error: unknown) {
    return /belum dikonfigurasi|invalid url|invalid supabase url|supabase url/i.test(errorText(error));
}

function isSupabaseNetworkError(error: unknown) {
    return /fetch failed|enotfound|econnrefused|etimedout|timeout|network|dns|failed to fetch/i.test(errorText(error));
}

function isSupabaseServerError(error: unknown) {
    if (!error || typeof error !== "object") return false;
    const candidate = error as { status?: unknown; statusCode?: unknown; code?: unknown };
    const status = Number(candidate.status ?? candidate.statusCode);
    return (Number.isFinite(status) && status >= 500) || /\b5\d{2}\b/.test(errorText(error));
}

function operationalErrorResponse(error: unknown) {
    if (isConfigurationError(error)) {
        console.error("[petugas-login] supabase_configuration_error", { name: error instanceof Error ? error.name : "Error", hostname: supabaseHostname(), endpoint: "/rest/v1/petugas" });
        return NextResponse.json({ ok: false, message: CONFIGURATION_ERROR }, { status: 500 });
    }
    if (isSupabaseNetworkError(error) || isSupabaseServerError(error)) {
        console.error("[petugas-login] supabase_network_error", { name: error instanceof Error ? error.name : "Error", message: errorText(error).slice(0, 300), hostname: supabaseHostname(), endpoint: "/rest/v1/petugas" });
        return NextResponse.json({ ok: false, message: NETWORK_ERROR }, { status: 503 });
    }
    console.error("[petugas-login] internal_error", { name: error instanceof Error ? error.name : "Error" });
    return NextResponse.json({ ok: false, message: INTERNAL_ERROR }, { status: 500 });
}

export async function POST(request: NextRequest) {
    try {
        const body = (await request.json()) as { username?: string; password?: string };
        const username = body.username?.trim();
        const password = body.password ?? "";
        if (!username || !password) return failedResponse();

        const supabase = createSupabaseAdminClient();
        if (!supabase) return NextResponse.json({ ok: false, message: CONFIGURATION_ERROR }, { status: 500 });

        const { data: petugas, error } = await supabase
            .from("petugas")
            .select("id,username,password_hash,nama_lengkap,nip,jabatan,role,is_active")
            .eq("username", username)
            .eq("is_active", true)
            .maybeSingle();

        if (error) return operationalErrorResponse(error);
        if (!petugas?.password_hash || isAdmin(petugas) || !isPetugas(petugas)) return failedResponse();
        const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(petugas.password_hash);
        const valid = isBcryptHash ? await bcrypt.compare(password, petugas.password_hash) : false;
        if (!valid) return failedResponse();

        const { password_hash: _passwordHash, ...safeProfile } = petugas;
        const response = NextResponse.json({ ok: true, user: { id: petugas.id, username: petugas.username }, profile: safeProfile });
        response.cookies.set("tamsar_petugas_session", await createPortalSessionToken(petugas.id), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
        response.cookies.delete("tamsar_admin_session");
        return response;
    } catch (error) {
        return operationalErrorResponse(error);
    }
}