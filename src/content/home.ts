import type { MediaId } from "./media";
import type { SectionId } from "./sections";

export type Entry = { title: string; section: SectionId };
type ChapterHeading = {
  id: string;
  label: string;
  title: string;
};
export type PhotoChapter = ChapterHeading & {
  text?: string;
  photo: MediaId;
  layout: "opening" | "index" | "closing";
  entries?: readonly Entry[];
};
export type ManifestoChapter = ChapterHeading & {
  layout: "manifesto";
  subtitle: string;
  paragraphs: string[];
  emphasis: string;
  closing: string;
  quote: string;
};
export type Chapter = PhotoChapter | ManifestoChapter;

export const manifestoChapter: ManifestoChapter = {
  id: "chapter-4",
  layout: "manifesto",
  label: "Душа Рублевки",
  title: "Что такое загородный комплекс «РУБЛЕВКА»?",
  subtitle: "Душевная теплота, дружеское отношение и уважение к каждому Гостю!",
  paragraphs: [
    "«Рублевка» — это больше, чем место для загородного отдыха. Это место, где каждому Гостю искренне рады. Где встречают с душой, заботятся от сердца и уважают ваше желание побыть в тишине.",
    "Мы верим, что настоящее гостеприимство невозможно передать одними лишь красивыми словами. Оно чувствуется в мелочах: в тёплой встрече, добром взгляде, искренней улыбке, внимании и заботе.",
    "Для нас это не просто правила хорошего обслуживания.",
    "Оставьте за воротами городскую суету, бесконечные дела и шумные улицы. Поживите в уютном деревянном срубе, вдохните свежий воздух, послушайте шелест вековых дубов.",
    "Побудьте с близкими. Побудьте наедине с собой. Просто отдохните душой.",
  ],
  emphasis: "МЫ ТАК ЖИВЁМ. МЫ ТАК ПРИНИМАЕМ ГОСТЕЙ!",
  closing: "Приезжайте в «Рублевку». Здесь вас ждут.",
  quote: "«Уехать из города, чтобы услышать тишину. Приехать в „Рублевку“, чтобы почувствовать себя как дома».",
};

export const chapters: readonly Chapter[] = [
  {
    id: "chapter-1",
    layout: "opening",
    label: "Там, где город замолкает",
    title: "Рублевка",
    text: "Уехать из города, чтобы услышать тишину",
    photo: "book-opening-house",
  },
  {
    id: "chapter-2",
    layout: "index",
    label: "Место, где вас ждут",
    title: "Место, где вас ждут",
    photo: "book-autumn-gazebo",
    entries: [
      { title: "Домики", section: "prozhivanie" },
      { title: "Беседки", section: "besedki" },
      { title: "Банкетные залы", section: "banketnye-zaly" },
      { title: "Баня", section: "banya" },
    ],
  },
  {
    id: "chapter-3",
    layout: "closing",
    label: "Тишина, которую хочется сохранить",
    title: "Тишина, которую хочется сохранить",
    text: "Дубовый лес. Тёплый свет. Время для себя.",
    photo: "book-golden-grove",
  },
  manifestoChapter,
];
