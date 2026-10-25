import { describe, expect, it } from "vitest";
import { questions } from "./content";
import { countForPracticeMode, examQuestionChoices, practicePoolCount, previousIncorrectOption, resolveExamQuestionCount, selectPracticeQuestions } from "./practiceModes";

describe("question-bank practice modes", () => {
  it("keeps the mock-exam selector and started question count consistent after a pathway change", () => {
    expect(examQuestionChoices(8)).toEqual([5, 8]);
    expect(resolveExamQuestionCount(18, 8)).toBe(8);
    expect(examQuestionChoices(19)).toEqual([5, 10, 19]);
    expect(resolveExamQuestionCount(18, 19)).toBe(19);
    expect(resolveExamQuestionCount(5, 0)).toBe(0);
  });

  it("keeps pathway items isolated while retaining shared foundations", () => {
    const rn = selectPracticeQuestions({ bank: questions, mode: "pathway", pathwayId: "nmcn-rn", random: () => 0.5 });
    expect(practicePoolCount(questions, "nmcn-rn")).toBe(18);
    expect(rn).toHaveLength(10);
    expect(rn.every(question => question.pathwayIds.includes("nmcn-rn"))).toBe(true);
    expect(rn.some(question => question.pathwayIds.includes("nmcn-rm"))).toBe(false);
    expect(practicePoolCount(questions, null)).toBe(8);
  });

  it("limits quick and random sets to their stated sizes", () => {
    expect(selectPracticeQuestions({ bank: questions, mode: "quick", pathwayId: "nclex-pn", random: () => 0 }).length).toBe(5);
    expect(selectPracticeQuestions({ bank: questions, mode: "random", pathwayId: "nclex-pn", random: () => 0 }).length).toBe(10);
    expect(countForPracticeMode({ bank: questions, mode: "quick", pathwayId: null })).toBe(5);
  });

  it("returns a repeatable daily set for a pathway and date", () => {
    const selection = { bank: questions, mode: "daily" as const, pathwayId: "nmcn-rm" as const, date: "2026-10-24" };
    expect(selectPracticeQuestions(selection).map(question => question.id)).toEqual(selectPracticeQuestions(selection).map(question => question.id));
    expect(selectPracticeQuestions(selection)).toHaveLength(5);
  });

  it("filters topic, bookmark, and mistake sessions from real stored state", () => {
    const candidate = questions.find(question => question.pathwayIds.includes("nclex-rn"))!;
    const wrongOption = candidate.options.find(option => option.id !== candidate.correctOptionId)!;
    const attempt = { questionId: candidate.id, selectedOptionId: wrongOption.id, subject: candidate.subject, topic: candidate.topic, correct: false, answeredAt: "2026-10-24T10:00:00.000Z", pathwayId: "nclex-rn" as const };
    const topic = selectPracticeQuestions({ bank: questions, mode: "topic", pathwayId: "nclex-rn", subject: candidate.subject, topic: candidate.topic });
    const bookmarked = selectPracticeQuestions({ bank: questions, mode: "bookmarked", pathwayId: "nclex-rn", bookmarkedIds: [candidate.id, "unavailable"] });
    const mistakes = selectPracticeQuestions({ bank: questions, mode: "review-mistakes", pathwayId: "nclex-rn", attempts: [attempt] });
    expect(topic.every(question => question.subject === candidate.subject && question.topic === candidate.topic)).toBe(true);
    expect(bookmarked.map(question => question.id)).toEqual([candidate.id]);
    expect(mistakes.map(question => question.id)).toEqual([candidate.id]);
    expect(previousIncorrectOption([attempt], candidate.id, "nclex-rn")).toBe(wrongOption.id);
    const corrected = { ...attempt, correct: true, selectedOptionId: candidate.correctOptionId };
    expect(selectPracticeQuestions({ bank: questions, mode: "review-mistakes", pathwayId: "nclex-rn", attempts: [attempt, corrected] })).not.toContain(candidate);
    expect(previousIncorrectOption([attempt, corrected], candidate.id, "nclex-rn")).toBeNull();
  });

  it("offers weak-topic review only after enough attempts show a low accuracy", () => {
    const candidate = questions.find(question => question.pathwayIds.includes("nmcn-rphn"))!;
    const attempts = [0, 1].map(index => ({ questionId: candidate.id, subject: candidate.subject, topic: candidate.topic, correct: false, answeredAt: `2026-10-24T10:0${index}:00.000Z`, pathwayId: "nmcn-rphn" as const }));
    expect(selectPracticeQuestions({ bank: questions, mode: "weak-topics", pathwayId: "nmcn-rphn", attempts }).some(question => question.topic === candidate.topic)).toBe(true);
    expect(selectPracticeQuestions({ bank: questions, mode: "weak-topics", pathwayId: "nmcn-rphn", attempts: attempts.slice(0, 1) })).toEqual([]);
  });
});
