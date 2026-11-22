# Inline Content Photo Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить возле каждого контентного изображения кнопку «Выбрать фото», сохраняющую замену в черновике и публикующую её во всех местах использования стабильного медиа-идентификатора.

**Architecture:** Основная CMS продолжает хранить ссылки на фотографии по стабильному `id`, а замена меняет файловые поля записи медиатеки. Редактор страницы держит согласованные локальные снимки документа и медиатеки; сервер сохраняет, отправляет на проверку и публикует оба документа в одной транзакции. Изолированный модуль мероприятий сохраняет существующий собственный файловый адаптер и уже реализованный сценарий выбора фотографии.

**Tech Stack:** Next.js 16.4.6 App Router, React 19.3.1, TypeScript 5.9.3, PostgreSQL, Drizzle ORM, Zod, Sharp, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-22-inline-content-photo-replacement-design.md`

## Global Constraints

- Сохранять модульный монолит и существующие границы модулей.
- Использовать Server Components по умолчанию; клиентский код ограничить существующим редактором CMS.
- Не менять меню, тексты, цены, условия или факты об объекте.
- Не включать декоративную графику, карту, физическое удаление файлов или сборку мусора.
- JPEG, PNG, WebP и AVIF: не более 8 МБ и 24 мегапикселей; результат WebP не больше 1800 × 1800.
- Новая фотография видна публично только после публикации.
- Перед завершением выполнить `npm run check` и визуальную проверку mobile/desktop.

---

### Task 1: Разрешить безопасную замену файла у стабильного медиа-объекта

**Files:**
- Modify: `src/server/cms/model.ts`
- Create: `src/server/cms/media-replacement.ts`
- Test: `src/server/cms/model.test.ts`
- Test: `src/server/cms/media-replacement.test.ts`

**Interfaces:**
- Consumes: `CmsMedia` и ресурс, возвращаемый `prepareCmsImage`.
- Produces: `replaceMediaFile(current: CmsMedia, uploaded: CmsMedia): CmsMedia`.

- [ ] **Step 1: Написать тест модели, который ломается при попытке заменить встроенное фото CMS-файлом**

```ts
test("a built-in media identity may point to a validated CMS replacement", () => {
  const media = structuredClone(siteDefaults.media);
  const asset = media.items.find((item) => item.id === "house-oaks")!;
  const digest = "a".repeat(64);
  Object.assign(asset, {
    src: `/cms-media/${digest}.webp`,
    sourceUrl: `/cms-media/${digest}.webp`,
    width: 1600,
    height: 900,
  });
  assert.deepEqual(parseSiteData("media", media), media);
});
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает на текущем запрете изменения встроенного ресурса**

Run: `node --import tsx --test src/server/cms/model.test.ts`

Expected: FAIL в новом тесте с `CmsError`.

- [ ] **Step 3: Разрешить два валидных состояния встроенного `id`**

В `mediaSchema` принять либо точные исходные файловые поля, либо пару одинаковых путей `/cms-media/<sha256>.webp` с положительными размерами. Произвольные URL и несовпадающие `src`/`sourceUrl` должны по-прежнему отклоняться.

- [ ] **Step 4: Написать падающий тест чистой операции замены**

```ts
test("replacement keeps editorial identity and crop while changing file metadata", () => {
  const current = siteDefaults.media.items.find((item) => item.id === "house-oaks")!;
  const uploaded = {
    ...current,
    id: `upload-${"b".repeat(64)}`,
    src: `/cms-media/${"b".repeat(64)}.webp`,
    sourceUrl: `/cms-media/${"b".repeat(64)}.webp`,
    width: 1500,
    height: 1000,
    name: "Новая фотография",
    alt: "",
    description: "",
    focalPoint: "50% 50%" as const,
  };
  const result = replaceMediaFile({ ...current, name: "Дом" }, uploaded);
  assert.equal(result.id, "house-oaks");
  assert.equal(result.name, "Дом");
  assert.equal(result.alt, current.alt);
  assert.equal(result.focalPoint, current.focalPoint);
  assert.equal(result.src, uploaded.src);
  assert.equal(result.width, 1500);
});
```

