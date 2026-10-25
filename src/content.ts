import { PATHWAY_IDS, type PathwayId } from "./pathways";
import { pathwayQuestions } from "./questionBank";

export type SubjectId = "mental-health" | "public-health" | "nursing-fundamentals" | "exam-revision" | "maternal-newborn" | "medical-surgical" | "pharmacology" | "community-health" | "professional-practice" | "child-health";
export type Difficulty = "Foundational" | "Applied" | "Advanced";
export type ContentStatus = "drafted" | "source-checked" | "clinically-reviewed" | "ready-for-use";
export type AlignmentStatus = "source-linked-general" | "pathway-practice" | "blueprint-mapped";
export interface SourceReference { title: string; url: string; publisher: string; sourceCheckedAt: string }
export interface LessonSection { heading: string; paragraphs: string[] }
export interface Lesson {
  id: string; title: string; subject: SubjectId; topic: string; examTags: string[]; difficulty: Difficulty;
  pathwayIds: PathwayId[]; jurisdiction: string; verificationStatus: "source-linked-general" | "pathway-mapped";
  estimatedMinutes: number; learningObjectives: string[]; sections: LessonSection[]; takeaways: string[]; source: SourceReference;
}
export interface Question {
  id: string; subject: SubjectId; topic: string; examTags: string[]; difficulty: Difficulty; contentType: "Practice question";
  questionType: "single-best-answer"; contentStatus: ContentStatus; lastReviewedAt: string | null;
  clinicalReviewer?: string;
  pathwayIds: PathwayId[]; jurisdiction: string; verificationStatus: AlignmentStatus;
  learningObjective: string; learningPoint: string; stem: string; options: { id: string; text: string }[]; correctOptionId: string;
  explanation: string; distractorExplanations: Record<string, string>; source: SourceReference;
}

const checked = "2026-10-24";
const sources = {
  mhgap: { title: "mhGAP guideline for mental, neurological and substance use disorders", url: "https://www.who.int/publications/i/item/9789240084278", publisher: "World Health Organization", sourceCheckedAt: checked },
  community: { title: "Community Planning: Data & Benchmarks", url: "https://www.cdc.gov/public-health-gateway/php/public-health-strategy/public-health-strategies-for-community-health-assessment-data-benchmarks.html", publisher: "U.S. Centers for Disease Control and Prevention", sourceCheckedAt: checked },
  hygiene: { title: "Five moments for hand hygiene — implementation tools", url: "https://www.who.int/teams/integrated-health-services/infection-prevention-control/hand-hygiene/implementation-tools", publisher: "World Health Organization", sourceCheckedAt: checked },
  nmcn: { title: "Education Department", url: "https://nmcn.gov.ng/education.html", publisher: "Nursing and Midwifery Council of Nigeria", sourceCheckedAt: checked }
} satisfies Record<string, SourceReference>;

const generalAlignment = {
  pathwayIds: [] as PathwayId[],
  jurisdiction: "General nursing education",
  verificationStatus: "source-linked-general" as const
};

