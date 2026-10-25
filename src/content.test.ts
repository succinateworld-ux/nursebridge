import { describe, expect, it } from "vitest";
import { lessons, questions, validateLibrary } from "./content";
import { examPathways } from "./pathways";
import { addAttempt, calculateScore, completeLesson, parseProgress, toggleQuestionBookmark } from "./progress";

describe("NurseBridge educational library", () => {
  it("validates all source-linked lessons and single-answer questions with exact per-pathway counts", () => {
    expect(validateLibrary({ lessons, questions })).toEqual([]);
    expect(questions).toHaveLength(59);
    expect(new Set(questions.map(question => question.id)).size).toBe(questions.length);
    expect(questions.filter(question => question.pathwayIds.length === 0)).toHaveLength(8);
    expect(examPathways.map(pathway => questions.filter(question => question.pathwayIds.includes(pathway.id)).length)).toEqual([10, 10, 10, 10, 11]);
    expect(questions.filter(question => question.source.url).length).toBe(59);
    expect(questions.every(question => question.contentStatus === "source-checked" && question.lastReviewedAt === "2026-10-24")).toBe(true);
    expect(questions.every(question => question.questionType === "single-best-answer" && question.verificationStatus !== "blueprint-mapped")).toBe(true);
    expect(questions.some(question => question.contentStatus === "clinically-reviewed" || question.contentStatus === "ready-for-use")).toBe(false);
    expect(new Set(questions.map(question => question.subject).filter(subject => subject === "maternal-newborn" || subject === "medical-surgical" || subject === "pharmacology" || subject === "community-health" || subject === "professional-practice")).size).toBeGreaterThan(3);
  });
  it("rejects question content without a valid answer key and source", () => {
    const invalid = { ...questions[0], correctOptionId: "missing", source: { ...questions[0].source, url: "javascript:alert(1)" } };
    expect(validateLibrary({ lessons, questions: [invalid] }).join(" ")).toMatch(/correct answer.*HTTPS source|HTTPS source.*correct answer/);
  });
  it("requires distinct answer options and a rationale for every distractor", () => {
    const duplicated = { ...questions[0], options: questions[0].options.map((option, index) => index === 0 ? { ...option, id: "b" } : option) };
    const missingRationales = { ...questions[0], distractorExplanations: { a: "This option does not fit the learning objective." } };
    expect(validateLibrary({ lessons: [], questions: [duplicated] }).join(" ")).toContain("duplicate answer option ids");
    expect(validateLibrary({ lessons: [], questions: [missingRationales] }).join(" ")).toContain("explanation for each incorrect option");
  });
  it("keeps general foundations and pathway practice distinctly labeled", () => {
    expect(examPathways).toHaveLength(5);
    expect(lessons.every(item => item.pathwayIds.length === 0 && item.verificationStatus === "source-linked-general")).toBe(true);
    expect(questions.some(item => item.pathwayIds.length > 0 && item.verificationStatus === "pathway-practice")).toBe(true);
    expect(questions.some(item => item.pathwayIds.length === 0 && item.verificationStatus === "source-linked-general")).toBe(true);
    expect(questions.filter(item => item.pathwayIds.length > 0).every(item => item.examTags.length === 1 && !item.examTags.includes("General practice"))).toBe(true);
  });
  it("rejects duplicate stems and unreviewed clinical status claims", () => {
    const duplicate = { ...questions[0], id: "different-id" };
    expect(validateLibrary({ lessons: [], questions: [questions[0], duplicate] }).join(" ")).toContain("duplicates question stem");
    const falselyReviewed = { ...questions[0], contentStatus: "clinically-reviewed" };
    expect(validateLibrary({ lessons: [], questions: [falselyReviewed] }).join(" ")).toContain("qualified clinical reviewer");
  });
});

