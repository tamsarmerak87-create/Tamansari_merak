const SESSION_TTL_SECONDS = 60 * 60 * 8;

function secret() {
    const value = process.env.TAMSAR_SESSION_SECRET;
    if (!value && process.env.NODE_ENV === "production") throw new Error("TAMSAR_SESSION_SECRET belum dikonfigurasi.");
    return value || "development-only-tamsar-session-secret";
}

function encode(value: string) {
    return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decode(value: string) {
    return atob(value.replace(/-/g, "+").replace(/_/g, "/"));
}

async function signature(payload: string) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
    return encode(String.fromCharCode(...bytes));
}

export async function createPortalSessionToken(id: string) {
    const payload = `${id}.${Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS}`;
    return `${payload}.${await signature(payload)}`;
}

export async function verifyPortalSessionToken(token?: string | null) {
    if (!token) return null;
    try {
        const parts = token.split(".");
        if (parts.length !== 3 || !parts[0] || !/^\d+$/.test(parts[1])) return null;
        if (Number(parts[1]) < Math.floor(Date.now() / 1000)) return null;
        const expected = await signature(`${parts[0]}.${parts[1]}`);
        if (expected.length !== parts[2].length) return null;
        let mismatch = 0;
        for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ parts[2].charCodeAt(i);
        return mismatch === 0 ? parts[0] : null;
    } catch {
        return null;
    }
}
