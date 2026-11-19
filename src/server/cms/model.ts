import { z } from "zod";
import type { GuideItem, GuidePage } from "@/content/guest-guide";
import type { Chapter } from "@/content/home";
import { mediaCatalog, type MediaAsset } from "@/content/media";
import { sections, type SectionId } from "@/content/sections";
import { roomLabels } from "@/content/stay-request";

export type CmsItem = Omit<GuideItem, "photo"> & {
  id: string;
  photo?: string;
  visible: boolean;
};
export type CmsGuide = Omit<GuidePage, "items" | "photo" | "gallery"> & {
  photo: string;
  items: CmsItem[];
  gallery?: string[];
  body?: string;
  indexable: boolean;
};
export type CmsChapter = Omit<Chapter, "photo"> & {
  photo: string;
  caption?: string;
};
export type CmsBook = {
  chapters: CmsChapter[];
  title: string;
  description: string;
  indexable: boolean;
};
export type CmsContacts = {
  phone: string;
  email: string;
  location: string;
  address: string;
  latitude: number;
  longitude: number;
  socials: { name: string; url: string }[];
};
export type CmsMedia = MediaAsset & { name: string };
export type SiteKey = SectionId | "book" | "contacts" | "media";
export type SiteData = Record<SectionId, CmsGuide> & {
  book: CmsBook;
  contacts: CmsContacts;
  media: { items: CmsMedia[] };
};

export class CmsError extends Error {}

export function hasSiteKey(key: string): key is SiteKey {
  return (
    key === "book" ||
    key === "contacts" ||
    key === "media" ||
    Object.hasOwn(sections, key)
  );
}

const text = (limit: number) => z.string().trim().min(1).max(limit);
const optionalText = (limit: number) => z.string().trim().max(limit).optional();
const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/u);
const rooms = z.enum(["room", "cottage", "bedrooms", "family"]);
const section = z.enum([
  "prozhivanie",
  "besedki",
  "banketnye-zaly",
  "banya",
  "uslugi",
  "galereya",
  "kontakty",
]);
const actions = {
  prozhivanie: "stay",
  besedki: "enquire",
  "banketnye-zaly": "enquire",
  banya: "enquire",
  uslugi: "enquire",
  galereya: "photos",
  kontakty: "map",
} as const;
const seo = {
  title: text(140),
  description: text(320),
  indexable: z.boolean(),
};
const guideSchema = z.object({
  ...seo,
  heading: text(100),
  intro: text(1000),
  body: optionalText(12000),
  photo: id,
  caption: text(300),
  action: z.enum(["stay", "enquire", "map", "photos"]),
  section: text(100),
  items: z
    .array(
      z.object({
        id,
        name: text(120),
        description: text(5000),
        detail: optionalText(1000),
        room: rooms.optional(),
        photo: id.optional(),
        visible: z.boolean(),
      }),
    )
    .max(100),
  gallery: z.array(id).max(250).optional(),
});

const layouts = ["opening", "index", "closing"] as const;
const bookSchema = z.object({
  ...seo,
  chapters: z
    .array(
      z.object({
        id,
        layout: z.enum(layouts),
        label: text(80),
        title: text(80),
        text: optionalText(180),
        photo: id,
        caption: optionalText(160),
        entries: z
          .array(z.object({ title: text(40), section }))
          .max(4)
          .optional(),
      }),
    )
    .length(3),
});

const socialHosts = [
  "t.me",
  "vk.com",
  "vk.ru",
  "max.ru",
  "ok.ru",
  "dzen.ru",
  "rutube.ru",
  "youtube.com",
];
const contactsSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^[+\d() .-]{10,30}$/u)
    .refine((value) => /^(?:7|8)\d{10}$/u.test(value.replace(/\D/g, ""))),
  email: z.email().max(160),
  location: text(160),
  address: text(300),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  socials: z
    .array(
      z.object({
        name: text(60),
        url: z
          .url({ protocol: /^https$/ })
          .max(500)
          .refine((value) => {
            if (!URL.canParse(value)) return false;
            const url = new URL(value);
            return (
              !url.username &&
              !url.password &&
              !url.port &&
              socialHosts.includes(url.hostname.replace(/^www\./, "")) &&
              url.pathname !== "/"
            );
          }),
      }),
    )
    .max(10),
});

