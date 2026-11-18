import type { Metadata } from "next";

import { getSiteUrl } from "@/server/site-url";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "Рублевка — загородный комплекс",
    template: "%s — Рублевка",
  },
  description:
    "Загородный комплекс для тихого отдыха и мероприятий в Волгоградской области.",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
