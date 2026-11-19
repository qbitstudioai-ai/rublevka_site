import { guide, reception } from "@/content/guest-guide";
import { chapters } from "@/content/home";
import { mediaCatalog } from "@/content/media";
import { sectionIds, type SectionId } from "@/content/sections";
import type { CmsGuide, SiteData } from "./model";

const itemIds: Partial<Record<SectionId, readonly string[]>> = {
  besedki: ["orange", "green", "beige"],
  "banketnye-zaly": ["large-hall", "small-hall"],
  banya: ["steam-room", "house-and-yard"],
  uslugi: ["pool", "outdoor-games", "children"],
};

const guides = Object.fromEntries(
  sectionIds.map((key) => [
    key,
    {
      ...guide[key],
      indexable: true,
      items: guide[key].items.map((item, index) => ({
        ...item,
        id: item.room ?? itemIds[key]?.[index] ?? `${key}-${index + 1}`,
        visible: true,
      })),
    },
  ]),
) as Record<SectionId, CmsGuide>;

export const siteDefaults: SiteData = {
  ...guides,
  book: {
    title: "Загородный комплекс в дубовом лесу",
    description:
      "Загородный отдых в дубовой роще под Волгоградом. Дома, беседки, два банкетных зала и баня в Краснослободске — фотографии и контакты «Рублевки».",
    indexable: true,
    chapters: [...chapters],
  },
  contacts: {
    phone: reception.phone,
    email: reception.email,
    location: reception.location,
    address: reception.address,
    latitude: reception.latitude,
    longitude: reception.longitude,
    socials: [],
  },
  media: {
    items: Object.values(mediaCatalog).map((asset) => ({
      ...asset,
      name: asset.alt,
    })),
  },
};
