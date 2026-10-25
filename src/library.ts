import type { Lesson, Question } from "./content";

export type LibrarySort = "curated" | "alphabetical" | "difficulty";

const difficultyRank: Record<Lesson["difficulty"], number> = {
  Foundational: 0,
  Applied: 1,
  Advanced: 2
};

export function sortLessons(items: Lesson[], sort: LibrarySort): Lesson[] {
  const sorted = [...items];
  if (sort === "alphabetical") return sorted.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "difficulty") return sorted.sort((a, b) => difficultyRank[a.difficulty] - difficultyRank[b.difficulty] || a.title.localeCompare(b.title));
  return sorted;
}

export function sortQuestions(items: Question[], sort: LibrarySort): Question[] {
  const sorted = [...items];
  if (sort === "alphabetical") return sorted.sort((a, b) => a.stem.localeCompare(b.stem));
  if (sort === "difficulty") return sorted.sort((a, b) => difficultyRank[a.difficulty] - difficultyRank[b.difficulty] || a.stem.localeCompare(b.stem));
  return sorted;
}
