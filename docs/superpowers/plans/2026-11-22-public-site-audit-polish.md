# Public Site Audit, Book Chapter, and Admin Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Исправить подтвержденные критические дефекты публичного сайта, добавить вторую главу «Мероприятия» в интерактивную книгу, безопасно мигрировать четырехглавые CMS-документы и подтвердить работоспособность обеих административных панелей.

**Architecture:** Проект остается модульным монолитом Next.js App Router. Книга по-прежнему получает главы только из CMS; серверная модель нормализует старые документы до пятиглавой структуры, а UI отображает необязательную фотографию главы `events` как декоративную пустую рамку. Публичная полировка выполняется в существующих компонентах и CSS-токенах без новой UI- или animation-библиотеки и без изменения данных TravelLine.

**Tech Stack:** Next.js 16.4.6 App Router, React 19.3.1, TypeScript 5.9.3, Zod 4.6.7, Node test runner через `tsx --test`, Playwright в `events-original`, CSS Modules и глобальные CSS-токены.

**Spec:** `docs/superpowers/specs/2026-11-22-public-site-audit-polish-design.md`

## Global Constraints

- Публичные страницы остаются в `src/app/(public)`, общие UI-компоненты — в `src/components`, серверная модель и адаптеры — в `src/server`.
- Server Components используются по умолчанию; новый клиентский JavaScript допустим только для реального взаимодействия.
- Цвета, типографика, интервалы, длительности и эффекты проходят через существующие дизайн-токены; обязательно поддержать 390×844, 1440×900 и `prefers-reduced-motion`.
- TravelLine остается единственным владельцем данных бронирования; локальный реестр бронирований не создается.
- У индексируемых страниц должны быть уникальные `title`, `description` и canonical; структурированные данные не содержат вымышленных фактов.
- Меню, факты об объекте, цены и условия не меняются.
- Админ-панели не получают декоративный редизайн: меняются только функциональные, адаптивные и доступностные дефекты.
- Существующие незакоммиченные изменения пользователя не откатываются и не перезаписываются целиком; каждый патч минимален и проверяется через `git diff -- <files>`. В task-коммитах используется только `git add -p -- <files>` с последующей проверкой `git diff --cached`; если hunk смешивает старую и новую правку, task-коммит пропускается до безопасного разделения.
- До изменения Next.js-кода исполнитель полностью читает `node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md`, `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`, `node_modules/next/dist/docs/01-app/01-getting-started/12-images.md` и `node_modules/next/dist/docs/03-architecture/accessibility.md`.
- Для React/Next.js-изменений исполнитель применяет skill `react-best-practices`; для каждого исправления сначала получает красный тест по skill `test-driven-development`; перед завершением применяет `requesting-code-review` без автоматического изменения чужих правок.

---

## File Map

- `eslint.config.mjs` — исключает только инструментальные `.superpowers/**` из продуктового lint.
- `src/content/home.ts` — канонические пять глав и типы `opening | events | index | closing | manifesto`.
- `src/server/cms/model.ts` — Zod-схема книги, нормализация старых четырех глав и ссылки на необязательное фото.
- `src/server/cms/model.test.ts` — контракт пяти глав, миграция без потери данных и валидация optional photo.
- `src/components/home/home-story.tsx` — безопасно резолвит медиа только при наличии идентификатора.
- `src/components/book/book-page.tsx` — CTA двух первых глав и пустая декоративная рамка `events`.
- `src/components/book/book-cover.tsx` — визуальный заголовок обложки без второго `h1`.
- `src/components/book/story-book.test.tsx` — статические DOM-контракты CTA, заголовков, рамки и навигации.
- `src/components/site-admin/content-fields.tsx` — необязательный выбор фото только для `events`.
- `src/components/site-admin/preview.tsx` — предпросмотр главы без обращения к отсутствующему фото.
- `events-original/app/page.tsx` — canonical корня приложения мероприятий.
- `events-original/tests/e2e/public.spec.ts` — браузерный контракт canonical.
- `src/components/territory-map/territory-map.tsx` — доступная подсказка горизонтальной прокрутки фильтров.
- `src/app/(public)/karta/territory.css` — видимость подсказки только там, где лента горизонтальна.
- `src/app/globals.css`, `src/app/(public)/[section]/guide.css`, `src/app/(public)/bronirovanie/stay.css`, `events-original/app/globals.css` — перенос текста, зоны нажатия, состояния фокуса и motion-поведение через токены.
- `docs/superpowers/audits/2026-11-22-public-and-admin-verification.md` — воспроизводимый итог проверок и внешние ограничения.

---

### Task 1: Restore the Product Quality Gate

**Files:**
- Modify: `eslint.config.mjs`

**Interfaces:**
- Consumes: существующий `globalIgnores(patterns: string[])` из ESLint 9 flat config.
- Produces: `npm run lint` не анализирует `.superpowers/**`, но продолжает анализировать весь продуктовый код.

- [ ] **Step 1: Зафиксировать красное состояние lint**

Run: `npm run lint`

Expected: FAIL с ошибками `@typescript-eslint/no-require-imports` в `.superpowers/*.cjs`; сохранить точное число ошибок в рабочей заметке.

