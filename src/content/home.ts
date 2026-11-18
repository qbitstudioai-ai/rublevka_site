import type { MediaId } from "./media";

export type Entry = { title: string; media: MediaId };
export type Chapter = {
  id: string;
  label: string;
  title: string;
  text?: string;
  photo: MediaId;
  layout: "opening" | "index" | "closing";
  entries?: readonly Entry[];
};
export const chapters: readonly Chapter[] = [
  {
    id: "chapter-1",
    layout: "opening",
    label: "Там, где город замолкает",
    title: "Рублевка",
    text: "Уехать из города, чтобы услышать тишину",
    photo: "house-oaks",
  },
  {
    id: "chapter-2",
    layout: "index",
    label: "Место, где вас ждут",
    title: "Место, где вас ждут",
    photo: "gazebo-oaks",
    entries: [
      { title: "Домики", media: "house-oaks" },
      { title: "Беседки", media: "gazebo-oaks" },
      { title: "Банкетные залы", media: "banquet-hall" },
      { title: "Баня", media: "bath-complex" },
    ],
  },
  {
    id: "chapter-3",
    layout: "closing",
    label: "Тишина, которую хочется сохранить",
    title: "Тишина, которую хочется сохранить",
    text: "Дубовый лес. Тёплый свет. Время для себя.",
    photo: "oak-forest",
  },
];
