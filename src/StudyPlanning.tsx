import { useState } from "react";
import { ArrowRight, CalendarDays, Check, CheckCircle2, ChevronRight, ExternalLink, FileQuestion, MapPin, ShieldCheck, Target } from "lucide-react";
import { lessons, questions } from "./content";
import { getStudyPlanSummary } from "./studyPlan";
import type { LearnerProgress, StudyPlan } from "./progress";
import { examPathways, type ExamPathway, type PathwayId } from "./pathways";

export function PathwaysPage({ selectedId, onSelect, onBrowse }: {
  selectedId: PathwayId | null;
  onSelect: (id: PathwayId) => void;
  onBrowse: () => void;
}) {
  const generalCount = questions.filter(question => question.pathwayIds.length === 0).length;
  const generalLessonCount = lessons.filter(lesson => lesson.pathwayIds.length === 0).length;
  return <>
    <header className="page-heading">
      <div><div className="eyebrow"><span className="eyebrow-rule" />EXAM PATHWAYS</div><h1>Choose the licence you are working toward.</h1><p>Each pathway has its own jurisdiction and focus. Original pathway-focused practice is available, but no item is formally mapped to an official blueprint or clinically reviewed.</p></div>
      <span className="pathway-honesty"><ShieldCheck size={15} />No official exam questions</span>
    </header>
    <div className="pathway-directory-intro"><span>FIVE PATHWAYS</span><p>Select a pathway to keep your new answers, lesson completions, and study plan together. You can switch at any time; saved pathway history stays separate. Topic lists are proposed study areas unless an official blueprint is explicitly linked and checked.</p></div>
    <section className="pathway-directory" aria-label="Available examination pathways">
      {examPathways.map((pathway, index) => {
        const selected = selectedId === pathway.id;
        const mappedCount = questions.filter(question => question.pathwayIds.includes(pathway.id)).length;
        return <article key={pathway.id} className={`pathway-row ${selected ? "pathway-row-selected" : ""}`}>
          <span className="pathway-index">{String(index + 1).padStart(2, "0")}</span>
          <div className="pathway-main">
            <div className="pathway-title-row"><h2>{pathway.name}</h2>{selected && <span className="pathway-current"><CheckCircle2 size={13} />CURRENT</span>}</div>
            <p className="pathway-credential">{pathway.credential}</p>
            <p className="pathway-purpose">{pathway.purpose}</p>
            <div className="pathway-jurisdiction"><MapPin size={13} />{pathway.jurisdiction}</div>
            <div className="pathway-focus-wrap"><span className="pathway-focus-heading">PROPOSED STUDY AREAS · REVIEW AGAINST CURRENT LOCAL GUIDANCE</span><div className="pathway-focus-list" aria-label="Proposed pathway study areas">{pathway.focusAreas.map(area => <span key={area}>{area}</span>)}</div></div>
            <div className="pathway-status-grid">
              <div><span>CONTENT AVAILABLE</span><strong>{generalLessonCount} lessons · {generalCount} general questions</strong><small>Shared foundation; not mapped to this examination</small></div>
              <div><span>PATHWAY PRACTICE</span><strong>{mappedCount ? `${mappedCount} original questions` : "In development"}</strong><small>Pathway-focused topics · not blueprint mapped</small></div>
              <div><span>REFERENCE CHECK</span><strong>{pathway.blueprintVerified ? "Official plan checked" : "Official exam information checked"}</strong><small>{pathway.source.sourceCheckedAt} · {pathway.blueprintStatus}</small></div>
            </div>
            <a className="pathway-reference" href={pathway.source.url} target="_blank" rel="noreferrer">{pathway.source.title}<ExternalLink size={13} /></a>
          </div>
          <div className="pathway-actions">
            <button className={selected ? "button button-secondary" : "button button-primary"} onClick={() => onSelect(pathway.id)} disabled={selected}>{selected ? <><Check size={15} />Selected</> : <>Choose pathway<ArrowRight size={15} /></>}</button>
            <button className="text-link" onClick={onBrowse}>Browse free foundations<ChevronRight size={14} /></button>
          </div>
        </article>;
      })}
    </section>
    <p className="pathway-footer-note">NurseBridge is independent study software by Nurse Succinate. It is not endorsed by NMCN or NCSBN. Other jurisdictions can be added as their source material and reviewed content become available.</p>
  </>;
}

