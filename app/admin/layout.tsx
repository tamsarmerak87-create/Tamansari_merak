import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Portal Admin | Kelurahan Tamansari",
    description: "Portal admin dan petugas Kelurahan Tamansari untuk verifikasi warga dan pelayanan digital.",
};

export default function AdminPortalLayout({ children }: { children: React.ReactNode }) {
    return children;
}