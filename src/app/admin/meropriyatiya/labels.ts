export const eventStates = {
  draft: "Черновик",
  open: "Регистрация открыта",
  closed: "Регистрация закрыта",
  full: "Мест нет",
  cancelled: "Отменено",
  completed: "Завершено",
};
export const guestStates = {
  pending: "Новая заявка",
  confirmed: "Участие подтверждено",
  cancelled: "Отменено",
  attended: "Посетил мероприятие",
};
export const payStates = {
  unpaid: "Без подтверждения оплаты",
  paid: "Оплата подтверждена",
  refunded: "Возврат подтверждён",
};
export const displayDate = (date: Date) =>
  new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Volgograd",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