export function StudyPlanPage({ pathway, plan, progress, onSave, onChoosePathway }: {
  pathway: ExamPathway | null;
  plan: StudyPlan | undefined;
  progress: LearnerProgress;
  onSave: (value: StudyPlan) => void;
  onChoosePathway: () => void;
}) {
  const [targetExamDate, setTargetExamDate] = useState(plan?.targetExamDate ?? "");
  const [weeklyGoal, setWeeklyGoal] = useState(plan?.weeklyQuestionGoal ?? 14);
  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (!pathway) return <>
    <header className="page-heading"><div><div className="eyebrow"><span className="eyebrow-rule" />YOUR STUDY PLAN</div><h1>Give your revision a steady rhythm.</h1><p>Choose an examination pathway before setting its private study target.</p></div></header>
    <section className="plan-no-path"><span><CalendarDays size={19} /></span><div><strong>Start by choosing your exam pathway</strong><p>Your weekly goal and target date will be saved separately for each pathway.</p></div><button className="button button-primary" onClick={onChoosePathway}>Choose a pathway <ArrowRight size={15} /></button></section>
  </>;

  const summary = getStudyPlanSummary(progress.attempts, pathway.id, plan);
  const weeklyPercent = Math.min(100, Math.round(summary.answersThisWeek * 100 / summary.weeklyQuestionGoal));
  const canSave = Number.isInteger(weeklyGoal) && weeklyGoal >= 1 && weeklyGoal <= 200 && (!targetExamDate || targetExamDate >= minDate);
  return <>
    <header className="page-heading"><div><div className="eyebrow"><span className="eyebrow-rule" />YOUR STUDY PLAN</div><h1>Make your next step manageable.</h1><p>A private plan for {pathway.name}. Only answers submitted in this browser count toward your weekly target.</p></div><span className="local-progress-badge"><ShieldCheck size={14} />On this device</span></header>
    <section className="plan-layout">
      <article className="plan-settings-panel">
        <span className="section-overline">SET A PERSONAL TARGET</span>
        <h2>{pathway.name}</h2>
        <p className="plan-jurisdiction"><MapPin size={13} />{pathway.jurisdiction}</p>
        <label className="form-field"><span>Target examination date <small>Optional</small></span><input type="date" min={minDate} value={targetExamDate} onChange={event => setTargetExamDate(event.target.value)} /></label>
        <label className="form-field"><span>Questions to practise each week</span><input type="number" inputMode="numeric" min={1} max={200} value={weeklyGoal} onChange={event => setWeeklyGoal(Number(event.target.value))} /></label>
        <p className="plan-note">The daily objective is derived from your weekly question target. NurseBridge does not track time spent studying.</p>
        <button className="button button-primary" onClick={() => onSave({ targetExamDate: targetExamDate || null, weeklyQuestionGoal: weeklyGoal })} disabled={!canSave}>Save study plan <Check size={15} /></button>
      </article>
      <article className="plan-progress-panel">
        <div className="plan-progress-heading"><span className="plan-progress-icon"><Target size={17} /></span><span><span className="section-overline">THIS WEEK</span><h2>Your actual practice count</h2></span></div>
        <div className="plan-answers-count"><strong>{summary.answersThisWeek}</strong><span>of {summary.weeklyQuestionGoal} answers<br />in the last 7 days</span></div>
        <div className="plan-meter" role="img" aria-label={`${weeklyPercent}% of weekly practice target completed`}><span style={{ width: `${weeklyPercent}%` }} /></div>
        <div className="plan-meter-caption"><span>0</span><span>{weeklyPercent}%</span><span>{summary.weeklyQuestionGoal}</span></div>
        <div className="plan-daily-row"><span><FileQuestion size={16} />Today's objective</span><strong>{summary.answersToday} / {summary.dailyQuestionTarget} answers</strong></div>
        <div className="plan-daily-row"><span><CalendarDays size={16} />Exam date</span><strong>{summary.daysUntilExam === null ? "Not set" : summary.daysUntilExam < 0 ? "Date has passed" : summary.daysUntilExam === 0 ? "Today" : `${summary.daysUntilExam} days away`}</strong></div>
        {!summary.answersThisWeek && <p className="plan-zero-note">Your plan is ready. Submit a practice answer and it will appear here; nothing is pre-filled.</p>}
      </article>
    </section>
    <div className="plan-next-step"><span className="section-overline">A GOOD NEXT STEP</span><p>{summary.answersThisWeek < summary.weeklyQuestionGoal ? `Try ${Math.max(1, Math.min(summary.dailyQuestionTarget, summary.weeklyQuestionGoal - summary.answersThisWeek))} original practice ${summary.dailyQuestionTarget === 1 ? "question" : "questions"} today.` : "You have reached the question target you set for this week."}</p><small>Practice supports revision; it does not predict examination outcomes.</small></div>
  </>;
}