- [ ] **Step 2: Добавить только инструментальный ignore**

Изменить единственный вызов `globalIgnores`:

```js
globalIgnores([
  ".next/**",
  "out/**",
  "build/**",
  "next-env.d.ts",
  "events-original/**",
  ".superpowers/**",
]),
```

Не удалять `.superpowers` и не добавлять широкие маски для `src/**` или `scripts/**`.

- [ ] **Step 3: Проверить зеленый lint и область diff**

Run: `npm run lint`

Expected: PASS без lint-ошибок.

Run: `git diff -- eslint.config.mjs`

Expected: единственное содержательное изменение — `".superpowers/**"`.

- [ ] **Step 4: Commit**

```bash
git add -p -- eslint.config.mjs
git diff --cached
git commit -m "chore: exclude tool artifacts from lint"
```

---

### Task 2: Define the Five-Chapter Book and Safe CMS Migration

**Files:**
- Modify: `src/content/home.ts:4-75`
- Modify: `src/server/cms/model.ts:1-24,111-140,248-271,309-313`
- Modify: `src/server/cms/model.test.ts`

**Interfaces:**
- Consumes: `ManifestoChapter`, `PhotoChapter`, `parseSiteData("book", input)`, `photoReferences("book", book)`.
- Produces: `EventsChapter`, `CmsPhotoChapter.photo?: string`, порядок `opening, events, index, closing, manifesto`, функция `normalizeLegacyBookChapters(chapters)` внутри `model.ts` и пять последовательных ID.

- [ ] **Step 1: Написать failing-тесты миграции и схемы**

В `src/server/cms/model.test.ts` заменить старый тест, который только добавляет manifesto к трем главам, и добавить следующие проверки:

```ts
test("a legacy four-chapter book gains events at position two without losing content", () => {
  const legacy = structuredClone(siteDefaults.book);
  legacy.chapters.splice(1, 1);
  legacy.chapters.forEach((chapter, index) => { chapter.id = `chapter-${index + 1}`; });

  const originalOpening = structuredClone(legacy.chapters[0]);
  const originalIndex = structuredClone(legacy.chapters[1]);
  const originalClosing = structuredClone(legacy.chapters[2]);
  const originalManifesto = structuredClone(legacy.chapters[3]);
  const parsed = parseSiteData("book", legacy);

  assert.deepEqual(parsed.chapters.map((chapter) => chapter.layout), [
    "opening", "events", "index", "closing", "manifesto",
  ]);
  assert.deepEqual(parsed.chapters.map((chapter) => chapter.id), [
    "chapter-1", "chapter-2", "chapter-3", "chapter-4", "chapter-5",
  ]);
  assert.deepEqual(parsed.chapters[0], originalOpening);
  assert.deepEqual({ ...parsed.chapters[2], id: originalIndex.id }, originalIndex);
  assert.deepEqual({ ...parsed.chapters[3], id: originalClosing.id }, originalClosing);
  assert.deepEqual({ ...parsed.chapters[4], id: originalManifesto.id }, originalManifesto);
});

test("events is the only photo layout that accepts an empty photo", () => {
  const book = structuredClone(siteDefaults.book);
  const events = book.chapters[1];
  assert.equal(events.layout, "events");
  if (events.layout !== "events") return;

  delete events.photo;
  const parsed = parseSiteData("book", book, { allowLegacyBook: false });
  assert.equal(parsed.chapters[1].layout, "events");
  assert.deepEqual(photoReferences("book", parsed), [
    "book-opening-house", "book-autumn-gazebo", "book-golden-grove",
  ]);

  const opening = structuredClone(book);
  if (opening.chapters[0].layout !== "manifesto") delete opening.chapters[0].photo;
  assert.throws(() => parseSiteData("book", opening), CmsError);
});
```

Обновить все существующие ожидания manifesto с индекса `3` на `4` и ожидаемую длину с `4` на `5`.

- [ ] **Step 2: Запустить тесты и подтвердить правильное падение**

Run: `npx tsx --test src/server/cms/model.test.ts`

Expected: FAIL, потому что `events` отсутствует в layout-типах/схеме и defaults еще содержат четыре главы.

- [ ] **Step 3: Добавить тип и каноническую главу events**

В `src/content/home.ts` разделить обязательное и необязательное фото:

```ts
type ChapterHeading = { id: string; label: string; title: string };

export type PhotoChapter = ChapterHeading & {
  text?: string;
  photo: MediaId;
  layout: "opening" | "index" | "closing";
  entries?: readonly Entry[];
};

export type EventsChapter = ChapterHeading & {
  layout: "events";
  text: string;
  photo?: MediaId;
};

export type Chapter = PhotoChapter | EventsChapter | ManifestoChapter;

export const eventsChapter: EventsChapter = {
  id: "chapter-2",
  layout: "events",
  label: "Мероприятия",
  title: "Мероприятия",
  text: "Календарь событий, которые стоит посетить",
};
```

В массиве `chapters` вставить `eventsChapter` после opening, перенумеровать index/closing/manifesto как `chapter-3`, `chapter-4`, `chapter-5`; все тексты, фото и `entries` существующих глав сохранить дословно.

- [ ] **Step 4: Обновить CMS-типы и Zod-схему**

