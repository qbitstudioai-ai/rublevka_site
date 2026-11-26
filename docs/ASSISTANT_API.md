# API ассистента AI‑01

Базовый путь основного сайта — `/api/assistant/v1`. Все ответы API имеют JSON и `Cache-Control: private, no-store`. Примеры контрактов ниже используют условные идентификаторы. Данные о бронировании и цены проживания появятся после подключения провайдера.

## Авторизация

| Контур | Авторизация |
| --- | --- |
| Знания и бронирование | `Authorization: Bearer <ASSISTANT_KNOWLEDGE_KEY>` |
| Сайт → webhook n8n | `Authorization: Bearer <ASSISTANT_N8N_WEBHOOK_KEY>` |
| Callback ИИ | HMAC с `ASSISTANT_N8N_CALLBACK_KEY` |
| Операторские команды и callback сотрудника | HMAC с `ASSISTANT_OPERATOR_KEY` |
| Основной сайт → SQLite-адаптер афиши | Отдельный bearer `ASSISTANT_EVENTS_KEY` |
| Браузер | Same-origin, заголовок `X-Assistant-Client: browser`, cookie сессии для сообщений |

Для HMAC передайте `X-Assistant-Timestamp` (Unix-время в секундах) и `X-Assistant-Signature` (64 строчные hex-цифры HMAC-SHA256 от строки `timestamp + "." + rawBody`, UTF‑8). Подписывайте ровно отправляемый JSON. Окно времени составляет ±300 секунд. При повторе за пределами окна подпишите заново с тем же ID. Идентификаторы сообщений и команд — UUID, уникальные в пределах диалога. Один ключ используйте только по его назначению.

## Знания и бронирование

Все маршруты этой группы возвращают `{ "source": string, "retrievedAt": ISODateTime, "data": ... }`.

| Метод и маршрут | Вход | Схема data |
| --- | --- | --- |
| GET `/complex` | — | `{name,description,address,location,contacts:{phone,email,url},visitingTerms,stayRules,checkIn,checkOut,url}`. Неопубликованные поля равны `null`. |
| GET `/faq` | — | `{items:[], status:"unpublished"}` до появления утверждённой справки. |
| GET `/accommodations` | `q`, `category`, минимальные `capacity` и `bedrooms`, `limit`, `offset` | Страница с `{id,title,category,capacity,photos,url}`. |
| GET `/accommodations/:id` | ID опубликованной категории | Краткая карточка плюс `description,adults,children,bedrooms,beds,amenities,restrictions,providerCategoryId,mapObjectId,features,enquiryUrl`. |
| GET `/services` | `q`, `section` из `banya,besedki,banketnye-zaly,uslugi`, `limit`, `offset` | Страница с `{id,section,title,photo,url}`. |
| GET `/services/:id` | ID раздела или ID вида `section-itemId` | Краткая карточка плюс `description,details`. Состояние бронирования услуг не проверяется. |
| GET `/events` | `q,from,to,limit,offset` | Страница с краткими объектами мероприятий. |
| GET `/events/:id` | Числовой ID SQLite или slug | `{item: EventDetail}`. |
| POST `/availability` | `BookingRequest` | `{status,enquiryUrl}`, в будущем также `offers`. |
| POST `/booking-link` | `BookingRequest` | `{status,enquiryUrl}`, в будущем также `url`. |

Страница имеет форму `{items: T[], total: integer, limit: integer, offset: integer}`. По умолчанию `limit=20`, максимальный размер — 50, смещение — от 0 до 10000. `q` — регистронезависимый поиск по названию, для афиши также по краткому и полному описанию. Даты `from` и `to` включительны. Мероприятие попадает в выдачу при пересечении дат, включая многодневные события. Архив, черновики и закончившиеся события исключены из списка. Подробности опубликованного прошедшего события доступны с `active:false`. Если точное время окончания не задано, событие считается актуальным до конца последнего дня.

