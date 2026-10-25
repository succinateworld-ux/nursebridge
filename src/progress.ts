import { isPathwayId, type PathwayId } from "./pathways";

export interface AttemptRecord {
  questionId: string;
  selectedOptionId?: string;
  subject: string;
  topic: string;
  correct: boolean;
  answeredAt: string;
  pathwayId?: PathwayId;
}

export interface StudyPlan {
  targetExamDate: string | null;
  weeklyQuestionGoal: number;
}

export interface LearnerProgress {
  version: 3;
  selectedPathwayId: PathwayId | null;
  completedLessonIds: string[];
  completedLessonsByPathway: Partial<Record<PathwayId, string[]>>;
  attempts: AttemptRecord[];
  studyPlans: Partial<Record<PathwayId, StudyPlan>>;
  bookmarkedQuestionIds: string[];
}

export const PROGRESS_KEY = "nursebridge:guest-progress:v2";
export const LEGACY_PROGRESS_KEY = "nursebridge:guest-progress:v1";

const emptyProgress = (): LearnerProgress => ({
  version: 3,
  selectedPathwayId: null,
  completedLessonIds: [],
  completedLessonsByPathway: {},
  attempts: [],
  studyPlans: {},
  bookmarkedQuestionIds: []
});

function normalizeIds(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string"))] : [];
}

function normalizeAttempts(value: unknown): AttemptRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is AttemptRecord => Boolean(row) && typeof row === "object" &&
    typeof row.questionId === "string" && typeof row.subject === "string" && typeof row.topic === "string" &&
    typeof row.correct === "boolean" && typeof row.answeredAt === "string")
    .map(row => {
      const { pathwayId, ...record } = row as AttemptRecord & { pathwayId?: unknown };
      const selectedOptionId = typeof record.selectedOptionId === "string" ? record.selectedOptionId : undefined;
      return { ...record, ...(selectedOptionId ? { selectedOptionId } : {}), ...(isPathwayId(pathwayId) ? { pathwayId } : {}) };
    })
    .slice(-500);
}

function isValidDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeCompletedByPathway(value: unknown): LearnerProgress["completedLessonsByPathway"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: LearnerProgress["completedLessonsByPathway"] = {};
  for (const [key, ids] of Object.entries(value)) if (isPathwayId(key)) result[key] = normalizeIds(ids);
  return result;
}

function normalizeStudyPlans(value: unknown): LearnerProgress["studyPlans"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: LearnerProgress["studyPlans"] = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!isPathwayId(key) || !raw || typeof raw !== "object") continue;
    const plan = raw as Record<string, unknown>;
    const date = plan.targetExamDate;
    const validDate = date === null || isValidDateOnly(date);
    const goal = plan.weeklyQuestionGoal;
    if (validDate && Number.isInteger(goal) && Number(goal) >= 1 && Number(goal) <= 200) {
      result[key] = { targetExamDate: date as string | null, weeklyQuestionGoal: Number(goal) };
    }
  }
  return result;
}

export function parseProgress(raw: string | null): LearnerProgress {
  if (!raw) return emptyProgress();
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!Array.isArray(value.completedLessonIds) || !Array.isArray(value.attempts)) return emptyProgress();
    if (value.version === 1) {
      return {
        ...emptyProgress(),
        completedLessonIds: normalizeIds(value.completedLessonIds),
        attempts: normalizeAttempts(value.attempts)
      };
    }
    if (value.version !== 2 && value.version !== 3) return emptyProgress();
    return {
      version: 3,
      selectedPathwayId: isPathwayId(value.selectedPathwayId) ? value.selectedPathwayId : null,
      completedLessonIds: normalizeIds(value.completedLessonIds),
      completedLessonsByPathway: normalizeCompletedByPathway(value.completedLessonsByPathway),
      attempts: normalizeAttempts(value.attempts),
      studyPlans: normalizeStudyPlans(value.studyPlans),
      bookmarkedQuestionIds: normalizeIds(value.bookmarkedQuestionIds)
    };
  } catch { return emptyProgress(); }
}

export function loadProgress(): LearnerProgress {
  try {
    const current = window.localStorage.getItem(PROGRESS_KEY);
    if (current) return parseProgress(current);
    const legacy = window.localStorage.getItem(LEGACY_PROGRESS_KEY);
    if (!legacy) return emptyProgress();
    const migrated = parseProgress(legacy);
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(migrated));
    window.localStorage.removeItem(LEGACY_PROGRESS_KEY);
    return migrated;
  } catch { return emptyProgress(); }
}

export function saveProgress(progress: LearnerProgress): boolean {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    window.localStorage.removeItem(LEGACY_PROGRESS_KEY);
    return true;
  } catch { return false; }
}

export function selectPathway(progress: LearnerProgress, pathwayId: PathwayId): LearnerProgress {
  return { ...progress, selectedPathwayId: pathwayId };
}

export function saveStudyPlan(progress: LearnerProgress, pathwayId: PathwayId, plan: StudyPlan): LearnerProgress {
  return { ...progress, studyPlans: { ...progress.studyPlans, [pathwayId]: plan } };
}

export function clearProgressStorage(): boolean {
  try {
    window.localStorage.removeItem(PROGRESS_KEY);
    window.localStorage.removeItem(LEGACY_PROGRESS_KEY);
    return true;
  } catch { return false; }
}

export function addAttempt(progress: LearnerProgress, attempt: AttemptRecord): LearnerProgress {
  return { ...progress, attempts: [...progress.attempts, attempt].slice(-500) };
}

export function toggleQuestionBookmark(progress: LearnerProgress, questionId: string): LearnerProgress {
  if (!questionId) return progress;
  const bookmarkedQuestionIds = progress.bookmarkedQuestionIds.includes(questionId)
    ? progress.bookmarkedQuestionIds.filter(id => id !== questionId)
    : [...progress.bookmarkedQuestionIds, questionId];
  return { ...progress, bookmarkedQuestionIds };
}

export function completeLesson(progress: LearnerProgress, lessonId: string, pathwayId?: PathwayId | null): LearnerProgress {
  const completedLessonIds = progress.completedLessonIds.includes(lessonId) ? progress.completedLessonIds : [...progress.completedLessonIds, lessonId];
  if (!pathwayId) return { ...progress, completedLessonIds };
  const current = progress.completedLessonsByPathway[pathwayId] ?? [];
  const completedLessonsByPathway = current.includes(lessonId)
    ? progress.completedLessonsByPathway
    : { ...progress.completedLessonsByPathway, [pathwayId]: [...current, lessonId] };
  return { ...progress, completedLessonIds, completedLessonsByPathway };
}

export function completedLessonsFor(progress: LearnerProgress, pathwayId?: PathwayId | null): string[] {
  return pathwayId ? progress.completedLessonsByPathway[pathwayId] ?? [] : progress.completedLessonIds;
}

export function calculateScore(attempts: AttemptRecord[], pathwayId?: PathwayId): { answered: number; correct: number; percent: number } {
  const relevant = pathwayId ? attempts.filter(attempt => attempt.pathwayId === pathwayId) : attempts;
  const correct = relevant.reduce((total, attempt) => total + Number(attempt.correct), 0);
  return { answered: relevant.length, correct, percent: relevant.length ? Math.round(correct * 100 / relevant.length) : 0 };
}
