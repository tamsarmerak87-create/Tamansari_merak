"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuthContextValue, WargaProfile } from "@/services/warga-auth.service";
import { createSupabaseBrowserClient } from "@/services/supabase";
import { getCurrentWarga } from "@/services/warga-auth.service";
import type { User } from "@supabase/supabase-js";

const WargaAuthContext = createContext<AuthContextValue>({ user: null, profile: null, loading: true, refresh: async () => undefined });

export function WargaAuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<WargaProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            setLoading(true);
            const current = await getCurrentWarga();
            setUser(current.user);
            setProfile(current.profile);
        } catch {
            setUser(null);
            setProfile(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timeout = window.setTimeout(() => { void refresh(); }, 0);
        const supabase = createSupabaseBrowserClient();
        if (!supabase) return () => window.clearTimeout(timeout);
        const { data } = supabase.auth.onAuthStateChange(() => { void refresh(); });
        return () => {
            window.clearTimeout(timeout);
            data.subscription.unsubscribe();
        };
    }, [refresh]);

    const value = useMemo(() => ({ user, profile, loading, refresh }), [user, profile, loading, refresh]);
    return <WargaAuthContext.Provider value={value}>{children}</WargaAuthContext.Provider>;
}

export function useWargaAuth() {
    return useContext(WargaAuthContext);
}