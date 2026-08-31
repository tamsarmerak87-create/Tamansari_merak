import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, requireAdmin } from "@/services/admin-session";
import { createSupabaseAdminClient } from "@/services/supabase";
import { assertTemplateContentSafe, getMasterTemplateConfig, type TemplateField, validateReadyTemplate } from "@/services/official-document";

type Context = { params: Promise<{ id: string }> };
type TemplatePayload = {
    template_id?: string;
    template_version?: number;
    field_schema?: TemplateField[];
    template_content?: string | null;
    source_reference?: string | null;
    signer_role?: "LURAH";
    numbering_config?: { classification?: string; suffix?: string; width?: number } | null;
    status?: "READY" | "DRAFT" | "PERLU REVIEW" | "TEMPLATE BELUM TERSEDIA" | "ARCHIVED";
};

function error(message: string, status = 400) {
    return NextResponse.json({ ok: false, error: message }, { status });
}

async function authorize(request: NextRequest) {
    const session = await getAdminSession(request, { cookie: "admin" });
    if (session.error) return { response: error("Session admin tidak valid.", 401) };
    const adminError = requireAdmin(session.profile);
    if (adminError) return { response: error("Hanya admin yang dapat mengelola template.", 403) };
    const supabase = createSupabaseAdminClient();
    if (!supabase) return { response: error("Supabase service role belum dikonfigurasi.", 500) };
    return { supabase };
}

export async function GET(request: NextRequest, context: Context) {
    const auth = await authorize(request);
    if ("response" in auth) return auth.response;
    const { id } = await context.params;
    const [{ data: service, error: serviceError }, { data: templates, error: templateError }] = await Promise.all([
        auth.supabase.from("layanan").select("id,nama,aktif").eq("id", id).maybeSingle(),
        auth.supabase.from("service_templates").select("*").eq("service_id", id).order("template_version", { ascending: false }),
    ]);
    if (serviceError || templateError) return error((serviceError ?? templateError)!.message, 500);
    if (!service) return error("Layanan tidak ditemukan.", 404);
    return NextResponse.json({ ok: true, data: { service, masterTemplate: getMasterTemplateConfig(service.nama), templates: templates ?? [] } });
}

export async function PUT(request: NextRequest, context: Context) {
    const auth = await authorize(request);
    if ("response" in auth) return auth.response;
    const { id } = await context.params;
    const body = await request.json().catch(() => ({})) as TemplatePayload;
    const templateId = String(body.template_id ?? "").trim();
    const version = Number(body.template_version);
    const content = String(body.template_content ?? "").trim();
    const source = String(body.source_reference ?? "").trim();
    const schema = Array.isArray(body.field_schema) ? body.field_schema : [];
    const status = body.status ?? "DRAFT";
    if (!templateId || !/^[A-Z][A-Z0-9_]*$/.test(templateId)) return error("Template ID wajib berupa huruf kapital, angka, dan underscore.");
    if (!Number.isInteger(version) || version < 1) return error("Versi template harus bilangan bulat positif.");
    if (!["READY", "DRAFT", "PERLU REVIEW", "TEMPLATE BELUM TERSEDIA", "ARCHIVED"].includes(status)) return error("Status template tidak valid.");
    if (content) {
        try { assertTemplateContentSafe(content, schema); } catch (e) { return error(e instanceof Error ? e.message : "Placeholder template tidak valid.", 422); }
    }
    if (status === "READY") {
        try { validateReadyTemplate({ templateId, version, content, source, schema, signerRole: body.signer_role, numbering: body.numbering_config }); }
        catch (e) { return error(e instanceof Error ? e.message : "Dependency template READY belum lengkap.", 422); }
    }
    const { data: service } = await auth.supabase.from("layanan").select("id,nama,aktif").eq("id", id).maybeSingle();
    if (!service) return error("Layanan tidak ditemukan.", 404);
    if (status === "READY" && service.aktif === false) return error("Template tidak dapat READY karena layanan tidak aktif.", 422);
    const { data: saved, error: saveError } = await auth.supabase.from("service_templates").upsert({
        service_id: id, service_name: service.nama, template_id: templateId, template_version: version,
        field_schema: schema, template_content: content || null, source_reference: source || null, numbering_config: body.numbering_config ?? null,
        signer_role: "LURAH", status, is_active: true, updated_at: new Date().toISOString(),
    }, { onConflict: "service_id,template_version" }).select("*").single();
    if (saveError) return error(saveError.message, 500);
    const { error: deactivateError } = await auth.supabase.from("service_templates").update({ is_active: false }).eq("service_id", id).neq("id", saved.id);
    if (deactivateError) return error(deactivateError.message, 500);
    return NextResponse.json({ ok: true, data: saved });
}