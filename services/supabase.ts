import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/types";

type AuthCredentials = { email: string; password: string };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let browserClient: SupabaseClient | null = null;

export function logSupabaseEnvStatus() {
    console.log("[SUPABASE CONFIG]", {
        hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    });
}

function requireSupabaseUrl() {
    if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL belum dikonfigurasi. Isi environment variable Supabase URL sebelum membuat client.");
    return supabaseUrl;
}

function requireSupabaseAnonKey() {
    if (!supabaseAnonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY belum dikonfigurasi. Browser/Server anon client membutuhkan Supabase anon key untuk header apikey.");
    return supabaseAnonKey;
}

function requireSupabaseServiceKey() {
    if (!supabaseServiceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi. Admin/server privileged client membutuhkan service role key untuk header apikey dan Authorization.");
    return supabaseServiceKey;
}

export function createSupabaseBrowserClient() {
    if (browserClient) return browserClient;
    logSupabaseEnvStatus();
    browserClient = createClient(requireSupabaseUrl(), requireSupabaseAnonKey(), {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    return browserClient;
}

export function createSupabaseServerClient() {
    logSupabaseEnvStatus();
    return createClient(requireSupabaseUrl(), requireSupabaseServiceKey(), { auth: { persistSession: false } });
}

export function createSupabaseAdminClient() {
    logSupabaseEnvStatus();
    return createClient(requireSupabaseUrl(), requireSupabaseServiceKey(), { auth: { persistSession: false } });
}

function requireClient(client: SupabaseClient) {
    return client;
}

export function logSupabaseError(error: unknown, context?: string) {
    if (!error) return;
    console.error(`[Supabase${context ? `:${context}` : ""}]`, error);
}

export const authService = {
    signIn: ({ email, password }: AuthCredentials) => requireClient(createSupabaseBrowserClient()).auth.signInWithPassword({ email, password }),
    signOut: () => requireClient(createSupabaseBrowserClient()).auth.signOut(),
    getSession: () => requireClient(createSupabaseBrowserClient()).auth.getSession(),
    getUser: () => requireClient(createSupabaseBrowserClient()).auth.getUser(),
};

export const roleService = {
    canManage: (role?: UserRole) => role === "super_admin" || role === "admin",
    canPublish: (role?: UserRole) => role === "super_admin" || role === "admin" || role === "editor",
    canRead: (role?: UserRole) => Boolean(role),
    async getCurrentRole() {
        const client = requireClient(createSupabaseBrowserClient());
        const { data: user } = await client.auth.getUser();
        if (!user.user) return null;
        const { data } = await client.from("petugas").select("role").eq("id", user.user.id).maybeSingle();
        return data?.role as UserRole | null;
    },
};

export const storageService = {
    upload: (bucket: string, path: string, file: File | Blob) => requireClient(createSupabaseBrowserClient()).storage.from(bucket).upload(path, file, { upsert: true }),
    remove: (bucket: string, paths: string[]) => requireClient(createSupabaseBrowserClient()).storage.from(bucket).remove(paths),
    getPublicUrl(bucket: string, path: string) {
        return requireClient(createSupabaseBrowserClient()).storage.from(bucket).getPublicUrl(path).data.publicUrl;
    },
};

export function subscribeToTable(table: string, onChange: () => void): RealtimeChannel {
    const client = requireClient(createSupabaseBrowserClient());
    return client.channel(`${table}:changes`).on("postgres_changes", { event: "*", schema: "public", table }, onChange).subscribe();
}