const lessonRows: Omit<Lesson, "pathwayIds" | "jurisdiction" | "verificationStatus">[] = [
  {
    id: "mental-health-therapeutic-communication", title: "Starting a supportive mental-health conversation", subject: "mental-health", topic: "Therapeutic communication", examTags: ["General practice"], difficulty: "Foundational", estimatedMinutes: 7,
    learningObjectives: ["Use a calm, open invitation to understand a person's concern.", "Respond without judgement or false reassurance.", "Recognise when an immediate safety concern needs escalation."],
    sections: [
      { heading: "Begin with the person", paragraphs: ["A useful first response creates room for the person to describe what matters to them. Use an open invitation, listen without interrupting, and check your understanding in plain language.", "Reflect the emotion you hear without claiming to know exactly how the person feels. Avoid rushing into advice, arguing with a belief, or promising that everything will be fine."] },
      { heading: "Keep safety in view", paragraphs: ["If someone describes possible self-harm or immediate danger, respond directly and calmly. Follow your local urgent-safety pathway, involve an appropriately qualified clinician, and stay within your role and training.", "The WHO mhGAP resources support structured assessment and care in non-specialist settings. They are a guide for trained health workers, not a substitute for local protocols, supervision, or an individual clinical assessment."] }
    ],
    takeaways: ["Invite the story before offering a solution.", "Use empathy, clarification, and non-judgmental language.", "Escalate immediate safety concerns using local procedures."], source: sources.mhgap
  },
  {
    id: "public-health-community-diagnosis", title: "From community information to a useful diagnosis", subject: "public-health", topic: "Community diagnosis", examTags: ["General practice"], difficulty: "Applied", estimatedMinutes: 8,
    learningObjectives: ["Distinguish assessment data from a community diagnosis.", "Combine population data with community knowledge and assets.", "Use transparent criteria when prioritising a health issue."],
    sections: [
      { heading: "Assess before you prioritise", paragraphs: ["A community health assessment gathers and analyses information about health status, contributing conditions, community resources, and the views of people who live there. No single data source tells the whole story.", "Bring together appropriate quantitative information, local service knowledge, and community perspectives. Check who is missing from the data and consider whether the information is current and representative."] },
      { heading: "Describe the problem clearly", paragraphs: ["A useful diagnosis names the population, the observed health issue, and the evidence or conditions that help explain it. Separate what the data show from what still needs investigation.", "When setting priorities, make the criteria visible. Consider the scale and severity of the issue, available evidence, feasibility, equity, and what affected community members identify as important."] }
    ],
    takeaways: ["Use more than one trustworthy information source.", "Include community perspectives and available assets.", "State uncertainty and explain how priorities were chosen."], source: sources.community
  },
  {
    id: "fundamentals-five-moments", title: "Hand hygiene: recognise the five moments", subject: "nursing-fundamentals", topic: "Infection prevention", examTags: ["General practice"], difficulty: "Foundational", estimatedMinutes: 6,
    learningObjectives: ["Recall the five WHO moments for hand hygiene.", "Apply the moments to patient contact and the nearby environment.", "Understand that gloves do not replace hand hygiene."],
    sections: [
      { heading: "The five moments", paragraphs: ["Perform hand hygiene before touching a patient; before a clean or aseptic procedure; after body-fluid exposure risk; after touching a patient; and after touching the patient's surroundings.", "The moments focus on when hand hygiene is needed in care. Follow your facility's current infection-prevention policy for the appropriate method and technique."] },
      { heading: "Gloves are not a substitute", paragraphs: ["Gloves can become contaminated and do not remove the need for hand hygiene. Follow local policy for glove use, change gloves when indicated, and perform hand hygiene at the relevant moments, including after glove removal."] }
    ],
    takeaways: ["Remember the sequence: before patient, before aseptic task, after body-fluid risk, after patient, after surroundings.", "A nearby surface can matter even when the patient was not touched.", "Glove use does not replace hand hygiene."], source: sources.hygiene
  },
  {
    id: "exam-revision-reasoning", title: "A steady approach to nursing practice questions", subject: "exam-revision", topic: "Question reasoning", examTags: ["General practice"], difficulty: "Applied", estimatedMinutes: 5,
    learningObjectives: ["Identify the task a question is asking you to perform.", "Separate evidence in the stem from assumptions.", "Use practice results to choose a focused revision topic."],
    sections: [
      { heading: "Read for the decision", paragraphs: ["First identify whether the item asks for an assessment, priority, explanation, or next action. Note the population and setting; they can change which answer is safest and most appropriate.", "Use only information in the question and established guidance. If a detail is missing, do not invent it. For real care, follow local protocols and consult a qualified supervisor."] },
      { heading: "Review the rationale", paragraphs: ["After answering, compare the explanation with each option. Record the topic you need to revisit, not just whether you got the item right. This practice bank is original learning material and is not an official examination paper or a prediction of exam content.", "The Nursing and Midwifery Council of Nigeria oversees nursing education and curricula. Use the current information from your school and Council for formal examination requirements."] }
    ],
    takeaways: ["Identify the question's task and setting.", "Check each option against the information provided.", "Practice questions support revision; they do not guarantee examination outcomes."], source: sources.nmcn
  }
];
export const lessons: Lesson[] = lessonRows.map(item => ({ ...generalAlignment, ...item }));