```text
EventSummary = {
  id: integer, slug: string, title: string, description: string,
  startsOn: YYYY-MM-DD, startsAt: HH:mm, endsOn: YYYY-MM-DD, endsAt: HH:mm | null,
  timeZone: string, priceKopecks: integer, currency: "RUB", status: "published",
  photo: URL | null, url: URL
}
EventDetail = EventSummary & {
  active: boolean, longDescription: string | null, location: string | null,
  schedule: { label: string, value: string }[], extraInfo: string | null,
  activities: {
    id: integer, title: string, teaser: string, description: string,
    image: { src: URL, alt: string } | null, gallery: { src: URL, alt: string }[],
    pricingType: "fixed" | "free" | "contact", priceKopecks: integer | null, priceSuffix: string | null,
    time: HH:mm | null, duration: string | null, details: string[]
  }[],
  registrationUrl: URL | null
}
BookingRequest = {
  arrival: YYYY-MM-DD, departure: YYYY-MM-DD, adults: integer[1..100], children: integer[0..100],
  childAges?: integer[0..17][], categoryId?: string, objectId?: string
}
```

Нулевая цена мероприятия соответствует бесплатному участию в действующей SQLite. Деньги у мероприятий и дополнительных услуг измеряются в копейках. Дополнительные услуги выдаются только для запрошенного мероприятия и только активные. SQLite-адаптер доступен приложению по `EVENTS_ORIGINAL_ORIGIN/meropriyatiya/api/internal/assistant/events`; публичный прокси сайта закрывает этот маршрут. n8n обращается к основному API.

Пример запроса `POST /availability`:

```json
{"arrival":"2099-06-01","departure":"2099-06-03","adults":2,"children":1,"childAges":[7],"categoryId":"family"}
```

```json
{"source":"booking-provider","retrievedAt":"2099-05-01T12:00:00.000Z","data":{"status":"provider_not_configured","enquiryUrl":"https://example.com/bronirovanie"}}
```

Возможные статусы провайдера — `available`, `no_availability`, `provider_not_configured`, `provider_error`. При `available` проверка возвращает `offers: {id,categoryId,amountMinor,currency}[]`, формирование ссылки — `url`. На AI‑01 активен только `provider_not_configured`. `objectId` принимает ID опубликованного объекта проживания на карте. Его связь с категорией провайдера пока не установлена. Если переданы возрасты, их количество должно совпадать с `children`. Заезд не раньше сегодняшней даты по времени комплекса, выезд строго позже заезда.

## Браузерный чат

| Метод и маршрут | Контракт |
| --- | --- |
| POST `/chat/session` | `{}` проверяет конфигурацию и восстанавливает действующую сессию. `{"create":true}` создаёт сессию при первом сообщении. `{"reset":true}` удаляет предыдущий диалог и создаёт новый. Ответ `{available,active,greeting,unavailable,contact:{title,url}}`. |
| POST `/chat/messages` | `{id,text,context:{path,mapObjectId?,stay?:{arrival?,departure?,adults?,children?,categoryId?}}}`. `id` повторяется при повторе той же отправки. Текст до 2000 символов. `202 {status:"accepted"|"duplicate",id}` либо `503 {status:"delivery_failed",id}`. |
| GET `/chat/messages` | `{owner,closed,acknowledge:UUID[],messages: Message[]}`. Снимок до 40 записей, в порядке `sequence`. Браузер опрашивает только открытый чат на видимой странице. |
| POST `/chat/ack` | `{ids: UUID[]}` до 20 ID после отображения. Ответ `{status:"accepted"}`. Без подтверждения запись остаётся в очереди. |

`Message = {id,sequence,source,requestId,text,cards,status,createdAt}`. `source` — `guest`, `assistant` или `staff`. `status` — `pending`, `complete` или `failed`. `requestId` равен UUID запроса или `null`. Элементы `cards` имеют вид `{title,url,photo?}`. Токен сессии выдаётся в HttpOnly SameSite=Strict cookie, по HTTPS с Secure. В PostgreSQL хранится SHA‑256 токена. Повторное открытие другой страницы на том же origin восстанавливает сессию.

## Webhook и callback

Webhook получает JSON следующей формы:

```json
{
  "protocol":"1",
  "dialogId":"ab40f0ed-41e5-4ac1-a169-865dea499b83",
  "id":"68012265-400f-4edb-be2a-896de907f84d",
  "text":"Нужен коттедж на выходные",
  "time":"2099-05-01T12:00:00.000Z",
  "context":{"route":"/prozhivanie","type":"accommodations","id":null,"stay":null},
  "dialog":{"version":1,"owner":"assistant","consultation":"none","telegramTopic":null,"salesStage":null,"need":null,"summary":null,"history":[]}
}
```

