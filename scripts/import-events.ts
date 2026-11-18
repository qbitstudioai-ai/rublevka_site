import { db, pool } from "../src/server/events/db";
import { activities, events } from "../src/server/events/schema";

// Reviewed public event pages under https://meropriyatiya.allqbit.ru/event/{slug}.
// A missing time is kept in the review note for the editor before publication.
type Draft = {
  slug: string;
  title: string;
  imageId: string;
  start: string;
  end: string;
  description: string;
  program: string;
  conditions: string;
  reviewNote: string;
  price: number | null;
  group?: boolean;
  additions?: { title: string; description: string; price: number | null }[];
};
const drafts: Draft[] = [
  {
    slug: "muzykalnoe-loto",
    title: "Музыкальное лото",
    imageId: "event-loto",
    start: "2026-11-20T18:30",
    end: "2026-11-20T22:00",
    price: null,
    description: "Музыкальная игра с хитами девяностых и двухтысячных.",
    program:
      "18:30 — сбор гостей.\n19:00 — начало музыкального лото с дуэтом Flash. В программе банкет, танцы и призы.",
    conditions: "Условия участия уточняет организатор.",
    reviewNote:
      "В карточке 2 800 ₽. В программе указаны 900 ₽ и депозит 1 700 ₽, сумма 2 600 ₽. Подтвердить тариф и вместимость.",
  },
  {
    slug: "festival-bannogo-iskusstva",
    title: "Фестиваль банного искусства",
    imageId: "event-banya",
    start: "2026-11-21T10:00",
    end: "2026-11-22T00:00",
    price: 0,
    description:
      "Двухдневный фестиваль банного искусства в загородном комплексе.",
    program: "Церемонии пара, йога, массаж и партнёрские программы.",
    conditions: "Вход по регистрации. Количество участников ограничено.",
    reviewNote:
      "Указаны бесплатное посещение и последний день 22 ноября. Время окончания, лимит мест и условия отдельных процедур требуют проверки.",
  },
  {
    slug: "lipovaya-svadba-v-stile-90-kh",
    title: "Липовая свадьба в стиле 90-х",
    imageId: "event-wedding",
    start: "2026-12-12T16:00",
    end: "2026-12-13T13:00",
    price: 350000,
    description:
      "Тематический праздник с ролями для гостей, конкурсами и банкетом.",
    program:
      "12 декабря — банкет и свадебные роли.\n13 декабря — утренняя программа и угощения.",
    conditions: "Основной тариф относится к первому дню.",
    reviewNote:
      "В карточке начало в 16:00, программа указывает сбор в 18:30 и начало в 19:00. Сверить время, роли и пакет второго дня с проживанием. Размещение согласуется отдельно.",
    additions: [
      {
        title: "Главная роль",
        description: "Роль в программе первого дня.",
        price: 50000,
      },
      {
        title: "Проживание и второй день",
        description:
          "Интерес к пакету с утренней программой. Размещение подтверждает администратор.",
        price: 450000,
      },
    ],
  },
  {
    slug: "prednovogodnie-prazdniki-dlya-shkolnikov",
    title: "Предновогодние праздники для школьников",
    imageId: "event-school",
    start: "2026-12-15T10:00",
    end: "2026-12-29T00:00",
    price: null,
    group: true,
    description: "Предновогодняя программа для организованных школьных групп.",
    program:
      "Праздничная встреча для группы. Дополнительно предлагается гастрономический мастер-класс.",
    conditions:
      "Обращается взрослый организатор. В описании указана группа от 30 человек.",
    reviewNote:
      "Указан минимум 2 500 ₽ на человека. Подтвердить дату сеанса, время окончания, размер группы, стоимость и правила участия. Мастер-класс упомянут в описании.",
    additions: [
      {
        title: "Гастрономический мастер-класс",
        description: "Приготовление праздничного угощения.",
        price: 50000,
      },
    ],
  },
  {
    slug: "novogodnyaya-noch",
    title: "Новогодняя ночь",
    imageId: "event-new-year",
    start: "2026-12-30T13:00",
    end: "2027-01-02T13:00",
    price: null,
    description:
      "Четырёхдневный новогодний тур с банкетом и музыкальной программой.",
    program:
      "30 декабря — встреча и вечер в ресторане.\n31 декабря — праздничный банкет.\n1 января — казачий коллектив и музыкальное лото.\n2 января — завтрак и выезд.",
    conditions: "Условия пакета согласуются с администратором.",
    reviewNote:
      "Дни недели в программе не соответствуют 2026–2027 годам. В карточке начало в 13:00, в программе заезд в 15:00. Цена 25 000 ₽ действовала до конца октября. Сверить текущие пакеты, возрастные условия и размещение.",
  },
];

async function run() {
  if (!process.env.DATABASE_URL) throw new Error("Укажите DATABASE_URL");
  let imported = 0;
  await db.transaction(async (tx) => {
    for (const { start, end, additions = [], ...draft } of drafts) {
      const [event] = await tx
        .insert(events)
        .values({
          ...draft,
          sourceSlug: draft.slug,
          startsAt: new Date(start + ":00+03:00"),
          endsAt: new Date(end + ":00+03:00"),
          status: "draft",
        })
        .onConflictDoNothing({ target: events.sourceSlug })
        .returning({ id: events.id });
      if (!event) continue;
      imported++;
      if (additions.length)
        await tx
          .insert(activities)
          .values(
            additions.map((activity) => ({ ...activity, eventId: event.id })),
          );
    }
  });
  console.info("Создано черновиков:", imported);
}
run()
  .catch(() => {
    console.error(
      "Импорт не выполнен. Проверьте миграции, подключение и уникальность адресов.",
    );
    process.exitCode = 1;
  })
  .finally(() => pool.end());
