import type { Metadata } from "next";
import "./admin.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Управление мероприятиями",
  robots: { index: false, follow: false },
};
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="office">
      <a className="office-skip" href="#office-main">
        К содержанию
      </a>
      <main id="office-main" className="office-sheet">
        {children}
      </main>
    </div>
  );
}
