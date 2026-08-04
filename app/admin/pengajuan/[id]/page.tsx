import { AdminShell } from "@/components/admin/admin-shell";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <AdminShell view="detail" id={id} />;
}
