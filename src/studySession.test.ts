import { describe, expect, it } from "vitest";
import { questions } from "./content";
import { loadExamSession, loadPracticeSession } from "./studySession";

describe("saved study sessions", () => {
  it("restores a free practice set and rejects content not present in the local bank", () => {
    const question = questions[0];
    const valid = JSON.stringify({ version: 1, ids: [question.id], index: 0, selectedOptionId: question.options[1].id, submitted: false, pathwayId: "nclex-rn" });
    const restored = loadPracticeSession(valid, questions);
    expect(restored?.questionSet).toEqual([question]);
    expect(restored?.selectedOptionId).toBe(question.options[1].id);
    expect(restored?.pathwayId).toBe("nclex-rn");
    expect(restored?.mode).toBe("quick");
    const daily = JSON.stringify({ version: 1, ids: [question.id], index: 0, selectedOptionId: "", submitted: false, pathwayId: "nclex-rn", mode: "daily" });
    expect(loadPracticeSession(daily, questions)?.mode).toBe("daily");
    expect(loadPracticeSession(JSON.stringify({ version: 1, ids: ["protected-pack-question"], index: 0, selectedOptionId: "", submitted: false }), questions)).toBeNull();
  });

  it("restores an exam draft with remaining time calculated from its deadline", () => {
    const [first, second] = questions;
    const saved = JSON.stringify({
      version: 1,
      id: "practice-session-1",
      status: "active",
      ids: [first.id, second.id],
      index: 1,
      answers: { [first.id]: first.options[0].id, unexpected: "answer" },
      durationMinutes: 10,
      deadlineAt: 61_500,
      secondsLeft: 99,
      pathwayId: "nmcn-rphn"
    });
    const restored = loadExamSession(saved, questions, 60_000);
    expect(restored?.secondsLeft).toBe(2);
    expect(restored?.answers).toEqual({ [first.id]: first.options[0].id });
    expect(restored?.pathwayId).toBe("nmcn-rphn");
  });

  it("expires elapsed drafts immediately and rejects malformed session bounds", () => {
    const saved = JSON.stringify({ version: 1, id: "expired", status: "active", ids: [questions[0].id], index: 0, answers: {}, durationMinutes: 5, deadlineAt: 1000, pathwayId: "nmcn-rn" });
    expect(loadExamSession(saved, questions, 2000)?.secondsLeft).toBe(0);
    expect(loadExamSession(JSON.stringify({ version: 1, id: "bad", status: "active", ids: [questions[0].id], index: 4, answers: {}, durationMinutes: 5, deadlineAt: 1000 }), questions, 0)).toBeNull();
  });
});
