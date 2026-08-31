import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/services/supabase";
import { getMasterTemplateConfig } from "@/services/official-document";

export async function GET() {
    try {
        const client = createSupabaseAdminClient();
        if (!client) {
            return NextResponse.json({ ok: false, error: "Supabase service role belum dikonfigurasi." }, { status: 500 });
        }

        const { data, error } = await client
            .from("layanan")
            .select(`
                id,
                nama,
                deskripsi,
                aktif,
                persyaratan,
                alur,
                dasar_hukum,
                output,
                kanal,
                created_at
            `)
            .eq("aktif", true)
            .order("nama", { ascending: true });

        if (error) {
            console.error("SUPABASE LAYANAN SELECT ERROR");
            console.dir(error, { depth: null });
            throw error;
        }

        const serviceIds = (data ?? []).map((service) => service.id);
        const { data: templates, error: templateError } = serviceIds.length
            ? await client
                .from("service_templates")
                .select("service_id,template_id,template_version,field_schema,status,signer_role")
                .in("service_id", serviceIds)
                .eq("is_active", true)
            : { data: [], error: null };
        if (templateError) throw templateError;
        const byService = new Map((templates ?? []).map((template) => [template.service_id, template]));
        const result = (data ?? []).map((service) => {
            const template = byService.get(service.id);
            return {
                ...service,
                master_template: getMasterTemplateConfig(service.nama),
                template: template ? {
                    template_id: template.template_id,
                    version: template.template_version,
                    field_schema: template.field_schema ?? [],
                    status: template.status,
                    signer_role: template.signer_role,
                } : null,
            };
        });

        return NextResponse.json({ ok: true, data: result });
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