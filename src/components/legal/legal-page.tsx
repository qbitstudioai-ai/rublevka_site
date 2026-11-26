import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GuideFooter, GuideHeader } from "@/components/guide/guide-page";
import { getSiteUrl } from "@/server/site-url";

type LegalDocument = {
  href: string;
  label: string;
  description: string;
};

export function legalMetadata({ href, label, description }: LegalDocument): Metadata {
  return { title: label, description, alternates: { canonical: href } };
}

export function LegalPage({ document, children }: { document: LegalDocument; children: ReactNode }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: document.label,
    description: document.description,
    url: new URL(document.href, getSiteUrl()).href,
    inLanguage: "ru",
  };

  return (
    <div className="guest-guide">
      <a href="#legal-content" className="guide-skip">К содержанию</a>
      <GuideHeader />
      <main id="legal-content" className="legal-page">
        <article className="legal-document">
          <h1>{document.label}</h1>
          {children}
        </article>
      </main>
      <GuideFooter />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
    </div>
  );
}
