import { chapters } from "@/content/home";
import { StoryBook } from "../book/story-book";

export function HomeStory() {
  return <StoryBook chapters={chapters} />;
}
