import type { Question } from "./content";
import type { AttemptRecord } from "./progress";
import type { PathwayId } from "./pathways";

export type PracticeMode = "quick" | "topic" | "pathway" | "daily" | "random" | "weak-topics" | "bookmarked" | "review-mistakes";

export interface PracticeSelection {
  bank: Question[];
  mode: PracticeMode;
  pathwayId: PathwayId | null;
  attempts?: AttemptRecord[];
  bookmarkedIds?: string[];
  subject?: string;
  topic?: string;
  date?: string;
  limit?: number;
  random?: () => number;
}

function randomSource(seed: string): () => number {
  let value = 2166136261;
  for (const character of seed) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return () => {
    value += 0x6D2B79F5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function localDateKey(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function eligibleBank(bank: Question[], pathwayId: PathwayId | null): Question[] {
  return bank.filter(question => question.pathwayIds.length === 0 || Boolean(pathwayId && question.pathwayIds.includes(pathwayId)));
}

function weakTopics(attempts: AttemptRecord[], pathwayId: PathwayId | null): Set<string> {
  const totals = new Map<string, { attempted: number; correct: number }>();
  for (const attempt of attempts) {
    if (pathwayId ? attempt.pathwayId !== pathwayId : Boolean(attempt.pathwayId)) continue;
    const topic = totals.get(attempt.topic) ?? { attempted: 0, correct: 0 };
    topic.attempted++;
    topic.correct += Number(attempt.correct);
    totals.set(attempt.topic, topic);
  }
  return new Set([...totals].filter(([, value]) => value.attempted >= 2 && value.correct / value.attempted < 0.6).map(([topic]) => topic));
}

function latestIncorrectAttempts(attempts: AttemptRecord[], pathwayId: PathwayId | null): AttemptRecord[] {
  const latest = new Map<string, { attempt: AttemptRecord; index: number }>();
  attempts.forEach((attempt, index) => {
    if (pathwayId ? attempt.pathwayId !== pathwayId : Boolean(attempt.pathwayId)) return;
    latest.set(attempt.questionId, { attempt, index });
  });
  return [...latest.values()].filter(item => !item.attempt.correct).sort((left, right) => right.index - left.index).map(item => item.attempt);
}

export function previousIncorrectOption(attempts: AttemptRecord[], questionId: string, pathwayId: PathwayId | null): string | null {
  return latestIncorrectAttempts(attempts, pathwayId).find(attempt => attempt.questionId === questionId)?.selectedOptionId ?? null;
}

export function practicePoolCount(bank: Question[], pathwayId: PathwayId | null): number {
  return eligibleBank(bank, pathwayId).length;
}

export function examQuestionChoices(availableCount: number): number[] {
  if (!Number.isInteger(availableCount) || availableCount < 1) return [];
  return [...new Set([Math.min(5, availableCount), Math.min(10, availableCount), availableCount])];
}

export function resolveExamQuestionCount(requestedCount: number, availableCount: number): number {
  const choices = examQuestionChoices(availableCount);
  if (!choices.length) return 0;
  return choices.reduce((best, choice) => Math.abs(choice - requestedCount) < Math.abs(best - requestedCount) ? choice : best, choices[0]);
}

export function countForPracticeMode(selection: Omit<PracticeSelection, "random">): number {
  const bank = eligibleBank(selection.bank, selection.pathwayId);
  const attempts = selection.attempts ?? [];
  const ids = new Set(latestIncorrectAttempts(attempts, selection.pathwayId).map(item => item.questionId));
  let selected: Question[];
  switch (selection.mode) {
    case "topic": selected = bank.filter(question => (!selection.subject || question.subject === selection.subject) && (!selection.topic || question.topic === selection.topic)); break;
    case "pathway": selected = selection.pathwayId ? bank.filter(question => question.pathwayIds.includes(selection.pathwayId!)) : bank; break;
    case "weak-topics": { const topics = weakTopics(attempts, selection.pathwayId); selected = bank.filter(question => topics.has(question.topic)); break; }
    case "bookmarked": { const bookmarks = new Set(selection.bookmarkedIds ?? []); selected = bank.filter(question => bookmarks.has(question.id)); break; }
    case "review-mistakes": selected = bank.filter(question => ids.has(question.id)); break;
    default: selected = bank;
  }
  if (selection.mode === "quick" || selection.mode === "daily") return Math.min(selection.limit ?? 5, selected.length);
  if (selection.mode === "random") return Math.min(selection.limit ?? 10, selected.length);
  return selected.length;
}

export function selectPracticeQuestions(selection: PracticeSelection): Question[] {
  const available = eligibleBank(selection.bank, selection.pathwayId);
  const attempts = selection.attempts ?? [];
  let selected: Question[];
  switch (selection.mode) {
    case "topic": selected = available.filter(question => (!selection.subject || question.subject === selection.subject) && (!selection.topic || question.topic === selection.topic)); break;
    case "pathway": selected = selection.pathwayId ? available.filter(question => question.pathwayIds.includes(selection.pathwayId!)) : available; break;
    case "weak-topics": { const topics = weakTopics(attempts, selection.pathwayId); selected = available.filter(question => topics.has(question.topic)); break; }
    case "bookmarked": { const bookmarks = new Set(selection.bookmarkedIds ?? []); selected = available.filter(question => bookmarks.has(question.id)); break; }
    case "review-mistakes": {
      const recentMistakes = latestIncorrectAttempts(attempts, selection.pathwayId).map(item => item.questionId);
      const byId = new Map(available.map(question => [question.id, question]));
      selected = recentMistakes.map(id => byId.get(id)).filter((question): question is Question => Boolean(question));
      break;
    }
    case "quick":
    case "random": selected = available; break;
    case "daily": selected = available; break;
  }
  const random = selection.random ?? (selection.mode === "daily" ? randomSource(`${selection.date ?? localDateKey()}:${selection.pathwayId ?? "general"}:nursebridge-daily`) : Math.random);
  if (["quick", "random", "daily", "topic", "pathway"].includes(selection.mode)) selected = shuffle(selected, random);
  if (selection.mode === "daily" || selection.mode === "quick") return selected.slice(0, selection.limit ?? 5);
  if (selection.mode === "random") return selected.slice(0, selection.limit ?? 10);
  return selected;
}
