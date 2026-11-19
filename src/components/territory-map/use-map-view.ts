import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

import { fullView, transformView, type MapView, type Point } from "@/content/territory-view";

function middle(a: Point, b: Point = a): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function measures(pointers: Map<number, Point>) {
  const [a, b] = pointers.values();
  if (!a) return null;
  return { center: middle(a, b), distance: b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 0 };
}

function svgPoint(matrix: DOMMatrix, [x, y]: Point): Point {
  const point = new DOMPoint(x, y).matrixTransform(matrix);
  return [point.x, point.y];
}

type Gesture = NonNullable<ReturnType<typeof measures>> & {
  view: MapView;
  matrix: DOMMatrix;
};

export const initialViewBox = viewBox(fullView);

function viewBox({ x, y, width, height }: MapView): string {
  return [x, y, width, height].join(" ");
}

export function useMapView(svgRef: RefObject<SVGSVGElement | null>) {
  const current = useRef(fullView);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const dragged = useRef(false);

  function update(view: MapView) {
    current.current = view;
    svgRef.current?.setAttribute("viewBox", viewBox(view));
  }

  function zoom(scale: number, anchor?: Point) {
    const { x, y, width, height } = current.current;
    update(transformView(current.current, scale, anchor ?? [x + width / 2, y + height / 2], [0, 0]));
  }

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    function wheel(event: WheelEvent) {
      if ((!event.ctrlKey && !event.metaKey) || !svg) return;
      const matrix = svg.getScreenCTM()?.inverse();
      if (!matrix) return;
      event.preventDefault();
      const anchor = svgPoint(matrix, [event.clientX, event.clientY]);
      const view = transformView(current.current, event.deltaY > 0 ? 0.88 : 1.14, anchor, [0, 0]);
      current.current = view;
      svg.setAttribute("viewBox", viewBox(view));
    }
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => svg.removeEventListener("wheel", wheel);
  }, [svgRef]);

  function startGesture(svg: SVGSVGElement) {
    const baseline = measures(pointers.current);
    const matrix = svg.getScreenCTM()?.inverse();
    gesture.current = baseline && matrix ? { ...baseline, view: current.current, matrix } : null;
  }

  function pointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0 || pointers.current.size >= 2) return;
    if (!pointers.current.size) dragged.current = false;
    pointers.current.set(event.pointerId, [event.clientX, event.clientY]);
    if (pointers.current.size === 2) dragged.current = true;
    startGesture(event.currentTarget);
  }

  function pointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, [event.clientX, event.clientY]);
    const next = measures(pointers.current);
    const start = gesture.current;
    if (!next || !start) return;
    const motion = Math.hypot(next.center[0] - start.center[0], next.center[1] - start.center[1]);
    if (!dragged.current && motion < 5) return;
    dragged.current = true;
    const svg = event.currentTarget;
    if (!svg.hasPointerCapture(event.pointerId)) svg.setPointerCapture(event.pointerId);
    svg.dataset.panning = "true";
    const anchor = svgPoint(start.matrix, start.center);
    const [x, y] = svgPoint(start.matrix, next.center);
    const scale = start.distance ? Math.max(1, next.distance) / start.distance : 1;
    update(transformView(start.view, scale, anchor, [anchor[0] - x, anchor[1] - y]));
  }

  function pointerEnd(event: ReactPointerEvent<SVGSVGElement>) {
    if (!pointers.current.delete(event.pointerId)) return;
    if (!pointers.current.size) delete event.currentTarget.dataset.panning;
    startGesture(event.currentTarget);
  }

  function pointerLeave(event: ReactPointerEvent<SVGSVGElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) pointerEnd(event);
  }

  function reveal([x, y]: Point) {
    const view = current.current;
    const margin = 22;
    const safeX = Math.min(view.x + view.width - margin, Math.max(view.x + margin, x));
    const safeY = Math.min(view.y + view.height - margin, Math.max(view.y + margin, y));
    if (safeX !== x || safeY !== y) {
      update(transformView(view, 1, [0, 0], [x - safeX, y - safeY]));
    }
  }

  return {
    zoom,
    reset: () => update(fullView),
    pan: (dx: number, dy: number) => {
      const view = current.current;
      update(transformView(view, 1, [0, 0], [view.width * dx, view.height * dy]));
    },
    pointerDown,
    pointerMove,
    pointerEnd,
    pointerLeave,
    reveal,
    wasDragged: () => dragged.current,
  };
}
