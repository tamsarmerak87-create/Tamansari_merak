import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { site } from "@/constants/site";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { FloatingActions } from "@/components/common/floating-actions";
import { TamsarChatWidget } from "@/components/chat/tamsar-chat-widget";
import { WargaAuthProvider } from "@/components/auth/warga-auth-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
    title: `${site.name} | Portal Pelayanan Digital`,
    description: "Portal pelayanan digital Kelurahan Tamansari untuk 33 pelayanan administrasi, pengajuan surat online, pengaduan, POSBANKUM, dan TAMSAR CS.",
    manifest: "/manifest.json",
    openGraph: { title: site.name, description: "Portal Pelayanan Digital Kelurahan Tamansari", type: "website", locale: "id_ID" },
    twitter: { card: "summary_large_image", title: site.name },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    const jsonLd = { "@context": "https://schema.org", "@type": "GovernmentOffice", name: site.name, address: site.address, telephone: site.phone };

    return (
        <html lang="id" className={inter.variable} suppressHydrationWarning>
            <body className="font-sans antialiased">
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
                <WargaAuthProvider>
                    <Navbar />
                    {children}
                    <Footer />
                    <FloatingActions />
                    <TamsarChatWidget />
                </WargaAuthProvider>
            </body>
        </html>
    );
}