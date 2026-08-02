import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { site } from "@/constants/site";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { FloatingActions } from "@/components/common/floating-actions";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-plus-jakarta", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });

export const metadata: Metadata = {
    title: `${site.name} | ${site.district}`,
    description: "Portal pemerintahan digital Kelurahan Tamansari untuk layanan surat, pengaduan, POSBANKUM, berita, agenda, dan informasi publik.",
    manifest: "/manifest.json",
    openGraph: { title: site.name, description: "Pelayanan Digital Cepat, Mudah, Transparan, 24 Jam", type: "website", locale: "id_ID" },
    twitter: { card: "summary_large_image", title: site.name },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    const jsonLd = { "@context": "https://schema.org", "@type": "GovernmentOffice", name: site.name, address: site.address, telephone: site.phone };
    return <html lang="id" className={`${jakarta.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning><body className="font-sans antialiased"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><Navbar />{children}<Footer /><FloatingActions /></body></html>;
}