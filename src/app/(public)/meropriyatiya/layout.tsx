import type { ReactNode } from "react";
import { GuideHeader } from "@/components/guide/guide-page";
import { BookReturn } from "@/components/guide/book-return";
import { reception } from "@/content/guest-guide";
import "../[section]/guide.css";
import "./events.css";
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="guest-guide festivities">
      <a className="guide-skip" href="#fest-main">
        К содержанию
      </a>
      <GuideHeader id="meropriyatiya" />
      <main id="fest-main" className="guide-body">
        {children}
      </main>
      <footer className="guide-footer">
        <BookReturn />
        <address>{reception.address}</address>
        <a href={reception.tel}>{reception.phone}</a>
      </footer>
    </div>
  );
}