const questionRows: Omit<Question, "pathwayIds" | "jurisdiction" | "verificationStatus" | "questionType" | "contentStatus" | "lastReviewedAt" | "learningPoint">[] = [
  { id: "mh-communication-01", subject: "mental-health", topic: "Therapeutic communication", examTags: ["General practice"], difficulty: "Foundational", contentType: "Practice question", learningObjective: "Choose an open, non-judgmental opening response.", stem: "A person tells a nurse they have felt overwhelmed for several weeks. Which opening response best invites the person to explain their experience?", options: [{ id: "a", text: "You should try to focus on the positive things in your life." }, { id: "b", text: "Could you tell me what has felt most difficult recently?" }, { id: "c", text: "Everyone feels this way from time to time." }, { id: "d", text: "Why did you wait several weeks before telling anyone?" }], correctOptionId: "b", explanation: "An open invitation lets the person describe their concern in their own words and keeps the response focused on their experience.", distractorExplanations: { a: "This gives advice before understanding the concern.", c: "This may minimise the person's experience.", d: "The wording can sound blaming and may discourage discussion." }, source: sources.mhgap },
  { id: "mh-safety-01", subject: "mental-health", topic: "Safety and escalation", examTags: ["General practice"], difficulty: "Applied", contentType: "Practice question", learningObjective: "Recognise a possible immediate safety concern and use the local escalation pathway.", stem: "During a conversation, a person says they may harm themselves today. What is the most appropriate response for a student nurse?", options: [{ id: "a", text: "Promise to keep the statement secret so trust is maintained." }, { id: "b", text: "Calmly clarify immediate safety, stay within role, and urgently involve the supervising clinician using local policy." }, { id: "c", text: "Change the subject and arrange a routine review next month." }, { id: "d", text: "Tell the person that their thoughts are irrational." }], correctOptionId: "b", explanation: "A possible immediate risk requires a calm, direct response and prompt escalation through local safety procedures. A student should involve the qualified supervisor and follow the setting's protocol.", distractorExplanations: { a: "A safety concern cannot be handled by promising secrecy.", c: "A routine delay does not address a possible immediate risk.", d: "Judgement can damage communication and does not establish safety." }, source: sources.mhgap },
  { id: "ph-assessment-01", subject: "public-health", topic: "Community health assessment", examTags: ["General practice"], difficulty: "Applied", contentType: "Practice question", learningObjective: "Combine population information with local perspectives and assets.", stem: "A public health nurse is beginning a community assessment. Which approach gives the most useful starting picture?", options: [{ id: "a", text: "Use clinic attendance records as the only source because they are easy to count." }, { id: "b", text: "Combine appropriate health data, local service information, community perspectives, and available assets." }, { id: "c", text: "Select the intervention used by a nearby community before collecting data." }, { id: "d", text: "Ask one community leader to identify every group's priorities." }], correctOptionId: "b", explanation: "A community health assessment brings together multiple forms of information and community knowledge to understand health needs, contributing factors, and resources.", distractorExplanations: { a: "Service records omit people who do not or cannot access those services.", c: "Choosing an intervention before assessing the problem risks a poor fit.", d: "One person's view cannot represent all groups in a community." }, source: sources.community },
  { id: "ph-priority-01", subject: "public-health", topic: "Priority setting", examTags: ["General practice"], difficulty: "Applied", contentType: "Practice question", learningObjective: "Use clear, participatory criteria to prioritise a community issue.", stem: "Two health issues are identified in an assessment. What should the team do before selecting one for an initial community plan?", options: [{ id: "a", text: "Choose the issue with the most dramatic single anecdote." }, { id: "b", text: "Use transparent criteria, review the evidence and feasibility, and include affected community perspectives." }, { id: "c", text: "Choose the issue that requires the least community participation." }, { id: "d", text: "Prioritise whichever issue has a familiar intervention." }], correctOptionId: "b", explanation: "Transparent prioritisation considers evidence, feasibility, equity, and community perspectives rather than relying on one anecdote or convenience.", distractorExplanations: { a: "One account can be important but is not sufficient population evidence.", c: "Avoiding participation can miss local needs and assets.", d: "An available intervention does not prove it addresses the highest-priority need." }, source: sources.community },
  { id: "fund-hand-hygiene-01", subject: "nursing-fundamentals", topic: "Infection prevention", examTags: ["General practice"], difficulty: "Foundational", contentType: "Practice question", learningObjective: "Identify a hand-hygiene moment after contact with patient surroundings.", stem: "A nurse adjusts a bedside table and leaves the patient's immediate care area without touching the patient. Which WHO hand-hygiene moment applies?", options: [{ id: "a", text: "Before touching a patient" }, { id: "b", text: "Before a clean or aseptic procedure" }, { id: "c", text: "After touching patient surroundings" }, { id: "d", text: "No moment applies because the patient was not touched" }], correctOptionId: "c", explanation: "Moment 5 is after touching the patient's surroundings. It applies even if the patient was not touched.", distractorExplanations: { a: "This moment applies before patient contact.", b: "No clean or aseptic procedure is described.", d: "The surroundings are included in the WHO moments." }, source: sources.hygiene },
  { id: "fund-gloves-01", subject: "nursing-fundamentals", topic: "Infection prevention", examTags: ["General practice"], difficulty: "Foundational", contentType: "Practice question", learningObjective: "Recall that gloves do not replace hand hygiene.", stem: "After removing gloves used during patient care, what should the nurse do next according to infection-prevention principles?", options: [{ id: "a", text: "Perform hand hygiene at the indicated moment." }, { id: "b", text: "Put on a fresh pair of gloves without hand hygiene." }, { id: "c", text: "Skip hand hygiene if the gloves look clean." }, { id: "d", text: "Touch the next patient's equipment before cleaning hands." }], correctOptionId: "a", explanation: "Gloves do not replace hand hygiene. Perform hand hygiene after glove removal according to the applicable moment and local policy.", distractorExplanations: { b: "Hand hygiene is still needed; changing gloves does not replace it.", c: "Contamination may not be visible.", d: "This can transfer microorganisms to the next care area." }, source: sources.hygiene },
  { id: "exam-stem-01", subject: "exam-revision", topic: "Question reasoning", examTags: ["General practice"], difficulty: "Foundational", contentType: "Practice question", learningObjective: "Identify the task and setting before evaluating answer choices.", stem: "When reviewing a nursing practice question, what is a useful first step?", options: [{ id: "a", text: "Select the longest answer because it contains more detail." }, { id: "b", text: "Identify what the question asks and note the population and setting." }, { id: "c", text: "Assume the question describes a familiar local protocol." }, { id: "d", text: "Ignore the explanation if the selected option was correct." }], correctOptionId: "b", explanation: "Identifying the task and setting helps focus reasoning on the evidence actually provided.", distractorExplanations: { a: "Answer length is not a reliable indicator of correctness.", c: "The question may not provide enough information to assume a local protocol.", d: "Rationales support learning even after a correct response." }, source: sources.nmcn },
  { id: "exam-source-01", subject: "exam-revision", topic: "Practice material", examTags: ["General practice"], difficulty: "Foundational", contentType: "Practice question", learningObjective: "Distinguish original study questions from official examination material.", stem: "How should a learner interpret NurseBridge practice questions?", options: [{ id: "a", text: "As official past questions from the named examination bodies." }, { id: "b", text: "As original revision material that supports study but does not predict an examination." }, { id: "c", text: "As a guarantee that a particular score will be achieved." }, { id: "d", text: "As a substitute for current course materials and clinical supervision." }], correctOptionId: "b", explanation: "These are original practice items. They are not official examination questions, a prediction, a guarantee, or a substitute for current course and clinical guidance.", distractorExplanations: { a: "NurseBridge does not claim access to official past papers.", c: "Practice cannot guarantee an examination outcome.", d: "Learners should use current education and clinical guidance." }, source: sources.nmcn }
];
const generalQuestionMetadata = {
  ...generalAlignment,
  questionType: "single-best-answer" as const,
  contentStatus: "source-checked" as const,
  lastReviewedAt: checked,
  verificationStatus: "source-linked-general" as const
};
export const questions: Question[] = [
  ...questionRows.map(item => ({ ...generalQuestionMetadata, ...item, learningPoint: item.learningObjective })),
  ...pathwayQuestions
];

