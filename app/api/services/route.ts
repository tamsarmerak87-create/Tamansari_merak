import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const supabase = createClient(url!, anon!);

    const { data, error } = await supabase
        .from("layanan")
        .select("*");

    return NextResponse.json({
        env: {
            url,
            anonExists: !!anon,
        },
        total: data?.length ?? 0,
        error,
        data,
    });
}