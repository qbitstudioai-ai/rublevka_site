"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";

import { categories, destinations, matchesFilter, type MapFilter, type TerritoryObject } from "@/content/territory-map-types";
import { mapPinPosition, MapMarker } from "./map-marker";
import { initialViewBox, useMapView } from "./use-map-view";

const filters = Object.keys(categories) as MapFilter[];

const sharedHousePortrait = {
  src: "/art/territory/object-10-11-card.webp",
  width: 1024,
  height: 516,
  alt: "Общий сруб домов №5 и №6",
};

const reusedHousePortrait = {
  ...sharedHousePortrait,
  alt: "Иллюстрация деревянного сруба",
};

const innPortrait = {
  src: "/art/territory/inn-card.webp",
  width: 560,
  height: 397,
  alt: "Двухэтажный сруб с зелёной крышей и белыми резными наличниками",
};

const portraits: Partial<Record<string, typeof innPortrait>> = {
  "object-08": reusedHousePortrait,
  "object-09": reusedHousePortrait,
  "object-10": sharedHousePortrait,
  "object-11": sharedHousePortrait,
  "object-17": innPortrait,
  "object-19": innPortrait,
  "object-21": { src: "/art/territory/object-21-card.webp", width: 900, height: 487, alt: "" },
  "object-22": { src: "/art/territory/object-22-card.webp", width: 1100, height: 486, alt: "" },
};

