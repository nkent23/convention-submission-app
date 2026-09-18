"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const items = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/schools", label: "Schools" },
  { href: "/admin/organizations", label: "Organizations" },
  { href: "/admin/import", label: "Bulk Import" },
  { href: "/admin/audit", label: "Audit Log" },
  { href: "/admin/admins", label: "Admins" },
];

export default function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <aside className="flex min-h-screen w-60 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-4">
        <p className="font-semibold text-ehs-700">Convention Portal</p>
        <p className="truncate text-xs text-gray-500">{email}</p>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded-lg px-3 py-2 text-sm font-medium ${
              pathname === item.href
                ? "bg-ehs-50 text-ehs-800"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-gray-200 p-3">
        <button
          onClick={logout}
          className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
