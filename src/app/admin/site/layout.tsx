import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./admin.css";

export const metadata: Metadata = {
  title: { default: "Управление сайтом", template: "%s · Управление сайтом" },
  robots: { index: false, follow: false },
};

export default function SiteAdminLayout({ children }: { children: ReactNode }) {
  return children;
}
