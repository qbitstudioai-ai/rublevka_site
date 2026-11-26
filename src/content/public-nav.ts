export const bookingHref = "/bronirovanie";

export const publicNavigation = [
  { label: "Проживание", href: "/prozhivanie", id: "prozhivanie" },
  { label: "Беседки", href: "/besedki", id: "besedki" },
  {
    label: "Банкетные залы",
    href: "/banketnye-zaly",
    id: "banketnye-zaly",
  },
  { label: "Баня", href: "/banya", id: "banya" },
  { label: "Услуги", href: "/uslugi", id: "uslugi" },
  { label: "Мероприятия", href: "/meropriyatiya", id: "meropriyatiya" },
  { label: "Карта комплекса", href: "/karta", id: "karta" },
  { label: "Галерея", href: "/galereya", id: "galereya" },
  { label: "Контакты", href: "/kontakty", id: "kontakty" },
] as const;

export type PublicNavigationId = (typeof publicNavigation)[number]["id"];