const ids = new Set<SubjectId>(["mental-health", "public-health", "nursing-fundamentals", "exam-revision", "maternal-newborn", "medical-surgical", "pharmacology", "community-health", "professional-practice", "child-health"]);
const pathwayIds = new Set<string>(PATHWAY_IDS);
const difficulties = new Set<Difficulty>(["Foundational", "Applied", "Advanced"]);
const contentStatuses = new Set<ContentStatus>(["drafted", "source-checked", "clinically-reviewed", "ready-for-use"]);
const alignmentStatuses = new Set<AlignmentStatus>(["source-linked-general", "pathway-practice", "blueprint-mapped"]);
const nonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const stringList = (value: unknown): value is string[] => Array.isArray(value) && value.length > 0 && value.every(nonEmptyString);
const validSource = (source: unknown): source is SourceReference => {
  if (!source || typeof source !== "object") return false;
  const value = source as Record<string, unknown>;
  if (!nonEmptyString(value.title) || !nonEmptyString(value.publisher) || typeof value.sourceCheckedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.sourceCheckedAt) || typeof value.url !== "string") return false;
  const checkedDate = new Date(`${value.sourceCheckedAt}T00:00:00Z`);
  return !Number.isNaN(checkedDate.getTime()) && checkedDate.toISOString().slice(0, 10) === value.sourceCheckedAt && /^https:\/\//.test(value.url);
};

