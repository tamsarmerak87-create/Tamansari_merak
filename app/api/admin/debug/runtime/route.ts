import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, requireAdmin } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";

const RUNTIME_AUDIT_TARGET = "d481e74e-d960-4c60-a195-5921198439ae";

function supabaseMetadata() {
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    try {
        const parsed = new URL(rawUrl);
        return {
            host: parsed.hostname,
            projectReference: parsed.hostname.split(".")[0] || "unknown",
        };
    } catch {
        return { host: "unknown", projectReference: "unknown" };
    }
}

export async function GET(request: NextRequest) {
    if (process.env.NODE_ENV !== "development") {
        return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
    }

    const session = await getAdminSession(request, { cookie: "admin" });
    if (session.error || !session.profile) {
        return NextResponse.json({ ok: false, error: "Session admin tidak valid." }, { status: 401 });
    }
    if (requireAdmin(session.profile)) {
        return NextResponse.json({ ok: false, error: "Akses khusus admin." }, { status: 403 });
    }

    const metadata = supabaseMetadata();
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
        .from("pengajuan_surat")
        .select("id,status,nomor_pengajuan")
        .eq("id", RUNTIME_AUDIT_TARGET)
        .maybeSingle();

    console.log("[RUNTIME AUDIT]", {
        pid: process.pid,
        supabase_project: metadata.projectReference,
        target_found: Boolean(data),
        query_error_code: error?.code ?? null,
    });

    if (error) {
        return NextResponse.json(
            { ok: false, error: { code: error.code ?? "UNKNOWN", message: error.message ?? "Runtime audit query failed." } },
            { status: 500 },
        );
    }

    return NextResponse.json({
        ok: true,
        runtime: {
            pid: process.pid,
            supabase_project_reference: metadata.projectReference,
            supabase_host: metadata.host,
        },
        target: {
            id: RUNTIME_AUDIT_TARGET,
            found: Boolean(data),
            status: data?.status ?? null,
            nomor_pengajuan_present: Boolean(data?.nomor_pengajuan),
        },
    });
}