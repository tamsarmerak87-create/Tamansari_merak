function normalizeUrl(value: string) {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return withProtocol.replace(/\/+$/, "");
}

export function getSiteUrl() {
    const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_VERCEL_URL;
    if (configured) return normalizeUrl(configured);
    if (typeof window !== "undefined") return window.location.origin;
    if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
    throw new Error("NEXT_PUBLIC_SITE_URL belum dikonfigurasi.");
}

export function getTrustedSiteUrl() {
    const value = getSiteUrl();
    if (!/^https?:\/\//i.test(value)) throw new Error("Konfigurasi URL aplikasi tidak valid.");
    return value;
}

export function getAuthRedirectUrl() {
    return `${getTrustedSiteUrl()}/verify`;
}

export function isGoogleLoginConfigured() {
    return process.env.NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED === "true";
}