В `src/server/cms/model.ts` импортировать `eventsChapter` и `EventsChapter`, затем задать типы:

```ts
export type CmsRequiredPhotoChapter = Omit<PhotoChapter, "photo"> & {
  photo: string;
  caption?: string;
};
export type CmsEventsChapter = Omit<EventsChapter, "photo"> & {
  photo?: string;
  caption?: string;
};
export type CmsPhotoChapter = CmsRequiredPhotoChapter | CmsEventsChapter;
export type CmsChapter = CmsPhotoChapter | ManifestoChapter;
```

Схему разделить по discriminator, чтобы optional photo относилось только к `events`:

```ts
const requiredPhotoLayouts = ["opening", "index", "closing"] as const;
const layouts = ["opening", "events", "index", "closing", "manifesto"] as const;

z.discriminatedUnion("layout", [
  z.object({
    ...chapterHeading,
    layout: z.enum(requiredPhotoLayouts),
    text: optionalText(180),
    photo: id,
    caption: optionalText(160),
    entries: z.array(z.object({ title: text(40), section })).max(4).optional(),
  }),
  z.object({
    ...chapterHeading,
    layout: z.literal("events"),
    text: text(180),
    photo: id.optional(),
    caption: optionalText(160),
  }),
  z.strictObject({
    ...chapterHeading,
    layout: z.literal("manifesto"),
    subtitle: text(140),
    paragraphs: z.array(text(350)).length(5),
    emphasis: text(100),
    closing: text(120),
    quote: text(200),
  }),
])
```

- [ ] **Step 5: Нормализовать старую книгу до валидации строгого порядка**

Перед `bookSchema.safeParse` клонировать input и мигрировать только точную старую последовательность `opening,index,closing,manifesto`:

```ts
function normalizeLegacyBook(input: unknown) {
  if (!input || typeof input !== "object") return input;
  const candidate = structuredClone(input) as { chapters?: Array<Record<string, unknown>> };
  const legacyLayouts = candidate.chapters?.map((chapter) => chapter.layout);
  if (legacyLayouts?.join(",") !== "opening,index,closing,manifesto") return candidate;

  candidate.chapters = [
    candidate.chapters![0],
    structuredClone(eventsChapter),
    ...candidate.chapters!.slice(1),
  ].map((chapter, index) => ({ ...chapter, id: `chapter-${index + 1}` }));
  return candidate;
}
```

Использовать миграцию только при `allowLegacyBook === true`; при `false` валидировать вход как есть. Удалить старую ветку, которая безусловно дописывала только manifesto. Сообщение ошибки заменить на «Проверьте пять глав…».

- [ ] **Step 6: Не возвращать пустой media reference**

Заменить ветку книги в `photoReferences`:

```ts
return (data as CmsBook).chapters.flatMap((chapter) =>
  chapter.layout !== "manifesto" && chapter.photo ? [chapter.photo] : [],
);
```

- [ ] **Step 7: Запустить целевые и соседние CMS-тесты**

Run: `npx tsx --test src/server/cms/model.test.ts src/server/cms/store.test.ts`

Expected: PASS; миграция сохраняет все старые поля, новая книга строго имеет пять глав.

Run: `npm run typecheck`

Expected: FAIL только в UI-местах, которые пока предполагают обязательный `chapter.photo`; точный список должен совпадать с файлами Tasks 3–4.

- [ ] **Step 8: Commit**

```bash
git add -p -- src/content/home.ts src/server/cms/model.ts src/server/cms/model.test.ts
git diff --cached
git commit -m "feat: migrate the book to five chapters"
```

---

### Task 3: Render the Events Spread, Both CTAs, and the Empty Photo Frame

**Files:**
- Modify: `src/components/home/home-story.tsx`
- Modify: `src/components/book/book-page.tsx`
- Modify: `src/components/book/story-book.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `CmsPhotoChapter.photo?: string`, `catalogAsset(catalog, id)`, `MediaFrame`.
- Produces: `BookChapter` с `image?: MediaAsset`, CTA `/bronirovanie` и `/meropriyatiya`, `.carving-empty` как несемантическая рамка.

- [ ] **Step 1: Добавить failing render-тесты**

В `src/components/book/story-book.test.tsx` добавить:

```tsx
function renderChapter(index: number) {
  const chapter = chapters[index];
  const withImage = chapter.layout !== "manifesto" && chapter.photo
    ? { ...chapter, image: resolveMedia(chapter.photo) }
    : chapter;
  return renderToStaticMarkup(
    <BookPage chapter={withImage} index={index} count={chapters.length}
      active departing={false} select={() => {}} />,
  );
}

test("the opening CTA names lodging dates and keeps the booking route", () => {
  const markup = renderChapter(0);
  assert.match(markup, />Выбрать даты проживания<\/a>/);
  assert.match(markup, /href="\/bronirovanie"/);
});

