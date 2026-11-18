import type { MediaId } from "./media";

export const chapterLinks = [
  { number: "I", href: "#chapter-1", label: "Там, где город замолкает" },
  { number: "II", href: "#chapter-2", label: "Место, где вас ждут" },
  { number: "III", href: "#chapter-3", label: "Тишина, которую хочется сохранить" },
] as const;

export type Experience = {
  id: string;
  title: string;
  mediaId: MediaId;
  layout: "hero" | "standard" | "wide";
};

export const experiences: readonly Experience[] = [
  { id: "houses", title: "Домики", mediaId: "house-oaks", layout: "hero" },
  { id: "gazebos", title: "Беседки", mediaId: "gazebo-oaks", layout: "standard" },
  { id: "bath", title: "Банный комплекс", mediaId: "bath-complex", layout: "standard" },
  { id: "halls", title: "Банкетные залы", mediaId: "banquet-hall", layout: "wide" },
] as const;