export function validateLibrary(input: unknown): string[] {
  const errors: string[] = [];
  if (!input || typeof input !== "object" || !Array.isArray((input as { lessons?: unknown }).lessons) || !Array.isArray((input as { questions?: unknown }).questions)) {
    return ["library must contain lesson and question arrays"];
  }
  const value = input as { lessons: unknown[]; questions: unknown[] };
  const allIds = new Set<string>();
  for (const [type, rows] of [["lesson", value.lessons], ["question", value.questions]] as const) {
    for (const [index, raw] of rows.entries()) {
      if (!raw || typeof raw !== "object") { errors.push(`${type}[${index}] must be an object`); continue; }
      const row = raw as Record<string, unknown>;
      if (!nonEmptyString(row.id)) errors.push(`${type}[${index}] needs an id`);
      else if (allIds.has(row.id)) errors.push(`duplicate content id: ${row.id}`); else allIds.add(row.id);
      if (type === "lesson" ? !nonEmptyString(row.title) : !nonEmptyString(row.stem)) errors.push(`${type}[${index}] needs a title or question stem`);
      if (typeof row.subject !== "string" || !ids.has(row.subject as SubjectId)) errors.push(`${type}[${index}] has an unknown subject`);
      if (!nonEmptyString(row.topic)) errors.push(`${type}[${index}] needs a topic`);
      if (typeof row.difficulty !== "string" || !difficulties.has(row.difficulty as Difficulty)) errors.push(`${type}[${index}] has an invalid difficulty`);
      if (!validSource(row.source)) errors.push(`${type}[${index}] needs a dated HTTPS source`);
      if (!stringList(row.examTags)) errors.push(`${type}[${index}] needs at least one exam or learning tag`);
      const mappedPathways = row.pathwayIds;
      if (!Array.isArray(mappedPathways)) errors.push(`${type}[${index}] needs pathway mapping metadata`);
      else if (mappedPathways.some(pathway => typeof pathway !== "string" || !pathwayIds.has(pathway))) errors.push(`${type}[${index}] has an unknown pathway mapping`);
      if (!nonEmptyString(row.jurisdiction)) errors.push(`${type}[${index}] needs a jurisdiction label`);
      if (Array.isArray(mappedPathways)) {
        const expectedStatus = mappedPathways.length === 0 ? "source-linked-general" : type === "lesson" ? "pathway-mapped" : "pathway-practice";
        if (row.verificationStatus !== expectedStatus) errors.push(`${type}[${index}] has an inconsistent pathway verification status`);
      }
      if (type === "question") {
        if (typeof row.verificationStatus !== "string" || !alignmentStatuses.has(row.verificationStatus as AlignmentStatus)) errors.push(`question[${index}] has an invalid alignment status`);
        if (row.questionType !== "single-best-answer") errors.push(`question[${index}] has an unsupported question type`);
        if (typeof row.contentStatus !== "string" || !contentStatuses.has(row.contentStatus as ContentStatus)) errors.push(`question[${index}] has an invalid content status`);
        if (row.lastReviewedAt !== null && (typeof row.lastReviewedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.lastReviewedAt) || Number.isNaN(new Date(`${row.lastReviewedAt}T00:00:00Z`).getTime()) || new Date(`${row.lastReviewedAt}T00:00:00Z`).toISOString().slice(0, 10) !== row.lastReviewedAt)) errors.push(`question[${index}] has an invalid review date`);
        if (row.contentStatus !== "drafted" && !row.lastReviewedAt) errors.push(`question[${index}] needs a review date for its content status`);
        if (row.contentStatus === "source-checked" && row.source && typeof row.source === "object" && row.lastReviewedAt !== (row.source as SourceReference).sourceCheckedAt) errors.push(`question[${index}] source-check and review dates must match`);
        if ((row.contentStatus === "clinically-reviewed" || row.contentStatus === "ready-for-use") && !nonEmptyString(row.clinicalReviewer)) errors.push(`question[${index}] requires a qualified clinical reviewer before this status can be used`);
        const options = row.options;
        const validOptions = Array.isArray(options) && options.length === 4 && options.every(option => Boolean(option) && typeof option === "object" && nonEmptyString(option.id) && nonEmptyString(option.text));
        if (!validOptions) errors.push(`question[${index}] must have four answer options with ids and text`);
        else {
          const optionIds = options.map(option => (option as { id: string }).id);
          const uniqueIds = new Set(optionIds);
          if (uniqueIds.size !== optionIds.length) errors.push(`question[${index}] has duplicate answer option ids`);
          const optionTexts = options.map(option => (option as { text: string }).text.trim().toLocaleLowerCase());
          if (new Set(optionTexts).size !== optionTexts.length) errors.push(`question[${index}] has duplicate answer option text`);
          if (typeof row.correctOptionId !== "string" || !uniqueIds.has(row.correctOptionId)) errors.push(`question[${index}] has no matching correct answer`);
          const distractors = row.distractorExplanations;
          const expectedDistractors = optionIds.filter(id => id !== row.correctOptionId);
          if (!distractors || typeof distractors !== "object" || Array.isArray(distractors) || expectedDistractors.some(id => !nonEmptyString((distractors as Record<string, unknown>)[id])) || Object.keys(distractors as object).some(id => !expectedDistractors.includes(id))) {
            errors.push(`question[${index}] needs an explanation for each incorrect option`);
          }
        }
        if (!nonEmptyString(row.contentType) || !nonEmptyString(row.learningObjective) || !nonEmptyString(row.learningPoint)) errors.push(`question[${index}] needs a content type, learning objective, and learning point`);
        if (!nonEmptyString(row.explanation)) errors.push(`question[${index}] needs an explanation`);
      } else {
        if (row.verificationStatus !== "source-linked-general" && row.verificationStatus !== "pathway-mapped") errors.push(`lesson[${index}] has an invalid verification status`);
        if (!Number.isInteger(row.estimatedMinutes) || Number(row.estimatedMinutes) < 1) errors.push(`lesson[${index}] needs a positive reading time`);
        if (!stringList(row.learningObjectives)) errors.push(`lesson[${index}] needs learning objectives`);
        const sectionsValid = Array.isArray(row.sections) && row.sections.length > 0 && row.sections.every(section => Boolean(section) && typeof section === "object" && nonEmptyString(section.heading) && stringList(section.paragraphs));
        if (!sectionsValid) errors.push(`lesson[${index}] needs structured sections with headings and paragraphs`);
        if (!stringList(row.takeaways)) errors.push(`lesson[${index}] needs key takeaways`);
      }
    }
  }
  const questionStems = new Map<string, string>();
  for (const [index, raw] of value.questions.entries()) {
    if (!raw || typeof raw !== "object" || !nonEmptyString((raw as Record<string, unknown>).stem)) continue;
    const stem = (raw as Record<string, unknown>).stem as string;
    const normalized = stem.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const previous = questionStems.get(normalized);
    if (previous) errors.push(`question[${index}] duplicates question stem from ${previous}`);
    else questionStems.set(normalized, (raw as Record<string, unknown>).id as string);
  }
  return errors;
}

