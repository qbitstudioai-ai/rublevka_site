import type { Metadata } from "next";
import Link from "next/link";
import { GuideHeader } from "@/components/guide/guide-page";
import { StayForm } from "@/components/booking/stay-form";
import { configuredMode } from "@/components/booking/provider";
import "../[section]/guide.css";
import "./stay.css";
export const metadata: Metadata = {
  title: "Выбор дат проживания",
  description:
    "Подберите даты, состав гостей и тип размещения для обращения к администратору Рублевки.",
  alternates: { canonical: "/bronirovanie" },
  robots: { index: false, follow: false },
};
export default function Booking() {
  return (
    <div className="guest-guide">
      <GuideHeader />
      <main className="guide-body stay-main">
        <Link href="/prozhivanie" className="back-to-book">
          ← К домам и номерам
        </Link>
        <h1>Выбрать даты</h1>
        <StayForm mode={configuredMode(process.env.BOOKING_PROVIDER)} />
      </main>
    </div>
  );
}
