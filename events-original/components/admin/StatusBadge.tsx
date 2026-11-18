const LABELS = { draft: "Черновик", published: "Опубликовано", archived: "В архиве" } as const;

export function StatusBadge({ status }: { status: keyof typeof LABELS }) {
  return <span className={`a-badge is-${status}`}>{LABELS[status]}</span>;
}