- [ ] **Step 5: Запустить тест и увидеть ошибку отсутствующего модуля**

Run: `node --import tsx --test src/server/cms/media-replacement.test.ts`

Expected: FAIL из-за отсутствующего `replaceMediaFile`.

- [ ] **Step 6: Реализовать минимальную чистую функцию**

```ts
export function replaceMediaFile(current: CmsMedia, uploaded: CmsMedia): CmsMedia {
  return {
    ...current,
    src: uploaded.src,
    sourceUrl: uploaded.sourceUrl,
    width: uploaded.width,
    height: uploaded.height,
  };
}
```

- [ ] **Step 7: Запустить оба теста**

Run: `node --import tsx --test src/server/cms/model.test.ts src/server/cms/media-replacement.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/server/cms/model.ts src/server/cms/model.test.ts src/server/cms/media-replacement.ts src/server/cms/media-replacement.test.ts
git commit -m "feat: allow stable media file replacement"
```

### Task 2: Сохранять и публиковать страницу вместе с медиатекой

**Files:**
- Modify: `src/server/cms/store.ts`
- Test: `src/server/cms/store.test.ts`

**Interfaces:**
- Consumes: существующие `saveDraft`, `submitDraft`, `publishDraft`.
- Produces: опциональный аргумент `relatedMedia?: { revision: number; input?: SiteData["media"] }` у этих операций; результат `{ revision: number; mediaRevision?: number }`.

- [ ] **Step 1: Написать интеграционный тест связанной публикации**

Тест заменяет `house-oaks` на реальный подготовленный CMS-файл, вызывает связанное сохранение, проверяет неизменность публичных данных, затем вызывает связанную публикацию и проверяет новый `src` одновременно в `readPublished("media")` и через неизменный `photo` страницы `prozhivanie`.

```ts
const saved = await saveDraft("prozhivanie", page.draft, page.revision, editor, {
  revision: media.revision,
  input: replacementMedia,
});
assert.equal((await readPublished("media")).items.find(({ id }) => id === "house-oaks")!.src, originalSrc);
await publishDraft("prozhivanie", saved.revision, admin, {
  revision: saved.mediaRevision!,
});
assert.equal((await readPublished("media")).items.find(({ id }) => id === "house-oaks")!.src, replacementSrc);
```

- [ ] **Step 2: Запустить БД-тест и увидеть ошибку сигнатуры/поведения**

Run: `node scripts/test-events-db.mjs`

Expected: FAIL в новом сценарии связанного изменения.

- [ ] **Step 3: Рефакторить внутренний `change` на применение действия к уже заблокированной строке**

Вынести вычисление `next`, проверку публикации, обновление строки и audit insert в `changeLockedDocument(tx, row, key, actorId, action, input)`. Сохранить текущую семантику одиночных операций.

- [ ] **Step 4: Добавить связанную блокировку медиатеки**

Если `key !== "media"` и передан `relatedMedia`, сначала заблокировать строку `media`, проверить её ревизию, применить то же действие, затем применить действие к основному документу в той же транзакции. Для публикации сохранить advisory lock и применить медиатеку до проверки ссылок страницы.

- [ ] **Step 5: Проверять существование любого опубликованного CMS-файла**

В `checkPublication` выбирать ресурсы по `item.src.startsWith("/cms-media/")`, а не только по `id.startsWith("upload-")`, чтобы замены встроенных идентификаторов также проверялись через `hasCmsImage`.

- [ ] **Step 6: Добавить тест отката всей транзакции при устаревшей ревизии одного документа**

```ts
await assert.rejects(
  saveDraft("prozhivanie", page.draft, page.revision, editor, {
    revision: media.revision - 1,
    input: replacementMedia,
  }),
  /другом окне/,
);
assert.deepEqual((await readDocument("media")).draft, media.draft);
```

