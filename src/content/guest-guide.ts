import { roomLabels, type Room } from "./stay-request";
import type { MediaId } from "./media";
import type { SectionId } from "./sections";

// Official sources: https://rublevka34.com/kontakty/ and https://rublevka34.com/prozhivanie/
export const reception = {
  phone: "+7 (927) 509-50-95",
  tel: "tel:+79275095095",
  email: "info@rublevka34.ru",
  location: "Краснослободск, Волгоградская область",
  address:
    "Волгоградская область, Среднеахтубинский район, Краснослободск, ул. Турбаз, 5",
  latitude: 48.675659,
  longitude: 44.54584,
};
export const mapHref = `https://yandex.ru/maps/?pt=${reception.longitude},${reception.latitude}&z=16&l=map`;

export type GuideItem = {
  name: string;
  description: string;
  detail?: string;
  room?: Room;
  photo?: MediaId;
};
export type GuidePage = {
  heading: string;
  title: string;
  description: string;
  intro: string;
  photo: MediaId;
  caption: string;
  action: "stay" | "enquire" | "map" | "photos";
  section: string;
  items: GuideItem[];
  gallery?: MediaId[];
};
export const guide: Record<SectionId, GuidePage> = {
  prozhivanie: {
    heading: "Дома и проживание",
    title: "Дома и номера для отдыха под Волгоградом",
    description:
      "Выберите номер в срубе, отдельный коттедж или семейный дом в Краснослободске. Планировки и телефон администратора «Рублевки».",
    intro:
      "Вдвоём можно остановиться в номере или отдельном коттедже. Для поездки с детьми и друзьями есть дома с двумя спальнями.",
    photo: "house-oaks",
    caption: "Жилой сруб в дубовой роще",
    action: "stay",
    section: "Где остановиться",
    items: [
      {
        room: "room",
        photo: "house-oaks",
        name: roomLabels.room,
        detail: "2 гостя",
        description:
          "В деревянном корпусе четыре номера. В каждом есть двуспальная кровать, кухонный уголок и душ.",
      },
      {
        room: "cottage",
        photo: "cottage",
        name: roomLabels.cottage,
        detail: "2 гостя",
        description:
          "Спальня и собственная кухня. Возле дома можно собраться в беседке у мангала.",
      },
      {
        room: "bedrooms",
        photo: "bedrooms",
        name: roomLabels.bedrooms,
        detail: "4 гостя",
        description:
          "В обеих спальнях двуспальные кровати. За общим столом на кухне поместится вся семья.",
      },
      {
        room: "family",
        photo: "family",
        name: roomLabels.family,
        detail: "6 гостей · Дома № 7 и 8",
        description:
          "Две спальни и балкон наверху, кухня и гостиная на первом этаже.",
      },
    ],
  },
  besedki: {
    heading: "Беседки среди дубов",
    title: "Аренда беседок под Волгоградом",
    description:
      "Три беседки для компаний до 20, 25 и 45 человек на территории «Рублевки». Сравните вместимость и узнайте условия аренды.",
    intro:
      "Выберите беседку по числу гостей. В каждой предусмотрены места за столом, холодильник и мангал с принадлежностями.",
    photo: "gazebo-oaks",
    caption: "Беседка на территории комплекса",
    action: "enquire",
    section: "Какую беседку выбрать",
    items: [
      {
        name: "Оранжевая",
        detail: "До 20 гостей",
        description: "Самая небольшая из трёх беседок.",
      },
      {
        name: "Зелёная",
        detail: "До 25 гостей",
        description:
          "Подойдёт, если за столом собираются больше двадцати человек.",
      },
      {
        name: "Бежевая",
        detail: "До 45 гостей",
        description: "Самая вместительная беседка комплекса.",
      },
    ],
  },
  "banketnye-zaly": {
    heading: "Банкетные залы",
    title: "Два банкетных зала для праздника под Волгоградом",
    description:
      "Большой зал до 120 гостей и малый до 60 в Краснослободске. Сравните площадки для свадьбы, фуршета или семейного праздника.",
    intro:
      "Для камерного праздника подойдёт зал с отдельной беседкой. Для вечера с живой музыкой — большой зал с подиумом.",
    photo: "banquet-hall",
    caption: "Деревянный интерьер банкетного зала",
    action: "enquire",
    section: "Две площадки для праздника",
    items: [
      {
        name: "Большой зал",
        detail: "До 120 гостей",
        description:
          "Подиум можно отвести для молодожёнов, ведущего или музыкантов.",
      },
      {
        name: "Малый зал",
        detail: "До 60 гостей",
        description:
          "Есть проектор и своя беседка для фуршета или выездной регистрации.",
      },
    ],
  },
  banya: {
    heading: "Банный комплекс",
    title: "Баня на дровах в Краснослободске под Волгоградом",
    description:
      "Двухэтажный сруб с парной, купелью и местом для отдыха на территории «Рублевки». Контакты для уточнения растопки и даты.",
    intro:
      "Парная и купель находятся на первом этаже деревянного дома. После бани можно выйти к столу во дворе.",
    photo: "bath-complex",
    caption: "Сруб банного комплекса",
    action: "enquire",
    section: "Как устроен комплекс",
    items: [
      {
        name: "Парная и купель",
        detail: "Первый этаж",
        description:
          "Парную топят дровами. Время растопки удобно согласовать при звонке.",
      },
      {
        name: "Дом и двор",
        detail: "До 10 человек",
        description:
          "Наверху расположены две спальни, на огороженном участке — столы и место для мангала.",
      },
    ],
  },
  uslugi: {
    heading: "Отдых на территории",
    title: "Бассейн, спорт и отдых на территории турбазы под Волгоградом",
    description:
      "Узнайте, чем заняться в «Рублевке»: бассейн, детская площадка, волейбол и настольный теннис. Условия посещения уточнит администратор.",
    intro:
      "Между прогулками по роще можно сыграть в волейбол, отправиться к бассейну или провести время с детьми на площадке.",
    photo: "oak-forest",
    caption: "Дубовая роща на берегу Волги",
    action: "enquire",
    section: "Чем заняться",
    items: [
      {
        name: "Бассейн",
        description:
          "Перед поездкой уточните у администратора, открыт ли бассейн на выбранную дату.",
      },
      {
        name: "Игры на воздухе",
        description:
          "На территории есть волейбольная площадка и настольный теннис.",
      },
      {
        name: "Отдых с детьми",
        description: "Для маленьких гостей оборудована детская площадка.",
      },
    ],
  },
  galereya: {
    heading: "Галерея Рублевки",
    title: "Фотографии домов, залов и дубовой рощи «Рублевки»",
    description:
      "Посмотрите фотографии загородного комплекса в Волгоградской области: жилой сруб, беседки, баня, банкетный зал и прогулочные дорожки.",
    intro:
      "Дома под кронами дубов, деревянные беседки и дорожки между ними. Откройте снимок, чтобы рассмотреть детали.",
    photo: "woodland-path",
    caption: "Прогулочная дорожка между домами",
    action: "photos",
    section: "Фотографии комплекса",
    items: [],
    gallery: [
      "house-oaks",
      "gazebo-oaks",
      "banquet-hall",
      "bath-complex",
      "oak-forest",
      "woodland-path",
    ],
  },
  kontakty: {
    heading: "Как нас найти",
    title: "Контакты и маршрут до «Рублевки» в Краснослободске",
    description:
      "Адрес турбазы «Рублевка» в Краснослободске, координаты для навигатора, телефон и электронная почта администратора.",
    intro: reception.address + ".",
    photo: "woodland-path",
    caption: "На территории Рублевки",
    action: "map",
    section: "Связаться с администратором",
    items: [],
  },
};
