# Portal Digital Kelurahan Tamansari

Rebuild total untuk Kelurahan Tamansari, Kecamatan Pulomerak, Kota Cilegon.

## Status Implementasi
- App Router sudah disiapkan.
- Halaman publik, admin skeleton, API route dasar, service layer, dan data contoh sudah tersedia.
- Legacy HTML/CSS/JS telah dihapus dari root repository.

## Stack Target
- Next.js App Router
- React terbaru
- TypeScript strict
- Tailwind CSS
- Supabase
- Shadcn UI
- Motion / GSAP / Lenis
- Zustand, TanStack Query, React Hook Form, Zod

## Struktur
- `app/`
- `components/`
- `features/`
- `services/`
- `hooks/`
- `utils/`
- `types/`
- `constants/`
- `public/`
- `styles/`

## Run Local
```bash
npm install
npm run dev
```

## Deploy
### Vercel
1. Push ke GitHub.
2. Import ke Vercel.
3. Isi variabel environment dari `.env.example`.

### Netlify
1. Build command: `npm run build`
2. Publish directory: `.next`

### GitHub Pages
Disarankan hanya untuk versi static marketing. Untuk API, auth, dan dashboard gunakan Vercel.

## Integrasi
- Supabase: Auth, Storage, PostgreSQL, Realtime, RLS, Trigger.
- n8n: webhook surat, pengaduan, POSBANKUM, AI, WhatsApp.
- Evolution API: WhatsApp gateway.
- Chatwoot: live chat dan operator inbox.
- Gemini / OpenAI: TAMSAR AI.
- Google Maps: lokasi kantor, RT/RW, dan rute.

## Catatan
Dokumentasi arsitektur, database, workflow, backup, restore, dan SOP maintenance dapat ditambahkan pada iterasi berikutnya.