- [ ] **Step 7: Запустить БД-тесты**

Run: `node scripts/test-events-db.mjs`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/server/cms/store.ts src/server/cms/store.test.ts
git commit -m "feat: publish media replacements with content"
```

### Task 3: Передавать связанный снимок медиатеки через Server Action

**Files:**
- Modify: `src/app/admin/site/content-actions.ts`
- Modify: `src/components/site-admin/edit-screen.tsx`
- Modify: `src/components/site-admin/editor.tsx`
- Test: `src/server/cms/store.test.ts`

**Interfaces:**
- Produces: `RelatedMediaInput = { revision: number; data?: SiteData["media"] }`.
- Produces: ответ `updateSiteContent` с `snapshot` и `mediaSnapshot` при связанной операции.

- [ ] **Step 1: Расширить существующий интеграционный тест ожидаемыми снимками после save/publish**

Проверить, что возвращаемые ревизии позволяют выполнить следующий шаг без повторного чтения и что оба документа получают одинаковое состояние `draft`, `review` или `published`.

- [ ] **Step 2: Запустить тест до изменения Server Action**

Run: `node scripts/test-events-db.mjs`

Expected: FAIL из-за отсутствующего связанного снимка/ревизии.

- [ ] **Step 3: Расширить `updateSiteContent`**

Добавить параметр `relatedMedia?: RelatedMediaInput`, передать его в store только для документов, отличных от `media`, и после операции вернуть `mediaSnapshot` из `readDocument("media")`. При публикации связанной медиатеки выполнить `revalidatePath("/", "layout")`.

- [ ] **Step 4: Передать полный начальный снимок медиатеки в редактор**

`SiteEditScreen` передаёт `mediaInitial` с draft, revision, state, publishedAt, previousAt и hasPrevious вместо раздельных `media`/`publishedMedia`.

- [ ] **Step 5: В редакторе вести два согласованных состояния**

Добавить `savedMedia`/`mediaValue`, вычислять `mediaDirty`, включать его в защиту от ухода и отправлять связанную медиатеку при `save`. При `submit` и `publish` передавать её ревизию, если медиатека была связана с текущей сессией. После ответа обновлять оба снимка.

- [ ] **Step 6: Проверить типы**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/site/content-actions.ts src/components/site-admin/edit-screen.tsx src/components/site-admin/editor.tsx src/server/cms/store.test.ts
git commit -m "feat: coordinate content and media drafts"
```

### Task 4: Добавить переиспользуемую кнопку «Выбрать фото» во все фотослоты

**Files:**
- Modify: `src/components/site-admin/fields.tsx`
- Modify: `src/components/site-admin/content-fields.tsx`
- Modify: `src/components/site-admin/media-library.tsx`
- Modify: `src/components/site-admin/editor.tsx`
- Modify: `src/app/admin/site/admin.css`
- Test: `src/components/site-admin/photo-field.test.tsx`
- Modify: `package.json`

**Interfaces:**
- Produces: `uploadPhoto(file: File): Promise<CmsMedia>` внутри клиентского редактора.
- Produces: `replacePhoto(currentId: string | undefined, uploaded: CmsMedia): string`, обновляющий `mediaValue` и возвращающий назначенный `id`.
- `PhotosField` принимает `onUpload(file: File): Promise<string | undefined>`.

- [ ] **Step 1: Написать падающий компонентный тест фотослота**

Использовать server-rendered markup, как существующие `.test.tsx`: слот с текущим ресурсом должен содержать изображение и доступную подпись «Выбрать фото», а необязательный слот — действие удаления.

```ts
test("photo field exposes an inline file chooser beside the current preview", () => {
  const html = renderToStaticMarkup(
    <PhotosField label="Главная фотография" value="house-oaks" items={items}
      publishedMedia={["house-oaks"]} onChange={() => {}} onUpload={async () => undefined} />,
  );
  assert.match(html, /Главная фотография/);
  assert.match(html, /Выбрать фото/);
  assert.match(html, /type="file"/);
});
```

