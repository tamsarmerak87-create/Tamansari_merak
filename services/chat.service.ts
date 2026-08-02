import { agenda, news, services, site } from "@/constants/site";

export type ChatMessage = {
    role: "user" | "assistant";
    content: string;
};

const fallbackAnswer = "Maaf, informasi tersebut belum tersedia.\n\nSilakan hubungi petugas Kelurahan Tamansari melalui WhatsApp atau datang langsung ke kantor.";

const faq = [
    ["Bagaimana mengajukan surat online?", "Buka halaman Surat Online, pilih jenis surat, siapkan KTP/KK, formulir, dan dokumen pendukung, lalu kirim melalui kanal resmi."],
    ["Berapa lama proses administrasi?", "Proses dilakukan setelah berkas dinyatakan lengkap oleh petugas Kelurahan Tamansari."],
    ["Bagaimana mengirim pengaduan?", "Gunakan halaman Pengaduan atau WhatsApp resmi, sertakan identitas, uraian masalah, foto, dan lokasi bila ada."],
    ["Apa itu POSBANKUM?", "POSBANKUM adalah layanan konsultasi dan bantuan hukum warga melalui booking topik konsultasi serta tindak lanjut resmi."],
    ["Bagaimana melacak status surat?", "Gunakan halaman Surat Online atau kirim nomor permohonan kepada petugas. Jika nomor belum tersedia, petugas akan membantu pengecekan manual."],
];

const profileKnowledge = [
    `Nama: ${site.name}`,
    `Wilayah: ${site.district}, ${site.city}, Provinsi Banten`,
    `Alamat: ${site.address}`,
    `Telepon/WhatsApp: ${site.phone}`,
    `Email: ${site.email}`,
    "Jam pelayanan: Senin-Jumat 08.00-16.00 WIB, istirahat 12.00-13.00 WIB.",
    "Profil: Kelurahan Tamansari melayani administrasi, koordinasi kewilayahan, pemberdayaan masyarakat, ketenteraman, ketertiban, POSBANKUM, pengaduan, dan informasi publik.",
];

const knowledgeBase = [
    "SYSTEM KNOWLEDGE TAMSAR CS",
    ...profileKnowledge,
    "33 pelayanan dan layanan portal:",
    ...services.map((service, index) => {
        const flow = service.flow ?? [];
        return `${index + 1}. ${service.title}: ${service.description} Persyaratan: ${service.requirements.join(", ")}. Alur: ${flow.join(" -> ")}. Dasar hukum: ${service.legalBasis}. Output: ${service.output}. Kanal: ${service.channel}.`;
    }),
    "FAQ:",
    ...faq.map(([question, answer]) => `Q: ${question} A: ${answer}`),
    "POSBANKUM: booking jadwal, isi identitas dan topik konsultasi, konfirmasi petugas, konsultasi awal, tindak lanjut sesuai kewenangan kelurahan.",
    "Kontak kelurahan: WhatsApp/telepon, email resmi, dan kantor kelurahan.",
    "Berita:",
    ...news.map((item) => `${item.date} - ${item.title}: ${item.excerpt}`),
    "Agenda:",
    ...agenda.map((item) => `${item.date} - ${item.title} di ${item.location}`),
].join("\n");

const systemPrompt = `Nama AI: TAMSAR CS.
Role: Customer Service Digital Kelurahan Tamansari.
Selalu sopan, ramah, berbahasa Indonesia, dan menjawab singkat tetapi jelas.
Gunakan hanya knowledge resmi yang diberikan. Jika informasi tidak tersedia, jawab persis:
"${fallbackAnswer}"

${knowledgeBase}`;

function localAnswer(message: string) {
    const query = message.toLowerCase();
    const matchedService = services.find((service) => [service.title, service.id, service.category, service.description].join(" ").toLowerCase().includes(query) || query.includes(service.title.toLowerCase()));

    if (query.includes("33") || query.includes("layanan") || query.includes("pelayanan")) {
        return `Kelurahan Tamansari menyediakan ${services.length} layanan portal, antara lain:\n\n${services.map((service, index) => `${index + 1}. ${service.title}`).join("\n")}\n\nSilakan sebutkan nama layanan untuk melihat persyaratan, alur, dan dasar hukum.`;
    }

    if (matchedService || query.includes("persyaratan") || query.includes("syarat") || query.includes("alur") || query.includes("dasar hukum")) {
        const service = matchedService ?? services[0];
        const flow = service.flow ?? [];
        return `**${service.title}**\n\n${service.description}\n\n**Persyaratan:** ${service.requirements.join(", ")}\n\n**Alur pelayanan:** ${flow.join(" -> ")}\n\n**Dasar hukum:** ${service.legalBasis}\n\n**Kanal:** ${service.channel}`;
    }

    if (query.includes("lacak") || query.includes("status") || query.includes("tracking")) {
        return "Untuk melacak status surat, siapkan nomor permohonan atau identitas pengajuan. Jika nomor tersedia, kirimkan ke petugas melalui kanal Surat Online atau WhatsApp resmi Kelurahan Tamansari.";
    }

    if (query.includes("posbankum") || query.includes("hukum")) {
        return "POSBANKUM melayani konsultasi bantuan hukum warga. Alurnya: booking jadwal, isi identitas dan topik konsultasi, konfirmasi petugas, konsultasi awal, lalu tindak lanjut sesuai kewenangan kelurahan.";
    }

    if (query.includes("kontak") || query.includes("whatsapp") || query.includes("telepon") || query.includes("email")) {
        return `Kontak resmi Kelurahan Tamansari:\n\n- WhatsApp/Telepon: ${site.phone}\n- Email: ${site.email}\n- Alamat: ${site.address}`;
    }

    if (query.includes("jam") || query.includes("buka")) {
        return "Jam pelayanan Kelurahan Tamansari: Senin-Jumat 08.00-16.00 WIB, istirahat 12.00-13.00 WIB.";
    }

    return fallbackAnswer;
}

async function callOpenAi(messages: ChatMessage[]) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
            model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
            messages: [{ role: "system", content: systemPrompt }, ...messages],
            temperature: 0.2,
            max_tokens: 650,
        }),
    });

    if (!response.ok) return null;
    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? null;
}

async function callGemini(messages: ChatMessage[]) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const text = [systemPrompt, ...messages.map((message) => `${message.role}: ${message.content}`)].join("\n\n");
    const model = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 650 } }),
    });

    if (!response.ok) return null;
    const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return data.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n") ?? null;
}

export async function getTamsarCsReply(messages: ChatMessage[]) {
    const latest = messages.at(-1)?.content?.trim();
    if (!latest) return fallbackAnswer;

    try {
        const provider = (process.env.AI_PROVIDER ?? "local").toLowerCase();
        const aiReply = provider.includes("openai") ? await callOpenAi(messages) : provider.includes("gemini") ? await callGemini(messages) : null;
        return aiReply?.trim() || localAnswer(latest);
    } catch {
        return localAnswer(latest);
    }
}