test("events is the second spread with a calendar CTA and an empty decorative frame", () => {
  const markup = renderChapter(1);
  assert.match(markup, /<h2[^>]*>Мероприятия<\/h2>/);
  assert.match(markup, /Календарь событий, которые стоит посетить/);
  assert.match(markup, /href="\/meropriyatiya"/);
  assert.match(markup, />Календарь<\/a>/);
  assert.match(markup, /class="[^"]*carving-empty[^"]*"/);
  assert.doesNotMatch(markup, /<img/);
});
```

Обновить navigation-тест closing: `chapters[3]`, `index={3}`, название «the fourth leaf…».

- [ ] **Step 2: Подтвердить красные CTA и type error**

Run: `npx tsx --test src/components/book/story-book.test.tsx`

Expected: FAIL: старый текст «Выбрать даты», отсутствует events CTA/empty frame или TypeScript не принимает главу без `image`.

- [ ] **Step 3: Сделать media resolution optional**

В `src/components/home/home-story.tsx`:

```tsx
chapters={chapters.map((chapter) =>
  chapter.layout === "manifesto" || !chapter.photo
    ? chapter
    : { ...chapter, image: catalogAsset(catalog, chapter.photo) },
)}
```

В `book-page.tsx` изменить тип:

```ts
export type BookChapter =
  | (CmsPhotoChapter & { image?: MediaAsset })
  | ManifestoChapter;
```

- [ ] **Step 4: Отрисовать фиксированные CTA по layout**

После inscription/contents отрисовать:

```tsx
{opening && (
  <Link className="seal book-dates" href="/bronirovanie"
    onClick={() => rememberChapter(chapter.id)}>
    Выбрать даты проживания
  </Link>
)}
{chapter.layout === "events" && (
  <Link className="seal book-events" href="/meropriyatiya"
    onClick={() => rememberChapter(chapter.id)}>
    Календарь
  </Link>
)}
```

Не хранить URL или текст кнопок во втором статическом источнике CMS: layout однозначно задает назначение CTA, а title/text/photo остаются CMS-данными.

- [ ] **Step 5: Отрисовать пустую рамку без изображения**

Заменить содержимое `.carving`:

```tsx
<div className={`carving${chapter.image ? "" : " carving-empty"}`}
  aria-hidden={chapter.image ? undefined : true}>
  {chapter.image ? (
    <MediaFrame asset={chapter.image} sizes="(max-width: 800px) 80vw, 42vw" eager={opening} />
  ) : (
    <span className="carving-empty-paper" />
  )}
  {chapter.caption && chapter.image ? (
    <span className="chapter-photo-caption">{chapter.caption}</span>
  ) : null}
</div>
```

В `src/app/globals.css` использовать существующую рамку `.carving`; добавить только внутреннее пустое поле:

```css
.carving-empty-paper {
  display: block;
  width: 100%;
  height: 100%;
  min-height: inherit;
  border-radius: inherit;
  background:
    radial-gradient(circle at 48% 42%, color-mix(in srgb, var(--paper) 94%, white), transparent 62%),
    var(--folio) center / cover;
  box-shadow: inset 0 0 1.2rem color-mix(in srgb, var(--ink) 18%, transparent);
}

.events .inscription { justify-content: center; }
.events .motto { max-width: 24ch; text-wrap: balance; overflow-wrap: anywhere; }
.book-events { align-self: center; }
```

- [ ] **Step 6: Запустить тесты и проверку типов**

Run: `npx tsx --test src/components/book/story-book.test.tsx`

Expected: PASS; events markup не содержит `<img>` при пустом photo.

Run: `npm run typecheck`

Expected: возможны только оставшиеся ошибки CMS editor/preview из Task 4; публичный book pipeline типизируется.

- [ ] **Step 7: Commit**

```bash
git add -p -- src/components/home/home-story.tsx src/components/book/book-page.tsx src/components/book/story-book.test.tsx src/app/globals.css
git diff --cached
git commit -m "feat: add the events spread to the story book"
```

---

### Task 4: Support the Optional Events Photo in Site Admin

**Files:**
- Modify: `src/components/site-admin/content-fields.tsx:110-165`
- Modify: `src/components/site-admin/preview.tsx:50-83`
- Test: `src/server/cms/model.test.ts`

**Interfaces:**
- Consumes: `Book["chapters"][number]`, `PhotosField optional`, `photo(id?: string)`.
- Produces: редактор может сохранить events без фото и назначить/убрать реальное фото; остальные photo-layouts остаются обязательными.

- [ ] **Step 1: Усилить failing-тест публикационной границы**

В тест `events is the only photo layout that accepts an empty photo` добавить:

```ts
const eventsWithPhoto = structuredClone(book);
if (eventsWithPhoto.chapters[1].layout === "events") {
  eventsWithPhoto.chapters[1].photo = "book-opening-house";
}
assert.deepEqual(photoReferences("book", parseSiteData("book", eventsWithPhoto)), [
  "book-opening-house", "book-opening-house", "book-autumn-gazebo", "book-golden-grove",
]);
```

- [ ] **Step 2: Запустить тест до UI-изменений**

Run: `npx tsx --test src/server/cms/model.test.ts`

Expected: PASS для серверного контракта; `npm run typecheck` по-прежнему указывает на небезопасную передачу optional photo в редакторе.

- [ ] **Step 3: Сделать PhotosField optional только для events**

В `BookFields` заменить текущий `PhotosField`:

```tsx
<PhotosField
  label="Фотография главы"
  value={chapter.photo ?? ""}
  items={items}
  publishedMedia={publishedMedia}
  optional={chapter.layout === "events"}
  onChange={(photo) => update({
    ...chapter,
    photo: chapter.layout === "events" ? photo || undefined : photo,
  })}
