export async function forwardToN8n(path: string, payload: unknown) {
    const base = process.env.N8N_BASE_URL;
    if (!base) return { skipped: true, reason: "N8N_BASE_URL belum diisi" };
    const res = await fetch(`${base.replace(/\/$/, "")}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    return { status: res.status, ok: res.ok };
}