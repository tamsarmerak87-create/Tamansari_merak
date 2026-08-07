import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/services/supabase";

export async function GET() {
    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase
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
        .order("nama", { ascending: true });

    return NextResponse.json({
        env: {
            url: process.env.NEXT_PUBLIC_SUPABASE_URL,
            anonExists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            serviceExists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        },
        total: data?.length ?? 0,
        error,
        data,
    });
}