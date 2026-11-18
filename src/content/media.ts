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
    src: "/images/rublevka/banquet-hall.webp",
    sourceUrl: "https://rublevka34.com/wp-content/uploads/2024/05/zal-1_result.avif",
    alt: "Просторный деревянный банкетный зал с колоннами",
    description: "Интерьер действующего банкетного зала с деревянной отделкой и открытой планировкой.",
    width: 2784,
    height: 1856,
    focalPoint: "50% 46%",
  },
  "oak-forest": {
    id: "oak-forest",
    src: "/images/rublevka/oak-forest.webp",
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
