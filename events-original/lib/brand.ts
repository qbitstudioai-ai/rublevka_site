import type { ImageAsset } from "./types";

/**
 * Официальный логотип комплекса (logotip_rublevka-1-scaled.webp с rublevka34.com, уменьшен до 360 px).
 * Лежит на нашем сервере: браузер посетителя не обращается к сторонним, в том числе зарубежным, сервисам.
 */
export const BRAND_LOGO: ImageAsset = {
  src: "/meropriyatiya/brand/rublevka-logo.webp",
  alt: "Загородный комплекс «Рублёвка»",
};

/** Основной сайт комплекса: логотип и пустое состояние списка мероприятий ведут сюда. */
export const MAIN_SITE_URL = "/";

/** Банк единого QR оплаты — используется в инструкции и на кнопке «Открыть Сбербанк». */
export const PAYMENT_BANK_NAME = "Сбербанк";
