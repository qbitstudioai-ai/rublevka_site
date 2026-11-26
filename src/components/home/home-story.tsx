import { publicContent, catalogAsset, catalogFor } from "@/server/cms/public";
import { StoryBook } from "../book/story-book";

export async function HomeStory() {
  const [{ chapters }, media] = await Promise.all([
    publicContent("book"),
    publicContent("media"),
  ]);
  const catalog = catalogFor(media.items);
  return (
    <StoryBook
      chapters={chapters.map((chapter) =>
        chapter.layout === "manifesto" || !chapter.photo
          ? chapter
          : { ...chapter, image: catalogAsset(catalog, chapter.photo) },
      )}
    />
  );
}
