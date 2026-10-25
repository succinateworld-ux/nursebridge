import type { AttemptRecord, StudyPlan } from "./progress";
import type { PathwayId } from "./pathways";

export interface StudyPlanSummary {
  answersToday: number;
  answersThisWeek: number;
  dailyQuestionTarget: number;
  weeklyQuestionGoal: number;
  daysUntilExam: number | null;
}

export function getStudyPlanSummary(
  attempts: AttemptRecord[],
  pathwayId: PathwayId,
  plan: StudyPlan | undefined,
  now = new Date()
): StudyPlanSummary {
  const weeklyQuestionGoal = plan?.weeklyQuestionGoal ?? 14;
  const dailyQuestionTarget = Math.max(1, Math.ceil(weeklyQuestionGoal / 7));
  const scoped = attempts.filter(attempt => attempt.pathwayId === pathwayId);
  const weekStart = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const today = now.toDateString();
  const validTimes = scoped.map(attempt => ({ attempt, time: Date.parse(attempt.answeredAt) })).filter(value => Number.isFinite(value.time));
  const answersToday = validTimes.filter(value => new Date(value.time).toDateString() === today).length;
  const answersThisWeek = validTimes.filter(value => value.time >= weekStart && value.time <= now.getTime()).length;
  let daysUntilExam: number | null = null;
  if (plan?.targetExamDate) {
    const target = Date.parse(plan.targetExamDate + "T00:00:00Z");
    const current = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    if (Number.isFinite(target)) daysUntilExam = Math.ceil((target - current) / (24 * 60 * 60 * 1000));
  }
  return { answersToday, answersThisWeek, dailyQuestionTarget, weeklyQuestionGoal, daysUntilExam };
}

export function weakestTopics(attempts: AttemptRecord[], pathwayId?: PathwayId, limit = 3) {
  const groups = new Map<string, { total: number; correct: number }>();
  for (const attempt of attempts) {
    if (pathwayId && attempt.pathwayId !== pathwayId) continue;
    const item = groups.get(attempt.topic) ?? { total: 0, correct: 0 };
    item.total += 1;
    item.correct += Number(attempt.correct);
    groups.set(attempt.topic, item);
  }
  return [...groups.entries()]
    .map(([topic, result]) => ({ topic, ...result, accuracy: Math.round(result.correct * 100 / result.total) }))
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total || a.topic.localeCompare(b.topic))
    .slice(0, limit);
}