export function TerritoryMap({
  objects,
  children,
  intro,
}: {
  objects: readonly TerritoryObject[];
  children: ReactNode;
  intro: ReactNode;
}) {
  const [filter, setFilter] = useState<MapFilter>("all");
  const [selected, setSelected] = useState<TerritoryObject | null>(null);
  const trigger = useRef<HTMLElement | SVGElement | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const directory = useRef<HTMLDetailsElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const map = useMapView(svg);
  const visibleObjects = objects.filter((object) => matchesFilter(object, filter));

  const portrait = selected ? portraits[selected.id] : undefined;

  useEffect(() => {
    if (!selected) return;
    closeButton.current?.scrollIntoView({ block: "nearest" });
    closeButton.current?.focus({ preventScroll: true });
  }, [selected]);

  function select(object: TerritoryObject, element: HTMLElement | SVGElement) {
    trigger.current = element;
    setSelected(object);
  }

  function close(restoreFocus: boolean) {
    setSelected(null);
    if (restoreFocus) {
      if (trigger.current instanceof HTMLElement) {
        trigger.current.scrollIntoView({ block: "nearest" });
      } else if (selected) {
        map.reveal(mapPinPosition(selected));
      }
      trigger.current?.focus({ preventScroll: true });
    }
    trigger.current = null;
  }

  function changeFilter(next: MapFilter) {
    setFilter(next);
    if (selected && !matchesFilter(selected, next)) close(false);
  }

  function selectIllustration(event: MouseEvent<SVGSVGElement>) {
    if (!(event.target instanceof SVGImageElement)) return;
    const artwork = event.target.closest("[data-map-art]");
    const object = visibleObjects.find(({ number }) => String(number) === artwork?.getAttribute("data-map-art"));
    if (!object) return;
    const marker = event.currentTarget.querySelector<SVGGElement>(`.map-marker[data-number="${object.number}"]`);
    if (marker) select(object, marker);
  }

  function showDirectory() {
    const list = directory.current;
    if (!list) return;
    list.open = true;
    list.scrollIntoView({ block: "start" });
    list.querySelector("summary")?.focus({ preventScroll: true });
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && selected) {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.target !== svg.current) return;
    switch (event.key) {
      case "+": case "=": map.zoom(1.35); break;
      case "-": map.zoom(1 / 1.35); break;
      case "0": map.reset(); break;
      case "ArrowLeft": map.pan(-0.1, 0); break;
      case "ArrowRight": map.pan(0.1, 0); break;
      case "ArrowUp": map.pan(0, -0.1); break;
      case "ArrowDown": map.pan(0, 0.1); break;
      default: return;
    }
    event.preventDefault();
  }

  return (
    <section className="territory-workspace" aria-label="Объекты на карте" onKeyDown={onKeyDown}>
      <div className="territory-toolbar">
        {intro}
        <p className="territory-filter-hint" id="territory-filter-hint">
          Листайте категории в сторону <span aria-hidden="true">→</span>
        </p>
        <div
          className="territory-filters"
          role="group"
          aria-label="Категории карты"
          aria-describedby="territory-filter-hint"
        >
          {filters.map((id) => (
            <button
              key={id}
              type="button"
              data-filter={id}
              aria-pressed={id === filter}
              onClick={() => changeFilter(id)}
            >
              <span className="map-swatch" aria-hidden="true" />
              {categories[id]}
              <span className="map-filter-count" aria-hidden="true">
                {objects.filter((object) => matchesFilter(object, id)).length}
              </span>
            </button>
          ))}
        </div>
        <button type="button" className="territory-directory-link" aria-controls="territory-directory" onClick={showDirectory}>
          К списку объектов <span aria-hidden="true">↓</span>
        </button>
      </div>
      <div className="territory-stage" data-map-filter={filter}>
        <svg
          ref={svg}
          className="territory-svg"
          viewBox={initialViewBox}
          role="group"
          aria-label="План территории комплекса Рублевка"
          aria-describedby="territory-keys"
          tabIndex={0}
          onPointerDown={map.pointerDown}
          onPointerMove={map.pointerMove}
          onPointerUp={map.pointerEnd}
          onPointerCancel={map.pointerEnd}
          onPointerLeave={map.pointerLeave}
          onClick={selectIllustration}
          onClickCapture={(event) => {
            if (event.detail && map.wasDragged()) event.stopPropagation();
          }}
        >
          {children}
          {objects.map((object) => (
            <MapMarker
              key={object.id}
              object={object}
              visible={matchesFilter(object, filter)}
              selected={selected?.id === object.id}
              select={(element) => select(object, element)}
              reveal={map.reveal}
            />
          ))}
        </svg>
        <div className="territory-stage-tools">
          <p className="territory-note">↓ Отмеченный вход · масштаб условный</p>
          <div className="territory-zoom" role="group" aria-label="Масштаб карты">
            <button type="button" onClick={() => map.zoom(1.35)} aria-label="Приблизить">＋</button>
            <button type="button" onClick={() => map.zoom(1 / 1.35)} aria-label="Отдалить">−</button>
            <button type="button" onClick={map.reset} aria-label="Показать всю карту">⤢</button>
          </div>
        </div>
        {selected ? (
          <section key={selected.id} data-assistant-map-object={selected.id} className="territory-card" aria-labelledby="territory-card-title">
            <button
              className="territory-close"
              ref={closeButton}
              type="button"
              aria-label="Закрыть карточку"
              onClick={() => close(true)}
            >×</button>
            {portrait ? (
              <Image className="territory-portrait" src={portrait.src}
                width={portrait.width} height={portrait.height} alt={portrait.alt} unoptimized />
            ) : null}
            <div className="territory-card-body">
              <p className="territory-card-meta">
                <span className="territory-card-number">№{selected.number}</span> {selected.type}
              </p>
              <h2 id="territory-card-title">{selected.cardTitle ?? selected.name}</h2>
              <p className="territory-card-copy">{selected.description}</p>
              {selected.capacity ? <p className="territory-capacity">До {selected.capacity} гостей</p> : null}
              {selected.destination ? (
                <Link href={selected.destination} className="territory-cta" prefetch={false}>
                  {destinations[selected.destination]} <span aria-hidden="true">→</span>
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
      <p className="territory-keys" id="territory-keys">
        Используйте кнопки масштаба или клавиши +, −, 0. Стрелки перемещают приближённую карту.
      </p>
      <details className="territory-directory" id="territory-directory" ref={directory}>
        <summary>Список объектов</summary>
        <ul>
          {visibleObjects.map((object) => (
            <li key={object.id}>
              <button
                type="button"
                aria-pressed={selected?.id === object.id}
                onClick={(event) => select(object, event.currentTarget)}
              >
                <span className="territory-list-number">№{object.number}</span>{object.name}
              </button>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
