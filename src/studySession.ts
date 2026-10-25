import type { Question } from "./content";
import { isPathwayId, type PathwayId } from "./pathways";
import type { PracticeMode } from "./practiceModes";

export interface PracticeSession {
  ids: string[];
  index: number;
  selectedOptionId: string;
  submitted: boolean;
  questionSet: Question[];
  pathwayId: PathwayId | null;
  mode: PracticeMode;
}

export interface ExamSession {
  id: string;
  status: "active" | "review";
  ids: string[];
  index: number;
  answers: Record<string, string>;
  secondsLeft: number;
  durationMinutes: number;
  deadlineAt: number;
  pathwayId: PathwayId | null;
}

export const PRACTICE_SESSION_KEY = "nursebridge:practice-session:v1";
export const EXAM_SESSION_KEY = "nursebridge:exam-session:v1";

function safeRead(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function safeWrite(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch { /* The active session still works in memory when storage is unavailable. */ }
}

export function loadPracticeSession(raw: string | null, bank: Question[]): PracticeSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const ids = value.ids;
    const index = value.index;
    if (value.version !== 1 || !Array.isArray(ids) || !ids.length || !ids.every(id => typeof id === "string") ||
      new Set(ids).size !== ids.length || !Number.isInteger(index) || Number(index) < 0 || Number(index) >= ids.length) return null;
    const questionSet = ids.map(id => bank.find(question => question.id === id));
    if (questionSet.some(question => !question)) return null;
    const current = questionSet[Number(index)]!;
    const selected = value.selectedOptionId;
    const selectedOptionId = typeof selected === "string" && current.options.some(option => option.id === selected) ? selected : "";
    const supportedModes: PracticeMode[] = ["quick", "topic", "pathway", "daily", "random", "weak-topics", "bookmarked", "review-mistakes"];
    const mode = typeof value.mode === "string" && supportedModes.includes(value.mode as PracticeMode) ? value.mode as PracticeMode : "quick";
    return { ids: ids as string[], index: Number(index), selectedOptionId, submitted: value.submitted === true && Boolean(selectedOptionId), questionSet: questionSet as Question[], pathwayId: isPathwayId(value.pathwayId) ? value.pathwayId : null, mode };
  } catch { return null; }
}

export function storePracticeSession(session: PracticeSession | null, bank: Question[]): void {
  if (!session || session.questionSet.some(question => !bank.includes(question))) {
    safeWrite(PRACTICE_SESSION_KEY, null);
    return;
  }
  safeWrite(PRACTICE_SESSION_KEY, JSON.stringify({ version: 1, ids: session.ids, index: session.index, selectedOptionId: session.selectedOptionId, submitted: session.submitted, pathwayId: session.pathwayId, mode: session.mode }));
}

export function loadExamSession(raw: string | null, bank: Question[], now = Date.now()): ExamSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const ids = value.ids;
    const index = value.index;
    const durationMinutes = value.durationMinutes;
    const deadlineAt = value.deadlineAt;
    const status = value.status;
    if (value.version !== 1 || typeof value.id !== "string" || !value.id || !Array.isArray(ids) || !ids.length ||
      !ids.every(id => typeof id === "string" && bank.some(question => question.id === id)) || new Set(ids).size !== ids.length ||
      !Number.isInteger(index) || Number(index) < 0 || Number(index) >= ids.length ||
      !Number.isInteger(durationMinutes) || Number(durationMinutes) < 1 || Number(durationMinutes) > 180 ||
      typeof deadlineAt !== "number" || !Number.isFinite(deadlineAt) || (status !== "active" && status !== "review")) return null;
    const answerInput = value.answers && typeof value.answers === "object" && !Array.isArray(value.answers) ? value.answers as Record<string, unknown> : {};
    const answers: Record<string, string> = {};
    for (const id of ids as string[]) {
      const selected = answerInput[id];
      const question = bank.find(item => item.id === id);
      if (typeof selected === "string" && question?.options.some(option => option.id === selected)) answers[id] = selected;
    }
    const secondsLeft = status === "active" ? Math.max(0, Math.ceil((deadlineAt - now) / 1000)) : 0;
    return {
      id: value.id,
      status,
      ids: ids as string[],
      index: Number(index),
      answers,
      secondsLeft,
      durationMinutes: Number(durationMinutes),
      deadlineAt,
      pathwayId: isPathwayId(value.pathwayId) ? value.pathwayId : null
    };
  } catch { return null; }
}

export function storeExamSession(session: ExamSession | null): void {
  safeWrite(EXAM_SESSION_KEY, session ? JSON.stringify({ version: 1, ...session }) : null);
}

export function clearStoredStudySessions(): void {
  safeWrite(PRACTICE_SESSION_KEY, null);
  safeWrite(EXAM_SESSION_KEY, null);
}

export function loadStoredPractice(bank: Question[]): PracticeSession | null {
  return loadPracticeSession(safeRead(PRACTICE_SESSION_KEY), bank);
}

export function loadStoredExam(bank: Question[]): ExamSession | null {
  return loadExamSession(safeRead(EXAM_SESSION_KEY), bank);
}
