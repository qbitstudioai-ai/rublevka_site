export type MediaAsset = {
  id: string;
  src: string;
  sourceUrl: string;
  alt: string;
  description: string;
  width: number;
  height: number;
  focalPoint: `${number}% ${number}%`;
};

export const mediaCatalog = {
  "event-loto": {
    id: "event-loto",
    src: "/images/rublevka/event-loto.webp",
    sourceUrl: "https://meropriyatiya.allqbit.ru/media/1d4aae3b-f4da-4c4f-b03d-84605439108e.webp",
    alt: "Иллюстрация мероприятия «Музыкальное лото»",
    description: "Изображение из публичной карточки «Музыкальное лото» в афише комплекса.",
    width: 864,
    height: 1152,
    focalPoint: "50% 50%",
  },
  "event-banya": {
    id: "event-banya",
    src: "/images/rublevka/event-banya.webp",
    sourceUrl: "https://meropriyatiya.allqbit.ru/media/9328831e-7241-4c94-9bd1-7ec0ffd8065a.webp",
    alt: "Иллюстрация мероприятия «Фестиваль банного искусства»",
    description: "Изображение из публичной карточки «Фестиваль банного искусства» в афише комплекса.",
    width: 864,
    height: 1152,
    focalPoint: "50% 50%",
  },
  "event-wedding": {
    id: "event-wedding",
    src: "/images/rublevka/event-wedding.webp",
    sourceUrl: "https://meropriyatiya.allqbit.ru/media/74eeb30a-9d19-4632-9a98-f9b135a45adc.webp",
    alt: "Иллюстрация мероприятия «Липовая свадьба в стиле 90-х»",
    description: "Изображение из публичной карточки «Липовая свадьба в стиле 90-х» в афише комплекса.",
    width: 864,
    height: 1152,
    focalPoint: "50% 50%",
  },
  "event-school": {
    id: "event-school",
    src: "/images/rublevka/event-school.webp",
    sourceUrl: "https://meropriyatiya.allqbit.ru/media/782e9147-4c66-48b2-a8fd-c88248b19b2d.webp",
    alt: "Иллюстрация мероприятия «Предновогодние праздники для школьников»",
    description: "Изображение из публичной карточки «Предновогодние праздники для школьников» в афише комплекса.",
    width: 1152,
    height: 720,
    focalPoint: "50% 50%",
  },
  "event-new-year": {
    id: "event-new-year",
    src: "/images/rublevka/event-new-year.webp",
    sourceUrl: "https://meropriyatiya.allqbit.ru/media/203b715d-3780-4b50-83e4-6a0b736e7e6b.webp",
    alt: "Иллюстрация мероприятия «Новогодняя ночь»",
    description: "Изображение из публичной карточки «Новогодняя ночь» в афише комплекса.",
    width: 720,
    height: 1280,
    focalPoint: "50% 50%",
  },
  "house-oaks": {
    id: "house-oaks",
    src: "/images/rublevka/house-oaks.jpg",
    sourceUrl: "https://rublevka34.com/wp-content/uploads/2024/03/c640b9cfe680942b.jpg",
    alt: "Двухэтажный деревянный дом комплекса среди дубов",
    description: "Главный экстерьер деревянного дома в дубовой части территории комплекса.",
    width: 1152,
    height: 768,
    focalPoint: "54% 48%",
  },
  "cottage": {
    id: "cottage",
    src: "/images/rublevka/cottage.webp",
    sourceUrl: "https://rublevka34.com/wp-content/uploads/2024/03/85b2a70a5a97c9a3.jpg",
    alt: "Двухместный коттедж комплекса",
    description: "Двухместный коттедж комплекса. Фотография из официального каталога проживания.",
    width: 540,
    height: 361,
    focalPoint: "50% 50%",
  },
  "bedrooms": {
    id: "bedrooms",
    src: "/images/rublevka/bedrooms.webp",
    sourceUrl: "https://rublevka34.com/wp-content/uploads/2024/03/fccfffb417e8ecf5-1024x683.jpg",
    alt: "Дом с двумя спальнями на территории комплекса",
    description: "Дом с двумя спальнями на территории комплекса. Фотография из официального каталога проживания.",
    width: 900,
    height: 600,
    focalPoint: "50% 50%",
  },
  "family": {
    id: "family",
    src: "/images/rublevka/family.webp",
    sourceUrl: "https://rublevka34.com/wp-content/uploads/2024/03/4cb31d4ad68bdfb0.jpg",
    alt: "Семейный дом загородного комплекса",
    description: "Семейный дом загородного комплекса. Фотография из официального каталога проживания.",
    width: 540,
    height: 356,
    focalPoint: "50% 50%",
  },
  "gazebo-oaks": {
    id: "gazebo-oaks",
    src: "/images/rublevka/gazebo-oaks.jpg",
    sourceUrl: "https://rublevka34.com/wp-content/uploads/2024/03/6511bd0b4dc4dc7b.jpg",
    alt: "Деревянная беседка между взрослыми дубами",
    description: "Открытая деревянная беседка на территории комплекса в естественном окружении.",
    width: 1152,
    height: 768,
    focalPoint: "52% 52%",
  },
  "bath-complex": {
    id: "bath-complex",
    src: "/images/rublevka/bath-complex.jpg",
    sourceUrl: "https://rublevka34.com/wp-content/uploads/2024/03/c9dfc868702b9ca7.jpg",
    alt: "Деревянное здание банного комплекса Рублевки",
    description: "Реальный фасад банного комплекса, снятый на территории загородного комплекса.",
    width: 1152,
    height: 768,
    focalPoint: "52% 52%",
  },
  "banquet-hall": {
    id: "banquet-hall",
    src: "/images/rublevka/banquet-hall.avif",
    sourceUrl: "https://rublevka34.com/wp-content/uploads/2024/05/zal-1_result.avif",
    alt: "Просторный деревянный банкетный зал с колоннами",
    description: "Интерьер действующего банкетного зала с деревянной отделкой и открытой планировкой.",
    width: 2784,
    height: 1856,
    focalPoint: "50% 46%",
  },
  "oak-forest": {
    id: "oak-forest",
    src: "/images/rublevka/oak-forest.avif",
    sourceUrl: "https://rublevka34.com/wp-content/uploads/2024/05/vesna_result.avif",
    alt: "Дубовая роща и деревянные строения на территории Рублевки",
    description: "Широкий вид зелёной территории комплекса со взрослыми дубами и беседками.",
    width: 4272,
    height: 2848,
    focalPoint: "52% 52%",
  },
  "woodland-path": {
    id: "woodland-path",
    src: "/images/rublevka/woodland-path.jpg",
    sourceUrl: "https://rublevka34.com/wp-content/uploads/2024/03/c289b9b9a8f02440.jpg",
    alt: "Деревянная дорожка между домиками в дубовом лесу",
    description: "Прогулочная дорожка, связывающая деревянные строения на территории комплекса.",
    width: 959,
    height: 640,
    focalPoint: "50% 52%",
  },
} as const satisfies Record<string, MediaAsset>;

export type MediaId = keyof typeof mediaCatalog;

export function resolveMedia(id: string): MediaAsset {
  if (!(id in mediaCatalog)) {
    throw new Error(`Unknown media asset: ${id}`);
  }

  return mediaCatalog[id as MediaId];
}