const contentErrors = validateLibrary({ lessons, questions });
if (contentErrors.length) throw new Error(`Invalid NurseBridge starter library: ${contentErrors.join("; ")}`);

export const subjects: { id: SubjectId; name: string; description: string; color: string }[] = [
  { id: "mental-health", name: "Mental health nursing", description: "Supportive communication, safety, and person-centred care.", color: "lavender" },
  { id: "public-health", name: "Public health nursing", description: "Community assessment, diagnosis, and priority setting.", color: "mint" },
  { id: "nursing-fundamentals", name: "Nursing fundamentals", description: "Patient safety and foundational infection prevention.", color: "peach" },
  { id: "maternal-newborn", name: "Maternal & newborn care", description: "Antenatal, intrapartum, postnatal, and newborn foundations.", color: "peach" },
  { id: "medical-surgical", name: "Medical-surgical nursing", description: "Assessment, prioritisation, and safe care across adult health.", color: "blue" },
  { id: "pharmacology", name: "Medication safety", description: "Medication reconciliation, administration, and escalation.", color: "lavender" },
  { id: "community-health", name: "Community health", description: "Population assessment, surveillance, and health promotion.", color: "mint" },
  { id: "professional-practice", name: "Professional practice", description: "Communication, role boundaries, and ethical practice.", color: "blue" },
  { id: "child-health", name: "Child health", description: "Conservative foundations for family and newborn care.", color: "peach" },
  { id: "exam-revision", name: "Clinical reasoning & exam practice", description: "Question reading, evidence, and deliberate review.", color: "blue" }
];

export const contentDisclaimer = "NurseBridge provides original educational practice material. It is not official past examination content, a clinical decision tool, or a guarantee of examination results. Follow current local clinical guidance and qualified supervision.";