/>
```

Подпись оставить редактируемой, но передавать `value={chapter.caption ?? ""}`. Не добавлять перемещение или удаление структурных глав: порядок фиксирован серверной схемой.

- [ ] **Step 4: Сделать preview корректным при пустом photo**

В `preview.tsx` оставить `photo(id?: string)`, а блок фото выразить явно:

```tsx
{chapter.photo ? photo(chapter.photo) : chapter.layout === "events" ? (
  <div className="sa-media-card" aria-label="Фотография пока не выбрана">
    <span className="sa-hint">Фотография пока не выбрана</span>
  </div>
) : null}
{chapter.caption && chapter.photo ? <p>{chapter.caption}</p> : null}
```

Это сообщение допустимо только в admin preview; в публичной книге пустая рамка не объявляется изображением.

- [ ] **Step 5: Проверить типы и полный серверный CMS-контракт**

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run test:db`

Expected: PASS для model/store/access/staff тестов; ни одна реальная запись CMS не изменена.

- [ ] **Step 6: Commit**

```bash
git add -p -- src/components/site-admin/content-fields.tsx src/components/site-admin/preview.tsx src/server/cms/model.test.ts
git diff --cached
git commit -m "fix: allow an empty events photo in site admin"
```

---

### Task 5: Fix Canonical Metadata and the Duplicate Main Heading

**Files:**
- Modify: `events-original/app/page.tsx:12-16`
- Modify: `events-original/tests/e2e/public.spec.ts`
- Modify: `src/components/book/book-cover.tsx:29-35`
- Modify: `src/components/book/story-book.test.tsx`

**Interfaces:**
- Consumes: Next.js `Metadata.alternates.canonical`, existing basePath `/meropriyatiya`, static markup rendering.
- Produces: canonical `/meropriyatiya`; ровно один `h1` в DOM главной книги.

- [ ] **Step 1: Прочитать актуальные Next.js docs до изменения metadata**

Run: `Get-Content -Raw node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md`

Expected: документ прочитан полностью; использовать `alternates.canonical`, не ручной `<link>`.

- [ ] **Step 2: Добавить failing-тест canonical приложения мероприятий**

В первом публичном smoke-test `events-original/tests/e2e/public.spec.ts` после `page.goto("/")` добавить:

```ts
await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
  "href",
  /\/meropriyatiya\/?$/,
);
```

Run: `npm --prefix events-original run test:e2e -- --project=desktop --grep "список мероприятий"`

Expected: FAIL: canonical link отсутствует.

- [ ] **Step 3: Добавить canonical в route metadata**

В `events-original/app/page.tsx`:

```ts
export const metadata: Metadata = {
  title: "Мероприятия — загородный комплекс «Рублёвка»",
  description: "Ближайшие мероприятия загородного комплекса «Рублёвка»: выберите мероприятие и зарегистрируйтесь.",
  alternates: { canonical: "/meropriyatiya" },
};
```

Сохранить фактические русские title/description текущего файла, добавив только `alternates`, если текст в рабочем дереве отличается от фрагмента.

- [ ] **Step 4: Добавить failing-тест единственного h1**

В `story-book.test.tsx` расширить cover-тест:

```ts
assert.equal((markup.match(/<h1(?:\s|>)/g) ?? []).length, 0);
assert.match(markup, /class="book-cover-title"/);
```

Run: `npx tsx --test src/components/book/story-book.test.tsx`

Expected: FAIL, закрытая обложка содержит `<h1>`.

- [ ] **Step 5: Сохранить визуальную роль обложки без heading level**

В `book-cover.tsx` заменить только тег:

```tsx
<div className="book-cover-title" role="text">
  <span>Загородный комплекс </span>
  <strong>«Рублевка»</strong>
</div>
```

Первый разворот остается единственным `<h1>`; классы и визуальный стиль обложки сохраняются.

- [ ] **Step 6: Запустить целевые проверки**

Run: `npx tsx --test src/components/book/story-book.test.tsx`

Expected: PASS.

Run: `npm --prefix events-original run test:e2e -- --project=desktop --grep "список мероприятий"`

Expected: PASS; canonical оканчивается `/meropriyatiya`.

- [ ] **Step 7: Commit**

```bash
git add -p -- events-original/app/page.tsx events-original/tests/e2e/public.spec.ts src/components/book/book-cover.tsx src/components/book/story-book.test.tsx
git diff --cached
git commit -m "fix: correct public metadata semantics"
```

---

### Task 6: Make Map Overflow Discoverable and Harden Public Text Layout

**Files:**
- Modify: `src/components/territory-map/territory-map.tsx:84-105`
- Modify: `src/app/(public)/karta/territory.css:48-90,308-357`
- Modify: `src/app/globals.css`
- Modify: `src/app/(public)/[section]/guide.css`
- Modify: `src/app/(public)/bronirovanie/stay.css`
- Modify: `events-original/app/globals.css`

