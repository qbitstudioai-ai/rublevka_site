import type { Metadata } from "next";
import Link from "next/link";
import { GuideFooter, GuideHeader } from "@/components/guide/guide-page";
import { StayForm } from "@/components/booking/stay-form";
import {
  publicContent,
  contactLinks,
  catalogFor,
  catalogAsset,
} from "@/server/cms/public";
import { roomLabels, type Room } from "@/content/stay-request";
import { configuredMode } from "@/components/booking/provider";
import "../[section]/guide.css";
import "./stay.css";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Выбор дат проживания",
  description:
    "Подберите даты, состав гостей и тип размещения для обращения к администратору Рублевки.",
  alternates: { canonical: "/bronirovanie" },
  robots: { index: false, follow: false },
};
export default async function Booking() {
  const [contacts, media, book, lodging] = await Promise.all([
    publicContent("contacts"),
    publicContent("media"),
    publicContent("book"),
    publicContent("prozhivanie"),
  ]);
  const contact = contactLinks(contacts);
  const catalog = catalogFor(media.items);
  const cover = book.chapters[0];
  const labels: Record<Room, string> = { ...roomLabels };
  for (const item of lodging.items) {
    if (item.room) labels[item.room] = item.name;
  }
  return (
    <div className="guest-guide">
      <GuideHeader />
      <main className="guide-body stay-main">
        <Link href="/prozhivanie" className="back-to-book">
          ← К домам и номерам
        </Link>
        <h1>Выбрать даты</h1>
        <StayForm
          mode={configuredMode(process.env.BOOKING_PROVIDER)}
          contact={{ tel: contact.tel, email: contact.email }}
          roomLabels={labels}
          photo={
            catalog["house-oaks"] ??
            catalogAsset(catalog, cover.layout === "manifesto" ? lodging.photo : cover.photo)
          }
        />
      </main>
      <GuideFooter contact={contact} />
    </div>
  );
}
