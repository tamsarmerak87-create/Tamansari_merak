import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/types";

type AuthCredentials = { email: string; password: string };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function createSupabaseBrowserClient() {
    if (!supabaseUrl || !supabaseAnonKey) return null;
    return createClient(supabaseUrl, supabaseAnonKey);
}

export function createSupabaseServerClient() {
    if (!supabaseUrl || !supabaseAnonKey) return null;
    return createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
}

export function createSupabaseAdminClient() {
    if (!supabaseUrl || !supabaseServiceKey) return null;
    return createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
}

function requireClient(client: SupabaseClient | null) {
    if (!client) throw new Error("Supabase env belum dikonfigurasi.");
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
        const { data } = await client.from("admin_profiles").select("role").eq("user_id", user.user.id).maybeSingle();
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