**Interfaces:**
- Consumes: `.territory-filters`, global `--tap`, существующие color/type/motion tokens.
- Produces: `.territory-filter-hint`, безопасный перенос, 44×44 target для видимых controls, четкий focus-visible и отсутствие layout-dependent motion.

- [ ] **Step 1: Добавить проверяемую семантику подсказки фильтров**

В `story-book.test.tsx` тесты карты не относятся к компоненту; вместо source-grep создать небольшой тест `src/components/territory-map/territory-map.test.tsx`, который рендерит компонент с пустым списком и проверяет:

```tsx
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TerritoryMap } from "./territory-map";

test("mobile filter strip has a concise scrolling hint", () => {
  const markup = renderToStaticMarkup(
    <TerritoryMap objects={[]} intro={<h1>Карта</h1>}><g /></TerritoryMap>,
  );
  assert.match(markup, /id="territory-filter-hint"/);
  assert.match(markup, /Листайте категории/);
  assert.match(markup, /aria-describedby="territory-filter-hint"/);
});
```

Добавить этот путь в корневой test script:

```json
"test": "tsx --test src/content/*.test.ts src/components/book/*.test.tsx src/components/events/*.test.ts src/components/territory-map/*.test.tsx"
```

- [ ] **Step 2: Подтвердить красный тест**

Run: `npx tsx --test src/components/territory-map/territory-map.test.tsx`

Expected: FAIL: `territory-filter-hint` и `aria-describedby` отсутствуют.

- [ ] **Step 3: Добавить подсказку без нового управляющего состояния**

В `territory-map.tsx` перед фильтрами:

```tsx
<p className="territory-filter-hint" id="territory-filter-hint">
  Листайте категории в сторону
  <span aria-hidden="true"> →</span>
</p>
<div className="territory-filters" role="group"
  aria-label="Категории карты" aria-describedby="territory-filter-hint">
```

В `territory.css`:

```css
.territory-filter-hint {
  margin: 0;
  padding-inline: 0.75rem;
  color: color-mix(in srgb, var(--map-ink) 72%, transparent);
  font: 600 0.8rem/1.25 var(--map-reading);
}
@media (min-width: 1200px) {
  .territory-filter-hint { display: none; }
}
```

- [ ] **Step 4: Нормализовать текст и интерактивные зоны через токены**

В соответствующих существующих selectors добавить, не дублируя правила:

```css
:where(.guest-guide, .stay-main, .territory-page, .public-site-shell)
  :is(h1, h2, h3, p, a, button, summary) {
  min-inline-size: 0;
  overflow-wrap: anywhere;
}

:where(.guide-nav a, .guide-footer a, .stay-aside a, .territory-directory summary) {
  min-height: var(--tap);
  display: inline-flex;
  align-items: center;
}

:where(a, button, summary):focus-visible {
  outline: 3px solid var(--focus, #184659);
  outline-offset: 3px;
}
```

Разместить правила в той таблице стилей, где определен selector; не переносить стили события в root app. Для events app использовать его существующие токены и `min-height: 44px`, так как root `--tap` туда не наследуется.

- [ ] **Step 5: Проверить motion contract**

Убедиться, что все новые hover/active transitions меняют только `transform`, `opacity`, `filter`, `color`, `background-color` или `box-shadow`, длительность берется из существующего токена либо не превышает `240ms`. В каждом затронутом stylesheet дополнить существующий блок:

```css
@media (prefers-reduced-motion: reduce) {
  :where(a, button, summary) { transition: none; }
}
```

Не добавлять анимацию появления основного текста и не скрывать контент до animation end.

- [ ] **Step 6: Запустить DOM-тест и статические проверки**

Run: `npx tsx --test src/components/territory-map/territory-map.test.tsx`

Expected: PASS.

Run: `npm run lint && npm run typecheck && npm test`

Expected: PASS.

- [ ] **Step 7: Провести browser QA до commit**

Запустить приложение обычной командой `npm run dev`; через Browser/CUA открыть каждый публичный маршрут на 1440×900 и 390×844. Для каждого выполнить в странице:

```js
({
  horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  h1: [...document.querySelectorAll("h1")].map((node) => node.textContent?.trim()),
  brokenImages: [...document.images]
    .filter((image) => image.complete && image.naturalWidth === 0)
    .map((image) => image.currentSrc || image.src),
})
```

Expected: `horizontalOverflow: false`, ровно один содержательный `h1` на индексируемой странице, `brokenImages: []` после реальной последовательной прокрутки. Исключение: горизонтальный overflow внутри `.territory-filters` допустим и объяснен видимой подсказкой, но document overflow остается `false`.

Проверить zoom браузера 200% на `/`, `/karta`, `/bronirovanie` и одном длинном guide-разделе: текст не обрезается и controls остаются достижимыми.

- [ ] **Step 8: Commit**

```bash
git add -p -- package.json src/components/territory-map/territory-map.tsx src/components/territory-map/territory-map.test.tsx src/app/(public)/karta/territory.css src/app/globals.css src/app/(public)/[section]/guide.css src/app/(public)/bronirovanie/stay.css events-original/app/globals.css
git diff --cached
git commit -m "fix: harden public responsive interactions"
```

---

### Task 7: Verify Book Interaction and Reduced Motion in the Browser

