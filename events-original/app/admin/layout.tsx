import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "Админпанель — Рублёвка",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-root">{children}</div>;
}
