import { LegalPage, legalMetadata } from "@/components/legal/legal-page";
import { PersonalDataAgreementText } from "@/content/legal-documents";
import { privacyLinks } from "../../../../events-original/lib/shared/privacy-links";

import "../[section]/guide.css";
import "../legal.css";

const document = {
  ...privacyLinks[1],
  description: "Условия согласия на обработку персональных данных загородным комплексом «Рублевка».",
};

export const metadata = legalMetadata(document);

export default function PersonalDataAgreementPage() {
  return (
    <LegalPage document={document}>
      <PersonalDataAgreementText />
    </LegalPage>
  );
}
