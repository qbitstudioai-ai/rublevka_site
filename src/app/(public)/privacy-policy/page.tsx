import { LegalPage, legalMetadata } from "@/components/legal/legal-page";
import { PrivacyPolicyText } from "@/content/legal-documents";
import { privacyLinks } from "../../../../events-original/lib/shared/privacy-links";

import "../[section]/guide.css";
import "../legal.css";

const document = {
  ...privacyLinks[0],
  description: "Политика загородного комплекса «Рублевка» в отношении обработки персональных данных.",
};

export const metadata = legalMetadata(document);

export default function PrivacyPolicyPage() {
  return (
    <LegalPage document={document}>
      <PrivacyPolicyText />
    </LegalPage>
  );
}
