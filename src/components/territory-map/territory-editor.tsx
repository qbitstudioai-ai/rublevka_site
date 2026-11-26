"use client";

import { useMemo, useRef, useState, type PointerEvent } from "react";

import {
  applyTerritoryLayout, parseTerritoryLayout,
  type IllustrationPlacement, type ObjectPlacement, type TerritoryLayout,
} from "@/content/territory-layout";
import { mapPinPosition, type TerritoryObject } from "@/content/territory-map-types";
import type { Point } from "@/content/territory-view";
import { MapArt } from "./map-art";
import { illustrationRotation, MapBuildings, mapBuildingSprites } from "./map-buildings";
import { MapMarker } from "./map-marker";
import { CoordinateField, PointFields } from "./territory-editor-controls";
import { TerritoryMap } from "./territory-map";
import { initialViewBox, useMapView } from "./use-map-view";

const modes = {
  illustration: "Миниатюра",
  shape: "Контур",
  pin: "Номер",
  entrance: "Входы",
} as const;
type Mode = keyof typeof modes;
type EditByDelta = (dx: number, dy: number) => TerritoryLayout;
type Drag = { pointer: number; matrix: DOMMatrix; start: DOMPoint; before: TerritoryLayout; move: EditByDelta };

const round = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number, lo: number, hi: number) => round(Math.min(hi, Math.max(lo, value)));
const shift = ([x, y]: Point, dx: number, dy: number): [number, number] => [
  clamp(x + dx, -2000, 3000), clamp(y + dy, -2000, 3000),
];

