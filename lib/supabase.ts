import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;

function getSupabaseConfig() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
        throw new Error("Supabase environment variables are not configured.");
    }

    return { url, anonKey };
}

export function createSupabaseClient() {
    if (supabaseClient) return supabaseClient;

    const { url, anonKey } = getSupabaseConfig();
    supabaseClient = createClient(url, anonKey);

    return supabaseClient;
}

export const supabase = createSupabaseClient();