- [ ] **Step 2: Запустить тест и увидеть отсутствие нового API/контрола**

Run: `node --import tsx --test src/components/site-admin/photo-field.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Реализовать загрузку и замену локального ресурса**

В `ContentEditor` отправлять файл на существующий `/admin/site/media/upload`, затем для существующего `id` применять `replaceMediaFile`-эквивалент на клиенте, а для пустого слота добавлять возвращённый `upload-*` объект. Ошибки показывать рядом со слотом, `uploading` блокирует сохранение.

- [ ] **Step 4: Расширить `PhotosField`**

Сохранить возможность выбрать уже существующий ресурс из медиатеки, добавить `<input type="file" accept="image/jpeg,image/png,image/webp,image/avif">` с подписью «Выбрать фото», состояние загрузки и сообщение об ошибке. После успешной загрузки вызвать `onChange` с возвращённым `id`.

- [ ] **Step 5: Подключить загрузку ко всем одиночным фотослотам**

Передать обработчик в баннеры разделов, карточки объектов и главы книги через `GuideFields`/`BookFields`.

- [ ] **Step 6: Подключить замену к каждой позиции галереи и медиатеке**

Каждая карточка галереи получает тот же фотослот; добавление новой позиции использует пустой слот. В `MediaLibrary` кнопка у выбранного ресурса заменяет его файл с сохранением `id`, `name`, `alt`, `description` и `focalPoint`.

- [ ] **Step 7: Добавить стили через существующие admin-токены**

Добавить только классы компоновки и скрытого нативного input; цвета, интервалы, границы и фокус использовать из `--sa-*`. Не добавлять анимацию.

- [ ] **Step 8: Запустить компонентный тест и включить его в `npm test`**

Run: `node --import tsx --test src/components/site-admin/photo-field.test.tsx && npm test`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/site-admin/fields.tsx src/components/site-admin/content-fields.tsx src/components/site-admin/media-library.tsx src/components/site-admin/editor.tsx src/app/admin/site/admin.css src/components/site-admin/photo-field.test.tsx package.json
git commit -m "feat: add inline photo replacement controls"
```

### Task 5: Полная проверка и визуальная приёмка

**Files:**
- Modify only files required by failures found in this task.

**Interfaces:**
- Consumes: completed photo replacement flow.
- Produces: verified build and browser behavior.

- [ ] **Step 1: Запустить точечные тесты CMS**

Run: `node --import tsx --test src/server/cms/model.test.ts src/server/cms/media-replacement.test.ts src/components/site-admin/photo-field.test.tsx`

Expected: PASS.

- [ ] **Step 2: Запустить интеграционные БД-тесты**

Run: `node scripts/test-events-db.mjs`

Expected: PASS.

- [ ] **Step 3: Запустить обязательную проверку проекта**

Run: `npm run check`

Expected: lint, typecheck, tests, DB tests и production build проходят без ошибок.

- [ ] **Step 4: Проверить desktop-сценарий в браузере**

На `/admin/site/prozhivanie` заменить баннер, убедиться в новом предпросмотре и старом публичном баннере до публикации; сохранить и опубликовать; проверить новый баннер и карточку с тем же `id` на публичной странице.

- [ ] **Step 5: Проверить остальные типы фотослотов**

Проверить карточку объекта, позицию галереи, главу книги и медиатеку. В `/meropriyatiya/admin` проверить существующую замену главной фотографии события и фотографии услуги.

- [ ] **Step 6: Проверить мобильную ширину и доступность**

При ширине 390 px кнопка «Выбрать фото», превью, сообщения об ошибках и панель публикации не выходят за viewport; управление доступно с клавиатуры, фокус видим, статус загрузки озвучивается.

- [ ] **Step 7: Просмотреть итоговый diff и сохранить только относящиеся к задаче файлы**

Run: `git diff --check && git status --short`

Expected: нет whitespace errors; пользовательские несвязанные изменения не затронуты.