export function TerritoryEditor({ objects, boundary, initialLayout }: {
  objects: readonly TerritoryObject[];
  boundary: readonly Point[];
  initialLayout: TerritoryLayout;
}) {
  const [layout, setLayout] = useState(initialLayout);
  const [history, setHistory] = useState<TerritoryLayout[]>([]);
  const [selectedId, setSelectedId] = useState(objects.find(({ number }) => number === 10)?.id ?? objects[0].id);
  const [mode, setMode] = useState<Mode>("illustration");
  const [index, setIndex] = useState(0);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const map = useMapView(svg, !preview);
  const edited = useMemo(() => applyTerritoryLayout(objects, layout), [objects, layout]);
  const illustrations = useMemo(() => mapBuildingSprites(objects, layout.illustrations), [objects, layout.illustrations]);
  const selected = edited.find(({ id }) => id === selectedId) ?? edited[0];
  const art = illustrations.find(({ numbers }) => String(numbers).split(" ").includes(String(selected.number)));
  const pin = mapPinPosition(selected);
  const vertexIndex = Math.min(index, selected.shape.length - 1);
  const entranceIndex = Math.min(index, selected.entrances.length - 1);
  const entrance = selected.entrances[entranceIndex];

  function select(object: TerritoryObject) {
    setSelectedId(object.id);
    setIndex(0);
    map.reveal(mapPinPosition(object));
  }

  function objectEdit(value: ObjectPlacement): TerritoryLayout {
    return { ...layout, objects: { ...layout.objects, [selected.id]: { ...layout.objects?.[selected.id], ...value } } };
  }

  function imageEdit(value: Partial<IllustrationPlacement>): TerritoryLayout {
    if (!art) return layout;
    const { x, y, width } = art;
    return { ...layout, illustrations: { ...layout.illustrations, [art.id]: { x, y, width, ...value } } };
  }

  function vertexEdit(i: number, value: [number, number]): TerritoryLayout {
    return objectEdit({ shape: selected.shape.map((point, j) => j === i ? value : [...point]) });
  }

  function entranceEdit(i: number, tip: Point, angle: number): TerritoryLayout {
    return objectEdit({ entrances: selected.entrances.map((item, j) => j === i
      ? { tip: [...tip], angle } : { tip: [...item.tip], angle: item.angle }) });
  }

  function commit(next: TerritoryLayout) {
    setHistory((stack) => [...stack, layout]);
    setLayout(next);
    setMessage("");
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setLayout(previous);
    setHistory(history.slice(0, -1));
    setMessage("");
  }

  function begin(event: PointerEvent<SVGElement>, move: EditByDelta) {
    if (event.button !== 0 || !svg.current || drag.current) return;
    const matrix = svg.current.getScreenCTM()?.inverse();
    if (!matrix) return;
    event.stopPropagation();
    svg.current.setPointerCapture(event.pointerId);
    const start = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix);
    drag.current = { pointer: event.pointerId, matrix, start, before: layout, move };
  }

  function draggedLayout(event: PointerEvent<SVGSVGElement>, action: Drag) {
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(action.matrix);
    const dx = point.x - action.start.x;
    const dy = point.y - action.start.y;
    return Math.hypot(dx, dy) < 0.25 ? action.before : action.move(dx, dy);
  }

  function pointerMove(event: PointerEvent<SVGSVGElement>) {
    const action = drag.current;
    if (action?.pointer === event.pointerId) {
      setLayout(draggedLayout(event, action));
    } else {
      map.pointerMove(event);
    }
  }

  function pointerEnd(event: PointerEvent<SVGSVGElement>) {
    const action = drag.current;
    if (action?.pointer !== event.pointerId) {
      map.pointerEnd(event);
      return;
    }
    drag.current = null;
    const next = event.type === "pointercancel" ? action.before : draggedLayout(event, action);
    if (next !== action.before) {
      setHistory((stack) => [...stack, action.before]);
      setMessage("");
    }
    setLayout(next);
  }

  function setPreviewMode() {
    setPreview(!preview);
    map.reset();
  }

  function download() {
    const file = new Blob([JSON.stringify(layout, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "territory-layout.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Файл выгружен. Для обычной карты замените src/content/territory-layout.json этим файлом.");
  }

  async function load(file: File) {
    try {
      const next = parseTerritoryLayout(JSON.parse(await file.text()));
      const objectIds = new Set(objects.map(({ id }) => id));
      const illustrationIds = new Set(illustrations.map(({ id }) => id));
      if (Object.keys(next.objects ?? {}).some((id) => !objectIds.has(id))
        || Object.keys(next.illustrations ?? {}).some((id) => !illustrationIds.has(id))) {
        throw new Error("Unknown map object");
      }
      commit(next);
      setMessage("Правки загружены.");
    } catch {
      setMessage("Файл не подошёл. Выберите JSON, выгруженный из редактора этой карты.");
    }
  }

  const moveArt: EditByDelta = (dx, dy) => {
    if (!art) return layout;
    const [x, y] = shift([art.x, art.y], dx, dy);
    return imageEdit({ x, y });
  };
  const sizeArt: EditByDelta = (dx, dy) => {
    if (!art) return layout;
    const ratio = art.height / art.width;
    const radians = art.rotationCenter ? 62 * Math.PI / 180 : 0;
    const x = dx * Math.cos(radians) + dy * Math.sin(radians);
    const y = dy * Math.cos(radians) - dx * Math.sin(radians);
    return imageEdit({ width: clamp(art.width + (x + ratio * y) / (1 + ratio * ratio), 5, 974) });
  };

  return (
    <main className="guest-guide territory-page territory-editor">
      <header className="editor-header">
        <h1>Редактор карты</h1>
        <div className="editor-actions">
          <button type="button" aria-pressed={preview} onClick={setPreviewMode}>
            {preview ? "Вернуться к редактированию" : "Предпросмотр"}
          </button>
          <button type="button" disabled={!history.length} onClick={undo}>Отменить</button>
          <button type="button" onClick={() => importInput.current?.click()}>Загрузить JSON</button>
          <input ref={importInput} type="file" accept=".json,application/json" hidden onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) void load(file);
          }} />
          <button className="editor-export" type="button" onClick={download}>Скачать JSON</button>
        </div>
      </header>
      {message && <p className="editor-message" role="status">{message}</p>}
      {preview ? (
        <TerritoryMap objects={edited} intro={<header className="territory-intro"><h2>Карта комплекса</h2></header>}>
          <MapArt boundary={boundary} />
          <MapBuildings objects={objects} illustrations={layout.illustrations} />
        </TerritoryMap>
      ) : (
        <div className="editor-workspace">
          <section className="editor-canvas" aria-label="Редактируемая карта">
            <svg
              ref={svg}
              className="territory-svg editor-svg"
              viewBox={initialViewBox}
              role="group"
              aria-label="План территории"
              onPointerDown={map.pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerEnd}
              onPointerCancel={pointerEnd}
              onPointerLeave={map.pointerLeave}
              onClickCapture={(event) => {
                if (event.detail && map.wasDragged()) event.stopPropagation();
              }}
            >
              <MapArt boundary={boundary} />
              <MapBuildings objects={objects} illustrations={layout.illustrations} />
              {edited.map((object) => (
                <MapMarker key={object.id} object={object} visible selected={false} select={() => select(object)} reveal={map.reveal} />
              ))}
              {mode === "illustration" && art && (
                <g className="editor-handles" transform={illustrationRotation(art)} aria-hidden="true">
                  <rect className="editor-drag-area" x={art.x} y={art.y} width={art.width} height={art.height}
                    onPointerDown={(event) => begin(event, moveArt)} />
                  <circle className="editor-handle" cx={art.x + art.width} cy={art.y + art.height} r="5"
                    onPointerDown={(event) => begin(event, sizeArt)} />
                </g>
              )}
              {mode === "shape" && (
                <g className="editor-handles" aria-hidden="true">
                  <polygon className="editor-drag-area" points={selected.shape.map((point) => point.join(",")).join(" ")}
                    onPointerDown={(event) => begin(event, (dx, dy) => objectEdit({
                      shape: selected.shape.map((point) => shift(point, dx, dy)),
                    }))} />
                  {selected.shape.map(([x, y], i) => (
                    <circle className="editor-handle" data-active={i === vertexIndex} key={i} cx={x} cy={y} r="5"
                      onPointerDown={(event) => {
                        setIndex(i);
                        begin(event, (dx, dy) => vertexEdit(i, shift([x, y], dx, dy)));
                      }} />
                  ))}
                </g>
              )}
              {mode === "pin" && (
                <circle className="editor-drag-area" aria-hidden="true" cx={pin[0]} cy={pin[1]} r="16"
                  onPointerDown={(event) => begin(event, (dx, dy) => objectEdit({ pin: shift(pin, dx, dy) }))} />
              )}
              {mode === "entrance" && selected.entrances.map(({ tip, angle }, i) => (
                <circle className="editor-handle" data-active={i === entranceIndex} key={i} aria-hidden="true" cx={tip[0]} cy={tip[1]} r="6"
                  onPointerDown={(event) => {
                    setIndex(i);
                    begin(event, (dx, dy) => entranceEdit(i, shift(tip, dx, dy), angle));
                  }} />
              ))}
            </svg>
            <div className="editor-zoom" role="group" aria-label="Масштаб">
              <button type="button" onClick={() => map.zoom(1.35, pin)} aria-label="Приблизить выбранный объект">+</button>
              <button type="button" onClick={() => map.zoom(1 / 1.35)} aria-label="Отдалить">−</button>
              <button type="button" onClick={map.reset}>Вся карта</button>
            </div>
          </section>
          <aside className="editor-inspector" aria-label="Параметры объекта">
            <label className="editor-object"><span id="editor-object-label">Объект</span>
              <select aria-labelledby="editor-object-label" value={selected.id} onChange={(event) => {
                const object = edited.find(({ id }) => id === event.target.value);
                if (object) select(object);
              }}>
                {edited.map(({ id, number, name }) => <option key={id} value={id}>№{number} — {name}</option>)}
              </select>
            </label>
            <div className="editor-modes" role="group" aria-label="Что редактировать">
              {Object.entries(modes).map(([key, name]) => (
                <button type="button" key={key} aria-pressed={mode === key} onClick={() => {
                  setMode(key as Mode);
                  setIndex(0);
                }}>{name}</button>
              ))}
            </div>
            {mode === "illustration" && art && (
              <>
                <p>Перетащите миниатюру. Потяните за угол, чтобы изменить размер.</p>
                {art.shared && <p>Общая иллюстрация для №{String(art.numbers).replace(" ", " и №")}.</p>}
                <div className="editor-fields">
                  <PointFields point={[art.x, art.y]} change={([x, y]) => commit(imageEdit({ x, y }))} />
                  <CoordinateField label="Ширина" min={5} max={974} value={art.width} change={(width) => commit(imageEdit({ width }))} />
                </div>
              </>
            )}
            {mode === "shape" && (
              <>
                <p>Перетащите контур целиком или за любую вершину.</p>
                <label className="editor-object"><span id="editor-vertex-label">Вершина</span>
                  <select aria-labelledby="editor-vertex-label" value={vertexIndex} onChange={(event) => setIndex(Number(event.target.value))}>
                    {selected.shape.map((_, i) => <option key={i} value={i}>{i + 1}</option>)}
                  </select>
                </label>
                <div className="editor-fields">
                  <PointFields point={selected.shape[vertexIndex]} change={(point) => commit(vertexEdit(vertexIndex, point))} />
                </div>
              </>
            )}
            {mode === "pin" && (
              <>
                <p>Перетащите метку номера.</p>
                <div className="editor-fields"><PointFields point={pin} change={(point) => commit(objectEdit({ pin: point }))} /></div>
              </>
            )}
            {mode === "entrance" && (entrance ? (
              <>
                <p>Перетащите точку входа. Угол задаёт направление стрелки.</p>
                {selected.entrances.length > 1 && (
                  <label className="editor-object"><span id="editor-entrance-label">Вход</span>
                    <select aria-labelledby="editor-entrance-label" value={entranceIndex} onChange={(event) => setIndex(Number(event.target.value))}>
                      {selected.entrances.map((_, i) => <option key={i} value={i}>{i + 1}</option>)}
                    </select>
                  </label>
                )}
                <div className="editor-fields">
                  <PointFields point={entrance.tip} change={(point) => commit(entranceEdit(entranceIndex, point, entrance.angle))} />
                  <CoordinateField label="Угол, °" min={0} max={360} value={entrance.angle}
                    change={(angle) => commit(entranceEdit(entranceIndex, entrance.tip, angle))} />
                </div>
              </>
            ) : <p>Для этого объекта входы на карте не отмечены.</p>)}
          </aside>
        </div>
      )}
    </main>
  );
}