**Files:**
- Modify only if a reproduced defect requires it: `src/components/book/story-book.tsx`, `src/components/book/use-book.ts`, `src/components/book/story-book.module.css`, `src/app/globals.css`
- Create: `docs/superpowers/audits/2026-11-22-public-and-admin-verification.md`

**Interfaces:**
- Consumes: five `BookChapter` objects, current book state machine, CSS `prefers-reduced-motion` media query.
- Produces: evidence that opening, paging, focus and CTAs work in normal and reduced-motion modes.

- [ ] **Step 1: Запустить книгу на desktop и mobile**

Через Browser/CUA на `/` проверить:

1. Закрытая обложка видна, в DOM нет второго `h1`.
2. Кнопка открытия переводит в chapter 1 и фокусирует заголовок активной главы.
3. CTA «Выбрать даты проживания» имеет `href="/bronirovanie"`.
4. «Листать дальше» открывает chapter 2 «Мероприятия».
5. Пустая правая рамка видна без `<img>` и без accessible image name.
6. CTA «Календарь» имеет `href="/meropriyatiya"`.
7. Последующее листание проходит главы 3–5 без потери существующего текста.
8. Оглавление и возврат к началу работают с клавиатуры.

Expected: нет overlay, console errors, скачка размера разворота или недостижимого focus.

- [ ] **Step 2: Повторить при reduced motion**

Эмулировать `prefers-reduced-motion: reduce`, перезагрузить `/` и повторить пункты 2, 4, 6, 7.

Expected: все переходы завершаются без ожидания `animationend`; элементы не остаются в `opening`/`departing` состоянии.

- [ ] **Step 3: Если reduced-motion выявил зависание, сначала добавить failing unit test**

Добавить в существующий test рядом с state helper точный сценарий, который воспроизводит зависание без `animationend`. Минимальный контракт state reducer:

```ts
assert.deepEqual(nextBookState({ entry: "opening", reducedMotion: true }, { type: "OPEN" }), {
  entry: "open",
  reducedMotion: true,
});
```

Если такого reducer в текущем коде нет, извлечь только чистую функцию перехода из `use-book.ts` и тестировать ее; не переписывать весь hook. Реализацию менять только после подтвержденного красного теста.

- [ ] **Step 4: Записать результаты книги в audit doc**

Создать таблицу:

```md
| Проверка | 1440×900 | 390×844 | Reduced motion | Результат |
|---|---:|---:|---:|---|
| Открытие и focus главы 1 | pass | pass | pass | без ошибок |
| Глава 2 и пустая рамка | pass | pass | pass | без img |
| CTA бронирования/календаря | pass | pass | pass | корректные href |
| Главы 3–5 и оглавление | pass | pass | pass | контент сохранен |
```

Вносить только наблюденные `pass`/`fail`; не утверждать непроведенную проверку.

- [ ] **Step 5: Запустить тесты после любого исправления**

Run: `npm test && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -p -- docs/superpowers/audits/2026-11-22-public-and-admin-verification.md src/components/book/story-book.tsx src/components/book/use-book.ts src/components/book/story-book.module.css src/app/globals.css src/components/book/*.test.tsx
git diff --cached
git commit -m "test: verify book motion and navigation"
```

Добавлять в commit только реально измененные файлы из списка.

---

### Task 8: Run Safe Functional Regression for Both Admin Panels

**Files:**
- Modify only when a reproduced critical defect has a failing test: existing file under `src/server/cms/*.test.ts`, `src/app/admin/site/**`, `events-original/tests/e2e/admin.spec.ts`, or `events-original/app/admin/**`
- Modify: `docs/superpowers/audits/2026-11-22-public-and-admin-verification.md`

**Interfaces:**
- Consumes: существующие auth/session/server-action contracts и изолированная events E2E database.
- Produces: безопасный функциональный отчет без реальной публикации, удаления, регистрации или Telegram-вызова.

- [ ] **Step 1: Проверить site admin серверными тестами**

Run: `npm run test:db`

Expected: PASS для auth, role access, draft/review/publish/restore и media reference contracts.

Если тест падает, не менять реализацию сразу: сузить команду до конкретного `.test.ts`, подтвердить стабильное падение, затем внести минимальный fix и повторить suite.

- [ ] **Step 2: Проверить site admin read-only в браузере**

На 1440×900 и 390×844 проверить:

- без сессии `/admin/site` перенаправляет на login;
- существующая активная учетная запись входит и выходит;
- dashboard, один редактор раздела, SEO, медиатека и сотрудники открываются согласно роли;
- глава 2 показывает необязательное фото и preview «Фотография пока не выбрана»;
- document-level horizontal overflow отсутствует.

Не нажимать save/publish/restore/delete на реальных данных. Контракты этих мутаций покрываются изолированными серверными тестами.

- [ ] **Step 3: Проверить events admin на изолированной E2E database**

Run: `npm --prefix events-original run test:e2e -- --project=desktop --project=mobile --grep "админ|вход|настройк|health"`

Expected: PASS; Telegram идет только в локальный mock из Playwright config, production database/uploads не используются.

- [ ] **Step 4: Дополнить audit doc наблюденными результатами**

Добавить таблицы:

