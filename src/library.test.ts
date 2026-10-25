import { describe, expect, it } from "vitest";
import { lessons, questions } from "./content";
import { sortLessons, sortQuestions } from "./library";

describe("library sorting", () => {
  it("keeps the editorial order by default without mutating the source array", () => {
    const original = [...lessons];
    expect(sortLessons(lessons, "curated")).toEqual(original);
    expect(lessons).toEqual(original);
  });

  it("sorts lessons alphabetically and by increasing difficulty", () => {
    expect(sortLessons(lessons, "alphabetical").map(item => item.title)).toEqual(
      lessons.map(item => item.title).sort((a, b) => a.localeCompare(b))
    );
    const ranked = sortLessons(lessons, "difficulty");
    const ranks = ranked.map(item => ({ Foundational: 0, Applied: 1, Advanced: 2 }[item.difficulty]));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("sorts question stems alphabetically and puts foundational practice first", () => {
    expect(sortQuestions(questions, "alphabetical").map(item => item.stem)).toEqual(
      questions.map(item => item.stem).sort((a, b) => a.localeCompare(b))
    );
    const ranked = sortQuestions(questions, "difficulty");
    const ranks = ranked.map(item => ({ Foundational: 0, Applied: 1, Advanced: 2 }[item.difficulty]));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
});
