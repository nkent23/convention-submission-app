import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import AdminSidebar from "./sidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <AdminSidebar email={admin.email} />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
