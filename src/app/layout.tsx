import type { Metadata } from "next";
import { GuestAssistant } from "../../events-original/components/GuestAssistant";

import { getSiteUrl, isIndexingEnabled } from "@/server/site-url";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "Рублевка — загородный комплекс",
    template: "%s — Рублевка",
  },
  description:
    "Загородный комплекс для тихого отдыха и мероприятий в Волгоградской области.",
  robots: {
    index: isIndexingEnabled,
    follow: isIndexingEnabled,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}<GuestAssistant /></body>
    </html>
  );
}