```md
| Site admin | Desktop | Mobile | Источник доказательства |
|---|---:|---:|---|
| Redirect/login/logout | pass | pass | browser smoke |
| Editor/SEO/media/users | pass | pass | browser smoke + role tests |
| Draft/review/publish/restore | pass | n/a | isolated server tests |

| Events admin | Desktop | Mobile | Источник доказательства |
|---|---:|---:|---|
| Redirect/login/logout | pass | pass | isolated Playwright |
| Dashboard/new/settings | pass | pass | isolated Playwright |
| Health: db/migrations/uploads | pass | pass | `/api/health` test |
```

Также перечислить, что реальные Telegram, регистрации, публикации и удаления не выполнялись.

- [ ] **Step 5: Commit**

```bash
git add -p -- docs/superpowers/audits/2026-11-22-public-and-admin-verification.md
git diff --cached
git commit -m "docs: record public and admin verification"
```

Если исправлялся воспроизведенный дефект, добавить только соответствующий test и implementation file и отразить его в документе.

---

### Task 9: Full Regression, Visual Review, and Handoff

**Files:**
- Modify: `docs/superpowers/audits/2026-11-22-public-and-admin-verification.md`
- No product changes unless a new failure is first reproduced by a focused test.

**Interfaces:**
- Consumes: все deliverables Tasks 1–8.
- Produces: зеленый `npm run check`, зеленая events build/E2E, полный browser matrix и review-ready diff.

- [ ] **Step 1: Выполнить корневые проверки от узких к полным**

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run test:db
npm run build
npm run check
```

Expected: каждая команда PASS; финальный `npm run check` завершается кодом 0.

- [ ] **Step 2: Выполнить проверки events app**

Run:

```bash
npm --prefix events-original run lint
npm --prefix events-original run build
npm --prefix events-original run test:e2e
```

Expected: PASS; Playwright использует temp/isolated database и Telegram mock.

- [ ] **Step 3: Выполнить финальную матрицу публичных маршрутов**

На 1440×900 и 390×844 проверить `/`, `/prozhivanie`, `/besedki`, `/banketnye-zaly`, `/banya`, `/uslugi`, `/meropriyatiya`, `/karta`, `/galereya`, `/kontakty`, `/bronirovanie`:

- HTTP 200;
- единственный ожидаемый `h1`;
- canonical на индексируемых маршрутах;
- document-level horizontal overflow отсутствует;
- после последовательной прокрутки нет broken images;
- нет framework overlay и релевантных console errors;
- menu, gallery, map filters/zoom, booking validation и две CTA книги работают.

- [ ] **Step 4: Проверить клавиатуру и 200% zoom на ключевых экранах**

Порядок Tab должен быть видимым и логичным на `/`, `/karta`, `/bronirovanie`, `/meropriyatiya`; Enter/Space активируют button/summary, Escape закрывает карточку карты. При 200% zoom текст остается в рамках, а интерактивные элементы не перекрываются.

- [ ] **Step 5: Провести self-review diff**

Run:

```bash
git status --short
git diff --check
git diff --stat HEAD~9..HEAD
git diff HEAD~9..HEAD -- src events-original eslint.config.mjs package.json docs/superpowers/audits
```

Expected: нет whitespace errors, secrets, новых сервисов/библиотек, изменений фактов/цен/условий или случайно staged пользовательских файлов. Если число commit отличается, заменить `HEAD~9` на commit до начала выполнения плана.

- [ ] **Step 6: Запросить code review**

Применить skill `requesting-code-review`. Reviewer должен проверить:

- соответствие spec и миграцию без потери четырех старых глав;
- optional photo только для events;
- единственный `h1`, canonical и доступность пустой рамки;
- отсутствие параллельного источника booking data;
- безопасную работу с dirty tree;
- подтвержденные команды тестов и browser matrix.

Критические замечания исправлять test-first; рекомендации вне spec перечислить отдельно, не расширяя scope автоматически.

- [ ] **Step 7: Завершить audit doc и commit**

В конец документа добавить точные команды с `PASS`, список проверенных viewport/zoom/motion режимов, ссылки на unresolved external blockers (если они воспроизведены) и SHA последнего implementation commit.

```bash
git add -p -- docs/superpowers/audits/2026-11-22-public-and-admin-verification.md
git diff --cached
git commit -m "docs: finalize site audit results"
```

---

## Plan Self-Review Results

- **Spec coverage:** подтвержденные проблемы 1–7 покрыты Tasks 1, 5, 6, 7 и 9; новая глава и миграция CMS — Tasks 2–4; обе admin-панели — Task 8; полный quality gate — Task 9.
- **Placeholder scan:** план не содержит неопределенных реализационных шагов; каждое условное исправление разрешено только после воспроизводимого failing test и указывает точные допустимые файлы.
- **Type consistency:** `EventsChapter.photo?`, `CmsEventsChapter.photo?`, `BookChapter.image?`, `photo(id?: string)` и `photoReferences` согласованы; фиксированный порядок везде `opening, events, index, closing, manifesto`.
- **Scope check:** работа затрагивает публичный UI, CMS-контракт и две панели, но объединена одним утвержденным аудитом и общей книгой; каждое task-deliverable независимо тестируемо и не вводит новый сервис.
