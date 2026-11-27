# Правила работы с проектом

- Сохраняйте проект модульным монолитом на Next.js App Router; новые сервисы или приложения добавляйте только после отдельного архитектурного решения.
- Публичные страницы размещайте в `src/app/(public)`, общие UI-компоненты — в `src/components`, серверный код и адаптеры — в `src/server`.
- Не создавайте пустые каталоги и абстракции «на будущее»: модуль появляется вместе с первым рабочим сценарием.
- По умолчанию используйте Server Components. Клиентский JavaScript добавляйте только для реального взаимодействия.
- Все цвета, типографику, интервалы и эффекты проводите через дизайн-токены. Учитывайте мобильные устройства и `prefers-reduced-motion`.
- Не храните секреты в Git. Доступ к TravelLine и другим внешним системам должен идти только через серверные адаптеры и переменные окружения.
- Не создавайте параллельный источник истины для бронирований проживания: TravelLine остаётся владельцем этих данных.
- Для индексируемых страниц задавайте уникальные метаданные, canonical и подходящие структурированные данные без вымышленных фактов.
- Перед commit запускайте `npm run check`; для визуальных изменений дополнительно проверяйте страницу в браузере на мобильной и desktop-ширине.
- Не меняйте утверждённую концепцию, меню, факты об объекте, цены и условия без согласования с руководителем проекта.

- Разрабатывайте локально, проверяйте и публикуйте изменения в GitHub. Обновляйте staging только после согласования точного коммита руководителем проекта.
- Для staging используйте сценарий из docs/DEPLOYMENT.md. Собирайте чистый архив согласованного коммита. Перед сменой версии сохраняйте рабочие данные. Исходники на сервере не редактируйте.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
