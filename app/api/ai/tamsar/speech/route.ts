import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const body = await request.json() as { text?: string };
        const text = typeof body.text === "string" ? body.text.trim().slice(0, 1800) : "";
        const key = process.env.OPENAI_API_KEY;
        if (!text) return NextResponse.json({ ok: false, error: "Teks kosong." }, { status: 400 });
        if (!key) return NextResponse.json({ ok: false, error: "OPENAI_API_KEY belum dikonfigurasi." }, { status: 503 });
        const response = await fetch("https://api.openai.com/v1/audio/speech", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.TAMSAR_TTS_MODEL || "gpt-4o-mini-tts", voice: process.env.TAMSAR_VOICE || "nova", input: text, response_format: "mp3" }) });
        if (!response.ok) return NextResponse.json({ ok: false, error: "Suara TAMSAR sedang tidak tersedia." }, { status: 503 });
        return new Response(await response.arrayBuffer(), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
    } catch { return NextResponse.json({ ok: false, error: "Suara TAMSAR sedang tidak tersedia." }, { status: 503 }); }
}