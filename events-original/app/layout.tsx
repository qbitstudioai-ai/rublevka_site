import type { Metadata } from "next";
import { GuestAssistant } from "../components/GuestAssistant";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL?.trim() || "http://localhost:3000"),
  robots: { index: false, follow: false },
  title: "Регистрация участников — Встреча на Рублёвке",
  description: "Анкета регистрации участников мероприятия загородного комплекса «Рублёвка» с выбором дополнительных активностей.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" data-scroll-behavior="smooth">
      <body>{children}<GuestAssistant /></body>
    </html>
  );
}