`context.type` — `home`, `booking`, `accommodations`, `map`, `events`, `event`, `service`, `page` или `other`. Сервер проверяет public route и ID по опубликованным данным. `history` содержит до 12 записей `{source,text}`. Сайт удаляет распознаваемые телефоны, email, мессенджерные имена, ссылки и явно подписанные персональные поля. Имена и адреса в произвольном тексте могут остаться. Перед передачей внешней модели нужен дополнительный контроль PII в n8n. Идентификатор темы Telegram предназначен для маршрутизации в n8n. По содержимому webhook нужно принимать данные как недоверенные.

Webhook подтверждает приём любым 2xx. На запрос отводится 2 секунды, допускается один повтор при сетевой ошибке, 429 или 5xx, с тем же `Idempotency-Key`. Тело ответа игнорируется. n8n должен дедуплицировать по `dialogId + id`. По истечении двух минут ожидающий ответ перестаёт приниматься. Перезапуск в момент передачи может оставить запрос в состоянии ожидания до тайм-аута. Это ограниченный HTTP-транспорт с идемпотентностью, без гарантии доставки webhook при отказе процесса.

Подписанный `POST /callback` для ИИ и `POST /callback/staff` для сотрудника:

```json
{
  "dialogId":"ab40f0ed-41e5-4ac1-a169-865dea499b83",
  "id":"17a4ad50-4b4b-433d-90c9-aefcd9af5135",
  "requestId":"68012265-400f-4edb-be2a-896de907f84d",
  "version":1,"source":"assistant","status":"completed",
  "text":"Посмотрите отдельный коттедж.",
  "cards":[{"type":"accommodation","id":"cottage"},{"type":"booking","id":"cottage"},{"type":"contact"}]
}
```

`status` — `completed` или `failed`. Успешный ответ содержит текст до 3500 символов и/или до 6 карточек. `requestId` обязателен для ответа ИИ и может быть `null` для отдельного сообщения сотрудника. Допустимые карточки — `accommodation`, `service`, `event`, `booking`, `registration` с `id`, а также `contact` без ID. Сайт сам разрешает идентификаторы в актуальные ссылки и фотографии. Карточка `booking` открывает существующую форму обращения, `registration` разрешена только при действующей регистрации. Callback не принимает сырые URL или HTML. Ответ `{status:"accepted"|"duplicate"}`.

Подписанный `POST /operator` принимает `{dialogId,id,version,action,telegramTopic?,salesStage?,need?,summary?}`. `action` — `request_consultation`, `complete_consultation`, `takeover`, `release` или `close`. Результат консультации можно передать через `summary` при `complete_consultation`. `telegramTopic` — числовой ID строкой, `need` — объект с необязательными `categoryId,adults,children,dates:{arrival,departure}`. Ответ `{status,owner,version,closed,consultation}`. `consultation`: `none`, `requested`, `completed`.

Диалог начинается с `version:1` и владельца `assistant`. При смене владельца и закрытии версия увеличивается. На старой версии публикация callback невозможна. При перехвате неподтверждённые ответы ИИ аннулируются под той же блокировкой диалога, а уже подтверждённые виджетом остаются в короткой истории. Сайт принимает ответы сотрудника при владельце `staff`. У завершённого диалога историю можно прочитать до истечения срока хранения. Старый токен после сброса недействителен.

До 20 неподтверждённых ответов и до 1000 ID на диалог. Снимок сообщений ограничен 40 записями. Одновременно в режиме ИИ обрабатывается один запрос. Сессии ограничены 120 новыми диалогами в минуту на экземпляр PostgreSQL, запросы передачи — 12 в минуту на диалог, опрос и подтверждения — по 40 в минуту. По умолчанию сессия хранится 24 часа с момента создания, затем диалог, сообщения и receipt IDs очищаются каскадно. Для регулярной очистки при отсутствии новых сессий запускайте `npm run assistant:cleanup` из планировщика окружения.

## Ошибки

