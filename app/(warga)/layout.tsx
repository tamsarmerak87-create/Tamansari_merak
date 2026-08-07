import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
    title: "Portal Warga",
    description: "Portal Pelayanan Digital Kelurahan Tamansari",
};

export default function WargaLayout({ children }: { children: ReactNode }) {
    return <>{children}</>;
}