describe("guest progress", () => {
  it("ignores malformed stored progress and calculates scores only from submitted attempts", () => {
    expect(parseProgress("not-json").attempts).toEqual([]);
    const progress = addAttempt(parseProgress(null), { questionId: "q1", subject: "mental-health", topic: "communication", correct: true, answeredAt: "2026-10-24T00:00:00.000Z" });
    expect(calculateScore(progress.attempts)).toEqual({ answered: 1, correct: 1, percent: 100 });
  });
  it("marks a lesson once without duplicating progress", () => {
    const first = completeLesson(parseProgress(null), "lesson-1");
    expect(completeLesson(first, "lesson-1").completedLessonIds).toEqual(["lesson-1"]);
  });
  it("migrates existing v1 learning history without attributing it to an exam pathway", () => {
    const old = { version: 1, completedLessonIds: ["lesson-1"], attempts: [{ questionId: "q1", subject: "mental-health", topic: "communication", correct: false, answeredAt: "2026-10-20T10:00:00.000Z" }] };
    const migrated = parseProgress(JSON.stringify(old));
    expect(migrated.version).toBe(3);
    expect(migrated.completedLessonIds).toEqual(["lesson-1"]);
    expect(migrated.attempts[0].pathwayId).toBeUndefined();
    expect(migrated.selectedPathwayId).toBeNull();
  });
  it("keeps new attempts and lesson completion separate by pathway", () => {
    let progress = parseProgress(null);
    progress = completeLesson(progress, "lesson-rn", "nmcn-rn");
    progress = completeLesson(progress, "lesson-rm", "nmcn-rm");
    progress = addAttempt(progress, { questionId: "q-rn", subject: "fundamentals", topic: "safety", correct: true, answeredAt: "2026-10-24T10:00:00.000Z", pathwayId: "nmcn-rn" });
    progress = addAttempt(progress, { questionId: "q-rm", subject: "midwifery", topic: "newborn care", correct: false, answeredAt: "2026-10-24T10:05:00.000Z", pathwayId: "nmcn-rm" });
    expect(calculateScore(progress.attempts, "nmcn-rn")).toEqual({ answered: 1, correct: 1, percent: 100 });
    expect(progress.completedLessonsByPathway["nmcn-rn"]).toEqual(["lesson-rn"]);
    expect(progress.completedLessonsByPathway["nmcn-rm"]).toEqual(["lesson-rm"]);
  });
  it("rejects invalid pathway plans and keeps valid saved targets", () => {
    const valid = parseProgress(JSON.stringify({ version: 2, selectedPathwayId: "nclex-rn", completedLessonIds: [], completedLessonsByPathway: {}, attempts: [], studyPlans: { "nclex-rn": { targetExamDate: "2027-04-01", weeklyQuestionGoal: 21 }, "nmcn-rn": { targetExamDate: "not-a-date", weeklyQuestionGoal: 999 } } }));
    expect(valid.studyPlans["nclex-rn"]).toEqual({ targetExamDate: "2027-04-01", weeklyQuestionGoal: 21 });
    expect(valid.studyPlans["nmcn-rn"]).toBeUndefined();
  });
  it("migrates version 2 progress and persists unique question bookmarks", () => {
    const old = parseProgress(JSON.stringify({ version: 2, selectedPathwayId: "nclex-rn", completedLessonIds: ["l1"], completedLessonsByPathway: {}, attempts: [], studyPlans: {} }));
    expect(old.version).toBe(3);
    expect(old.selectedPathwayId).toBe("nclex-rn");
    expect(old.bookmarkedQuestionIds).toEqual([]);
    const saved = toggleQuestionBookmark(toggleQuestionBookmark(old, "question-1"), "question-2");
    expect(toggleQuestionBookmark(saved, "question-1").bookmarkedQuestionIds).toEqual(["question-2"]);
    expect(parseProgress(JSON.stringify(saved)).bookmarkedQuestionIds).toEqual(["question-1", "question-2"]);
    const withChoice = parseProgress(JSON.stringify({ ...saved, attempts: [{ questionId: "question-1", selectedOptionId: "c", subject: "fundamentals", topic: "safety", correct: false, answeredAt: "2026-10-24T10:00:00.000Z", pathwayId: "nclex-rn" }] }));
    expect(withChoice.attempts[0].selectedOptionId).toBe("c");
  });
});