JSON ошибок имеет вид `{error: string}`, кроме зафиксированного `delivery_failed` в отправке сообщения.

| HTTP | Коды |
| --- | --- |
| 400 | `invalid_input`, `invalid_json`, `invalid_category`, `invalid_card` |
| 401 | `unauthorized`, `session_required` |
| 403 | `invalid_origin`, `wrong_source` |
| 404 | `not_found`, `dialog_not_found` |
| 405 | `method_not_allowed` |
| 409 | `id_conflict`, `dialog_closed`, `dialog_limit`, `reply_pending`, `stale_state`, `stale_request`, `unknown_request`, `delivery_queue_full` |
| 413 / 415 | `body_too_large` / `json_required` |
| 429 | `rate_limited` |
| 503 | `chat_unavailable`, `events_unavailable`, `temporarily_unavailable`, либо статус `delivery_failed` |

## Переменные окружения и локальная проверка

| Переменная | Назначение |
| --- | --- |
| `DATABASE_URL`, `CMS_ENABLED`, `SITE_URL` | Существующие настройки PostgreSQL, публичной CMS и канонического origin. |
| `EVENTS_ORIGINAL_ORIGIN` | Внутренний origin приложения афиши, локально `http://127.0.0.1:3271`. |
| `ASSISTANT_EVENTS_KEY` | Одинаковый секрет на основном сайте и в окружении афиши. |
| `EVENTS_ASSISTANT_MOUNTED` | Для процесса афиши `true`, если она опубликована под origin главного сайта. Скрипт разработки выставляет автоматически. |
| `ASSISTANT_KNOWLEDGE_KEY` | Серверный ключ API знаний. |
| `ASSISTANT_CHAT_ENABLED` | Второй ключ включения чата, по умолчанию `false`. Нужна также галочка в существующей панели `/admin/site/assistant`. |
| `ASSISTANT_N8N_WEBHOOK_URL` | Точный HTTPS URL webhook. HTTP для loopback допускается в разработке, редиректы запрещены. |
| `ASSISTANT_N8N_WEBHOOK_KEY`, `ASSISTANT_N8N_CALLBACK_KEY`, `ASSISTANT_OPERATOR_KEY` | Независимые секреты исходящего webhook, callback ИИ и оператора. |
| `ASSISTANT_RETENTION_HOURS` | От 1 до 168 часов, по умолчанию 24. |

1. Запустите изолированную PostgreSQL по инструкции README. Выполните `npm run db:migrate` и при включении CMS — `npm run site:seed`. Администратор меняет настройки и приветствие в действующей панели. Изменения настроек журналируются.
2. Задайте локальный `SITE_URL`, отдельные тестовые ключи знаний и афиши и запустите `npm run dev -- --port 3270`. Проверьте ответы `GET /api/assistant/v1/events?from=2099-04-02&to=2099-04-02` и `GET /api/assistant/v1/accommodations` с bearer. Убедитесь, что браузер показывает недоступность чата при выключенной интеграции.
3. Выполните `npm run check` в корне. Для SQLite и браузерных сценариев выполните `npm --prefix events-original test` с браузерами Playwright, установленными для его версии. Mock n8n используется в автоматизированном тесте отправки.

## Сведения, требующие подтверждения

- В опубликованной CMS отсутствуют отдельные правила проживания и посещения, время заезда и выезда, FAQ и отдельная карточка ресторана. Тексты из исторических мероприятий не подменяют опубликованные сведения об услуге.
- Категории `room`, `cottage`, `bedrooms`, `family` сохраняют действующие ID для формы обращения. Фото и вместимость берутся из публичных карточек. Дополнительные характеристики редактируются в CMS. Допустимый состав гостей, число спален и кроватей, удобства и ограничения требуют заполнения структурированных полей. Карта содержит физические объекты, а однозначное сопоставление категорий документально не подтверждено.
- Идентификаторы Bnovo, доступность, тарифы и ссылки бронирования появятся после получения доступа и согласования контракта. Действующая форма обращения и используемый сайтом механизм бронирования сохраняются.
- Перед включением в production руководитель проекта проверяет транспорт и правила обработки персональных данных, включая окончательный срок хранения, временную cookie при первом обращении и дополнительное обезличивание свободного текста в n8n.
