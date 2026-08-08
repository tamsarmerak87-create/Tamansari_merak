import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;

function logSupabaseEnvStatus() {
    console.log("[SUPABASE CONFIG]", {
        hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    });
}

function getSupabaseConfig() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    logSupabaseEnvStatus();

    if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL belum dikonfigurasi. Browser client tidak dapat mengirim request ke Supabase.");
    if (!anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY belum dikonfigurasi. Browser client membutuhkan anon key untuk header apikey.");

    return { url, anonKey };
}

export function createSupabaseClient() {
    if (supabaseClient) return supabaseClient;

    const { url, anonKey } = getSupabaseConfig();
    supabaseClient = createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });

    return supabaseClient;
}