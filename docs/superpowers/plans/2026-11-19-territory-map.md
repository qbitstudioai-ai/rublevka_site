# Territory Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Выпустить первую версию карты комплекса по утверждённому макету «Дубовая роща».

**Architecture:** Серверная страница передаёт небольшой публичный набор точек в интерактивную SVG-карту. Источник инвентаря и геометрии — технические данные PR №8.

**Tech Stack:** Next.js App Router, React, TypeScript, SVG, CSS, Node test runner, Playwright.

**Spec:** [Дизайн карты](../specs/2026-11-19-territory-map-design.md).

## Global Constraints

- Сохранить 30 номеров объектов и 16 отмеченных входов. Номер 7 пропущен.
- Соблюдать утверждённые маршруты разделов и общую политику индексации.
- Пройти `npm run check`, production build и desktop/mobile QA. Скриншоты публикуются в отдельной review-ветке.

### Инвентарь и геометрия

- [ ] Проверить номера, количество входов, направления CTA, геометрию залов и пределы вида в `src/content/territory-map.test.ts`.
- [ ] Реализовать преобразование `docs/territory-map/objects.json` в модель карточки и SVG в `src/content/territory-map.ts` и `src/content/territory-view.ts`.

### Страница и взаимодействие

- [ ] Проверить появление маршрута, фильтры, карточки, переходы, фокус и жесты в браузере.
- [ ] Создать `src/app/(public)/karta/page.tsx` и компоненты в `src/components/territory-map`. Добавить карту в оглавление, общий гид и sitemap.

### Проверка и передача

- [ ] Запустить `npm run check` и проверить собранную страницу в desktop и mobile.
- [ ] Снять 10 состояний браузера, проверить diff, отправить feature-ветку и review-ветку, открыть PR в `main`.
