import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const key = process.env.OPENAI_API_KEY;
        if (!key) return NextResponse.json({ ok: false, error: "OPENAI_API_KEY belum dikonfigurasi." }, { status: 503 });
        const incoming = await request.formData();
        const audio = incoming.get("audio");
        if (!(audio instanceof File) || audio.size > 10 * 1024 * 1024) return NextResponse.json({ ok: false, error: "Audio tidak valid atau terlalu besar." }, { status: 400 });
        const form = new FormData(); form.append("file", audio); form.append("model", process.env.TAMSAR_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe"); form.append("language", "id");
        const response = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
        if (!response.ok) return NextResponse.json({ ok: false, error: "Audio belum dapat dipahami." }, { status: 503 });
        const data = await response.json() as { text?: string };
        return NextResponse.json({ ok: true, text: data.text ?? "" });
    } catch { return NextResponse.json({ ok: false, error: "Transkripsi gagal. Silakan ketik pertanyaan." }, { status: 503 }); }
}