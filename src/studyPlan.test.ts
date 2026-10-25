import { describe, expect, it } from "vitest";
import { getStudyPlanSummary, weakestTopics } from "./studyPlan";
import type { AttemptRecord } from "./progress";

const attempts: AttemptRecord[] = [
  { questionId: "a", subject: "fundamentals", topic: "Safety", correct: false, answeredAt: "2026-10-24T08:00:00.000Z", pathwayId: "nclex-rn" },
  { questionId: "b", subject: "fundamentals", topic: "Safety", correct: true, answeredAt: "2026-10-23T08:00:00.000Z", pathwayId: "nclex-rn" },
  { questionId: "c", subject: "public-health", topic: "Assessment", correct: true, answeredAt: "2026-10-24T09:00:00.000Z", pathwayId: "nmcn-rphn" },
  { questionId: "d", subject: "fundamentals", topic: "Safety", correct: false, answeredAt: "2026-10-10T08:00:00.000Z", pathwayId: "nclex-rn" }
];

describe("pathway study plan calculations", () => {
  it("counts only the selected pathway and actual attempts in the last seven days", () => {
    const summary = getStudyPlanSummary(attempts, "nclex-rn", { targetExamDate: "2026-10-30", weeklyQuestionGoal: 14 }, new Date("2026-10-24T12:00:00.000Z"));
    expect(summary.answersToday).toBe(1);
    expect(summary.answersThisWeek).toBe(2);
    expect(summary.dailyQuestionTarget).toBe(2);
    expect(summary.daysUntilExam).toBe(6);
  });
  it("does not report a score or weak topic without saved answers", () => {
    expect(weakestTopics([], "nclex-rn")).toEqual([]);
    expect(weakestTopics(attempts, "nmcn-rn")).toEqual([]);
  });
  it("ranks weaker topics from the learner's saved responses", () => {
    expect(weakestTopics(attempts, "nclex-rn")[0]).toMatchObject({ topic: "Safety", total: 3, correct: 1, accuracy: 33 });
  });
});