const mediaSchema = z.object({
  items: z
    .array(
      z
        .object({
          id,
          name: text(160),
          src: z.string().max(200),
          sourceUrl: z.string().max(800),
          alt: text(300),
          description: text(1500),
          width: z.number().int().positive().max(12000),
          height: z.number().int().positive().max(12000),
          focalPoint: z.string().regex(/^(?:100|\d{1,2})% (?:100|\d{1,2})%$/),
        })
        .refine((item) => {
          if (Object.hasOwn(mediaCatalog, item.id)) {
            const asset = mediaCatalog[item.id as keyof typeof mediaCatalog];
            return (
              item.src === asset.src &&
              item.sourceUrl === asset.sourceUrl &&
              item.width === asset.width &&
              item.height === asset.height
            );
          }
          const filename = /^upload-([a-f0-9]{64})$/.exec(item.id)?.[1];
          return (
            !!filename &&
            item.src === `/cms-media/${filename}.webp` &&
            item.sourceUrl === item.src
          );
        }, "Путь и размеры фотографии связаны с файлом из медиатеки."),
    )
    .max(1000),
});

function unique(items: readonly string[]) {
  return new Set(items).size === items.length;
}

export function parseSiteData<K extends SiteKey>(
  key: K,
  input: unknown,
): SiteData[K] {
  if (key === "contacts") {
    const result = contactsSchema.safeParse(input);
    if (!result.success)
      throw new CmsError(
        "Проверьте телефон, адрес, почту, координаты и официальные HTTPS-ссылки.",
      );
    return result.data as SiteData[K];
  }
  if (key === "media") {
    const result = mediaSchema.safeParse(input);
    if (!result.success || !unique(result.data.items.map((item) => item.id))) {
      throw new CmsError(
        "Проверьте название, описание, alt-текст и уникальность фотографий.",
      );
    }
    return result.data as SiteData[K];
  }
  if (key === "book") {
    const result = bookSchema.safeParse(input);
    if (
      !result.success ||
      result.data.chapters.some(
        (chapter, index) =>
          chapter.id !== `chapter-${index + 1}` ||
          chapter.layout !== layouts[index] ||
          (chapter.entries &&
            !unique(chapter.entries.map((entry) => entry.section))) ||
          (index === 1
            ? chapter.entries?.length !== 4
            : !!chapter.entries?.length) ||
          (index === 0 && chapter.title.length > 22),
      )
    ) {
      throw new CmsError(
        "Проверьте три главы, ссылки, длину названий и поля SEO. Глава на обложке допускает до 22 символов.",
      );
    }
    return result.data as SiteData[K];
  }

  const result = guideSchema.safeParse(input);
  if (!result.success || result.data.action !== actions[key as SectionId]) {
    throw new CmsError(
      "Проверьте текст, фото и заполненность заголовка и описания SEO.",
    );
  }
  const data = result.data;
  if (
    !unique(data.items.map((item) => item.id)) ||
    (data.gallery && !unique(data.gallery))
  ) {
    throw new CmsError(
      "Идентификаторы объектов и фотографии галереи должны быть уникальными.",
    );
  }
  if (key === "prozhivanie") {
    if (
      data.items.length !== Object.keys(roomLabels).length ||
      Object.keys(roomLabels).some(
        (room) =>
          !data.items.some((item) => item.id === room && item.room === room),
      )
    ) {
      throw new CmsError(
        "Сохраните все четыре категории проживания и их исходные идентификаторы.",
      );
    }
  } else if (data.items.some((item) => item.room)) {
    throw new CmsError(
      "Категории бронирования разрешены только на странице проживания.",
    );
  }
  return data as SiteData[K];
}

export function photoReferences(key: SiteKey, data: SiteData[SiteKey]) {
  if (key === "book")
    return (data as CmsBook).chapters.map((chapter) => chapter.photo);
  if (key === "contacts" || key === "media") return [];
  const guide = data as CmsGuide;
  return [
    guide.photo,
    ...(guide.gallery ?? []),
    ...guide.items.flatMap((item) => (item.photo ? [item.photo] : [])),
  ];
}
