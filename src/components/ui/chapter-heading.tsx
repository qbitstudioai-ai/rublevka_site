type ChapterHeadingProps = {
  number: "II" | "III";
  id: string;
  children: string;
  align?: "start" | "center";
};

export function ChapterHeading({
  number,
  id,
  children,
  align = "start",
}: ChapterHeadingProps) {
  return (
    <header className={`chapter-heading chapter-heading--${align}`}>
      <span className="chapter-heading__number" aria-hidden="true">
        {number}
      </span>
      <h2 id={id}>{children}</h2>
    </header>
  );
}
