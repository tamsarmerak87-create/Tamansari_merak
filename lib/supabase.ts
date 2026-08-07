import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;

function logSupabaseEnvStatus() {
    console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log("Anon Key:", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    console.log("Service Key:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
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
    supabaseClient = createClient(url, anonKey);

    return supabaseClient;
}

export const supabase = createSupabaseClient();