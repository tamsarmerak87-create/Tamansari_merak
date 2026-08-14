import type { Metadata } from "next";
import "./globals.css";
import { site } from "@/constants/site";
import { PortalChrome } from "@/components/layout/portal-chrome";
import { ToastProvider } from "@/components/ui/toast-provider";

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
        <html lang="id" suppressHydrationWarning>
            <body className="font-sans antialiased">
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
                <ToastProvider><PortalChrome>{children}</PortalChrome></ToastProvider>
            </body>
        </html>
    );
}