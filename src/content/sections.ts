// Compact navigation data is also used by the book's client-side contents dialog.
export const sections = {
  prozhivanie: "Проживание",
  besedki: "Беседки",
  "banketnye-zaly": "Банкетные залы",
  banya: "Баня",
  uslugi: "Услуги",
  galereya: "Галерея",
  kontakty: "Контакты",
} as const;
export type SectionId = keyof typeof sections;
export const sectionIds = Object.keys(sections) as SectionId[];
