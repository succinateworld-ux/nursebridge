import type { AlignmentStatus, Difficulty, Question, SourceReference, SubjectId } from "./content";
import { examPathways, type PathwayId } from "./pathways";

const reviewedAt = "2026-10-24";
const sources = {
  hygiene: { title: "Five moments for hand hygiene — implementation tools", url: "https://www.who.int/teams/integrated-health-services/infection-prevention-control/hand-hygiene/implementation-tools", publisher: "World Health Organization", sourceCheckedAt: reviewedAt },
  medication: { title: "Medication Without Harm", url: "https://www.who.int/initiatives/medication-without-harm/", publisher: "World Health Organization", sourceCheckedAt: reviewedAt },
  mentalHealth: { title: "mhGAP guideline for mental, neurological and substance use disorders", url: "https://www.who.int/publications/i/item/9789240084278", publisher: "World Health Organization", sourceCheckedAt: reviewedAt },
  communityAssessment: { title: "Community Planning: Data & Benchmarks", url: "https://www.cdc.gov/public-health-gateway/php/public-health-strategy/public-health-strategies-for-community-health-assessment-data-benchmarks.html", publisher: "U.S. Centers for Disease Control and Prevention", sourceCheckedAt: reviewedAt },
  surveillance: { title: "National Technical Guidelines for Integrated Disease Surveillance and Response, third edition", url: "https://ncdc.gov.ng/themes/common/docs/protocols/242_1601639437.pdf", publisher: "Nigeria Centre for Disease Control and Prevention; Federal Ministry of Health; WHO", sourceCheckedAt: reviewedAt },
  nphcda: { title: "NPHCDA Primary Health Care Systems and Routine Immunization", url: "https://nphcda.gov.ng/about-nphcda/", publisher: "National Primary Health Care Development Agency, Nigeria", sourceCheckedAt: reviewedAt },
  antenatal: { title: "WHO recommendations for antenatal care interventions", url: "https://www.who.int/teams/maternal-newborn-child-adolescent-health-and-ageing/handbooks/programme-manager-s-handbook-mncah/recommendations-on-interventions-along-life-course/maternal", publisher: "World Health Organization", sourceCheckedAt: reviewedAt },
  postpartum: { title: "Consolidated guidelines for the prevention, diagnosis and treatment of postpartum haemorrhage", url: "https://www.who.int/publications/i/item/9789240115637", publisher: "World Health Organization; FIGO; International Confederation of Midwives", sourceCheckedAt: reviewedAt },
  newborn: { title: "Essential newborn care", url: "https://www.who.int/teams/maternal-newborn-child-adolescent-health-and-ageing/newborn-health/essential-newborn-care", publisher: "World Health Organization", sourceCheckedAt: reviewedAt },
  ncLexRn: { title: "2026 NCLEX-RN Test Plan", url: "https://www.ncsbn.org/publications/2026-nclex-rn-test-plan", publisher: "National Council of State Boards of Nursing", sourceCheckedAt: reviewedAt },
  ncLexPn: { title: "2026 NCLEX-PN Test Plan", url: "https://www.ncsbn.org/public-files/2026_PN_Test%20Plan-F.pdf", publisher: "National Council of State Boards of Nursing", sourceCheckedAt: reviewedAt }
} satisfies Record<string, SourceReference>;

type WrongOption = { text: string; reason: string };
interface DraftQuestion {
  id: string;
  pathwayId: PathwayId;
  examTag: string;
  subject: SubjectId;
  topic: string;
  difficulty: Difficulty;
  learningObjective: string;
  learningPoint: string;
  stem: string;
  correctAt: 0 | 1 | 2 | 3;
  correct: string;
  correctReason: string;
  wrong: [WrongOption, WrongOption, WrongOption];
  source: SourceReference;
}

function createQuestion(draft: DraftQuestion): Question {
  const wrong = [...draft.wrong];
  const answerRows = Array.from({ length: 4 }, (_, index) => index === draft.correctAt
    ? { id: String.fromCharCode(97 + index), text: draft.correct }
    : { id: String.fromCharCode(97 + index), text: wrong.shift()!.text });
  const distractorExplanations: Record<string, string> = {};
  let wrongIndex = 0;
  for (const option of answerRows) {
    if (option.id !== String.fromCharCode(97 + draft.correctAt)) {
      distractorExplanations[option.id] = draft.wrong[wrongIndex++].reason;
    }
  }
  const pathway = examPathways.find(item => item.id === draft.pathwayId);
  if (!pathway) throw new Error("Unknown pathway in question " + draft.id);
  const verificationStatus: AlignmentStatus = "pathway-practice";
  return {
    id: draft.id,
    subject: draft.subject,
    topic: draft.topic,
    examTags: [draft.examTag],
    difficulty: draft.difficulty,
    contentType: "Practice question",
    questionType: "single-best-answer",
    contentStatus: "source-checked",
    lastReviewedAt: reviewedAt,
    pathwayIds: [draft.pathwayId],
    jurisdiction: pathway.jurisdiction,
    verificationStatus,
    learningObjective: draft.learningObjective,
    learningPoint: draft.learningPoint,
    stem: draft.stem,
    options: answerRows,
    correctOptionId: String.fromCharCode(97 + draft.correctAt),
    explanation: draft.correctReason,
    distractorExplanations,
    source: draft.source
  };
}

// These route tags organize original study practice. They do not assert NMCN blueprint
// alignment, NCSBN endorsement, or qualified clinical review.
const drafts: DraftQuestion[] = [
  // NMCN Registered Nurse — general pathway practice; detailed public blueprint not found.
  {
    id: "nmcn-rn-ipc-01", pathwayId: "nmcn-rn", examTag: "NMCN RN pathway practice", subject: "nursing-fundamentals", topic: "Aseptic procedure safety", difficulty: "Foundational",
    learningObjective: "Identify the WHO hand-hygiene moment before a clean or aseptic task.", learningPoint: "Hand hygiene is indicated before a clean or aseptic procedure.",
    stem: "A nurse is preparing to change a patient's dressing using an aseptic technique. Which action is indicated immediately before the procedure?",
    correctAt: 2, correct: "Perform hand hygiene before beginning the clean or aseptic task.",
    correctReason: "The WHO five-moments framework includes hand hygiene before a clean or aseptic procedure, even when gloves will be worn.",
    wrong: [
      { text: "Perform hand hygiene only after the dressing is complete.", reason: "This omits the before-procedure moment." },
      { text: "Put on gloves without hand hygiene because the gloves are sterile.", reason: "Gloves do not remove the hand-hygiene indication." },
      { text: "Wait until the patient has touched the dressing supplies.", reason: "The procedure itself creates the indication; patient contact is not required." }
    ], source: sources.hygiene
  },
  {
    id: "nmcn-rn-med-01", pathwayId: "nmcn-rn", examTag: "NMCN RN pathway practice", subject: "pharmacology", topic: "Medication reconciliation", difficulty: "Applied",
    learningObjective: "Recognize a medication-list discrepancy during a transition in care.", learningPoint: "Compare medication information and resolve discrepancies with the responsible team.",
    stem: "A patient returning from hospital has two different lists showing different doses of the same long-term medicine. What is the safest next step?",
    correctAt: 0, correct: "Compare the available records with the patient and contact the responsible prescriber or pharmacist to clarify the discrepancy.",
    correctReason: "Medication reconciliation at transitions helps identify and resolve differences before an unclear regimen is followed.",
    wrong: [
      { text: "Choose the larger dose because it is more likely to be current.", reason: "Guessing can create an unsafe medication change." },
      { text: "Tell the patient to stop all medicines until the next routine visit.", reason: "A blanket stop can interrupt needed therapy and does not resolve the discrepancy." },
      { text: "Copy both doses onto one list and let the patient decide.", reason: "The conflicting instruction remains unresolved." }
    ], source: sources.medication
  },
  {
    id: "nmcn-rn-mental-01", pathwayId: "nmcn-rn", examTag: "NMCN RN pathway practice", subject: "mental-health", topic: "Immediate safety escalation", difficulty: "Applied",
    learningObjective: "Respond to a possible immediate self-harm risk within the student's role.", learningPoint: "Stay engaged and promptly involve the qualified team using the local safety pathway.",
    stem: "During a supervised conversation, a person says they may harm themselves today. What should a student nurse do first?",
    correctAt: 3, correct: "Stay with the person, ask calmly about immediate safety, and urgently alert the supervising clinician under local policy.",
    correctReason: "A possible immediate safety risk needs direct, calm assessment and urgent escalation to the qualified care team; local protocols govern next steps.",
    wrong: [
      { text: "Promise not to tell anyone so the person will keep talking.", reason: "A safety concern cannot be managed by promising secrecy." },
      { text: "Offer reassurance that the thoughts will pass without further assessment.", reason: "Reassurance alone does not clarify immediate risk or arrange support." },
      { text: "Leave the person alone while searching for a general information leaflet.", reason: "Leaving delays qualified assessment when the person has described possible immediate harm." }
    ], source: sources.mentalHealth
  },
  {
    id: "nmcn-rn-community-01", pathwayId: "nmcn-rn", examTag: "NMCN RN pathway practice", subject: "community-health", topic: "Community assessment", difficulty: "Applied",
    learningObjective: "Interpret community health information without over-relying on service-use records.", learningPoint: "Clinic records describe service users, not everyone in a community.",
    stem: "A clinic register shows few cases of a condition in a rural catchment area. Which interpretation is most appropriate before concluding the condition is uncommon?",
    correctAt: 1, correct: "Check access barriers and compare the register with other appropriate data and community perspectives.",
    correctReason: "Service records can miss people who cannot or do not use the service; a community assessment should examine data coverage and local context.",
    wrong: [
      { text: "Treat the clinic register as a complete count of all residents.", reason: "Clinic records only include people who reached that service and were recorded." },
      { text: "Assume residents who did not attend are healthy.", reason: "Non-attendance does not establish health status." },
      { text: "Increase the case count by estimating how many people may be ill.", reason: "Unsupported estimates should not be inserted into observed data." }
    ], source: sources.communityAssessment
  },
  {
    id: "nmcn-rn-med-02", pathwayId: "nmcn-rn", examTag: "NMCN RN pathway practice", subject: "pharmacology", topic: "Medication order clarification", difficulty: "Foundational",
    learningObjective: "Avoid acting on a medication instruction that is unclear or incomplete.", learningPoint: "Pause and clarify an unclear order before administration.",
    stem: "A medication instruction is difficult to read and the intended dose is uncertain. What is the safest response?",
    correctAt: 2, correct: "Hold the administration and clarify the instruction with the authorized prescriber through local policy.",
    correctReason: "An uncertain medication direction should be clarified before it is acted on; guessing creates preventable risk.",
    wrong: [
      { text: "Select the dose most commonly used in the ward.", reason: "A customary dose is not evidence of the intended order for this patient." },
      { text: "Ask another patient what dose they take for the same medicine.", reason: "Another person's regimen cannot clarify this patient's order." },
      { text: "Administer half of the lower possible dose to be cautious.", reason: "Changing an order without authorization is still guessing." }
    ], source: sources.medication
  },
  {
    id: "nmcn-rn-mental-02", pathwayId: "nmcn-rn", examTag: "NMCN RN pathway practice", subject: "mental-health", topic: "Therapeutic communication", difficulty: "Foundational",
    learningObjective: "Use an open invitation instead of minimizing a person's concern.", learningPoint: "Invite the person to describe what matters in their own words.",
    stem: "A patient says, “I feel overwhelmed and I do not know where to start.” Which reply best opens the conversation?",
    correctAt: 0, correct: "“What has been feeling most difficult for you today?”",
    correctReason: "An open, non-judgmental prompt helps the patient describe their experience before advice is offered.",
    wrong: [
      { text: "“Try not to think about it so much.”", reason: "This minimizes the concern and gives advice before understanding it." },
      { text: "“Everyone has difficult days.”", reason: "Generalizing can make the person feel unheard." },
      { text: "“You need to explain everything before I can help.”", reason: "This can sound demanding and may impede the conversation." }
    ], source: sources.mentalHealth
  },
  {
    id: "nmcn-rn-ipc-02", pathwayId: "nmcn-rn", examTag: "NMCN RN pathway practice", subject: "nursing-fundamentals", topic: "Hand hygiene", difficulty: "Foundational",
    learningObjective: "Identify the hand-hygiene moment after body-fluid exposure risk.", learningPoint: "After body-fluid exposure risk is a distinct hand-hygiene moment.",
    stem: "After assisting with a task that involved body-fluid exposure risk, a nurse removes gloves. Which action follows the WHO moments framework?",
    correctAt: 1, correct: "Perform hand hygiene after the exposure-risk task and glove removal.",
    correctReason: "The framework includes a moment after body-fluid exposure risk; gloves do not replace hand hygiene.",
    wrong: [
      { text: "Skip hand hygiene if the gloves appear intact.", reason: "Visual appearance does not remove the indicated moment." },
      { text: "Put on a new pair of gloves before cleaning the hands.", reason: "Changing gloves is not a substitute for hand hygiene." },
      { text: "Wait until the end of the shift.", reason: "The action is needed at the relevant point in care, not hours later." }
    ], source: sources.hygiene
  },
  {
    id: "nmcn-rn-team-01", pathwayId: "nmcn-rn", examTag: "NMCN RN pathway practice", subject: "professional-practice", topic: "Safe handover", difficulty: "Applied",
    learningObjective: "Communicate information needed for continuity and safety at handover.", learningPoint: "A useful handover includes current concerns, changes, and pending care.",
    stem: "At a shift handover, which information is most useful to support safe continuity for a patient whose condition changed during the shift?",
    correctAt: 3, correct: "The change observed, actions taken, current response, and any pending follow-up.",
    correctReason: "A safety-focused handover communicates the current situation, relevant changes, and outstanding work so the next team can continue care.",
    wrong: [
      { text: "Only the patient's admission diagnosis.", reason: "The admission diagnosis alone omits the recent change and follow-up." },
      { text: "A personal impression that the patient is “difficult.”", reason: "Judgmental labels do not communicate objective care needs." },
      { text: "The full narrative of every unrelated event on the ward.", reason: "Unrelated detail can obscure the information the receiving team needs." }
    ], source: sources.medication
  },
  {
    id: "nmcn-rn-community-02", pathwayId: "nmcn-rn", examTag: "NMCN RN pathway practice", subject: "community-health", topic: "Health communication", difficulty: "Applied",
    learningObjective: "Check whether a patient understands a health instruction.", learningPoint: "Teach-back asks the learner to explain the plan in their own words.",
    stem: "After explaining a new follow-up plan, how can a nurse check whether the patient understood it?",
    correctAt: 2, correct: "Ask the patient to describe in their own words what they will do next.",
    correctReason: "An open teach-back check helps identify which parts of the explanation may need clarification.",
    wrong: [
      { text: "Ask whether the patient understands and accept a yes as proof.", reason: "A yes/no question may not reveal a misunderstanding." },
      { text: "Repeat the same technical explanation more loudly.", reason: "Repeating jargon does not check comprehension." },
      { text: "Ask a family member to answer without the patient's agreement.", reason: "This bypasses the patient and does not check their own understanding." }
    ], source: sources.communityAssessment
  },
  {
    id: "nmcn-rn-safety-01", pathwayId: "nmcn-rn", examTag: "NMCN RN pathway practice", subject: "nursing-fundamentals", topic: "Safety reporting", difficulty: "Applied",
    learningObjective: "Respond constructively to a medication near miss.", learningPoint: "Report a near miss through the facility system so the hazard can be addressed.",
    stem: "A nurse notices that a medication prepared for a patient was not administered because the label did not match the current order. What should happen next?",
    correctAt: 1, correct: "Follow the facility reporting and communication process and preserve the facts needed to review the system issue.",
    correctReason: "Near-miss reporting can identify system hazards before harm occurs; local policy defines the reporting route.",
    wrong: [
      { text: "Discard the label and say nothing because no dose was given.", reason: "The hazard may recur if it is not communicated." },
      { text: "Change the medication record to show a dose was administered.", reason: "The record must accurately reflect care; documenting an unadministered dose is unsafe." },
      { text: "Post the patient's details in a public group to warn other staff.", reason: "Public disclosure risks confidentiality and bypasses the appropriate reporting system." }
    ], source: sources.medication
  },

  // NMCN Registered Midwife — WHO guidance is global guidance, not a Nigerian protocol.
  {
    id: "nmcn-rm-anc-01", pathwayId: "nmcn-rm", examTag: "NMCN RM pathway practice", subject: "maternal-newborn", topic: "Antenatal assessment", difficulty: "Foundational",
    learningObjective: "Recognize the WHO recommendation for blood-pressure measurement during antenatal contacts.", learningPoint: "Blood pressure is checked at every antenatal contact in the WHO intervention table.",
    stem: "A midwife is planning routine antenatal checks. Which measurement does the WHO intervention table list for every contact throughout pregnancy?",
    correctAt: 0, correct: "Blood pressure.",
    correctReason: "The WHO antenatal intervention table lists blood-pressure measurement at every contact throughout pregnancy; follow current local protocols for interpretation and action.",
    wrong: [
      { text: "Blood glucose at every contact.", reason: "The cited table lists testing for gestational diabetes at a specified later pregnancy contact, not every contact." },
      { text: "Anti-D immunoglobulin at every contact.", reason: "The table describes this for eligible Rh-negative women at a specified contact, not all contacts." },
      { text: "Ultrasound estimation of gestational age at every contact.", reason: "The table lists ultrasound at an early contact, not every contact." }
    ], source: sources.antenatal
  },
  {
    id: "nmcn-rm-anc-02", pathwayId: "nmcn-rm", examTag: "NMCN RM pathway practice", subject: "maternal-newborn", topic: "Antenatal screening", difficulty: "Applied",
    learningObjective: "Identify the timing of routine infection screening in antenatal care.", learningPoint: "WHO lists HIV, syphilis, and hepatitis B screening as early as possible at the booking contact.",
    stem: "At a person's first antenatal booking contact, which approach matches the WHO intervention table for HIV, syphilis, and hepatitis B screening?",
    correctAt: 2, correct: "Offer screening as early as possible, following informed consent and the applicable local testing pathway.",
    correctReason: "The WHO table places these routine blood tests at the first contact and says they should occur as early as possible; local consent and referral requirements still apply.",
    wrong: [
      { text: "Wait until labour so the tests are closer to birth.", reason: "This delays screening beyond the early booking timing listed by WHO." },
      { text: "Order the tests only when symptoms are reported.", reason: "The cited antenatal table includes these as routine first-contact screening." },
      { text: "Use the result of one test to infer the results of the other two.", reason: "Each infection requires its own appropriate testing process." }
    ], source: sources.antenatal
  },
  {
    id: "nmcn-rm-anc-03", pathwayId: "nmcn-rm", examTag: "NMCN RM pathway practice", subject: "maternal-newborn", topic: "Birth preparedness", difficulty: "Foundational",
    learningObjective: "Recognize that birth and emergency preparedness is discussed during antenatal care.", learningPoint: "Birth preparedness is a continuing antenatal conversation, not a last-minute handout.",
    stem: "Which plan best reflects the WHO antenatal recommendation for birth and emergency preparedness?",
    correctAt: 3, correct: "Discuss preparedness during antenatal contacts and revisit the plan as the pregnancy progresses.",
    correctReason: "WHO lists birth and emergency preparedness counselling during antenatal care, beginning from later contacts; local referral arrangements should be included.",
    wrong: [
      { text: "Discuss it only after labour has started.", reason: "That misses the antenatal preparation period." },
      { text: "Provide a generic leaflet without checking access or questions.", reason: "A leaflet alone does not establish an understood, usable plan." },
      { text: "Avoid discussing emergencies because it may cause worry.", reason: "Clear, supportive preparation can help people know where to seek care." }
    ], source: sources.antenatal
  },
  {
    id: "nmcn-rm-anc-04", pathwayId: "nmcn-rm", examTag: "NMCN RM pathway practice", subject: "maternal-newborn", topic: "Antenatal nutrition", difficulty: "Foundational",
    learningObjective: "Identify the broad WHO antenatal recommendation for iron and folic acid.", learningPoint: "WHO recommends daily oral iron and folic acid during pregnancy; individual care follows local guidance.",
    stem: "A pregnant client asks whether iron and folic acid are addressed in WHO antenatal guidance. Which reply is most accurate at a general education level?",
    correctAt: 1, correct: "WHO recommends daily oral iron and folic acid supplementation during pregnancy; the individual's regimen should follow local guidance and assessment.",
    correctReason: "WHO antenatal recommendations include daily oral iron and folic acid. A learner should not independently prescribe or adjust a patient's regimen.",
    wrong: [
      { text: "They are recommended only during labour.", reason: "That timing does not match WHO's antenatal recommendation." },
      { text: "They should be stopped for every client after the first trimester.", reason: "This contradicts the broad WHO recommendation for supplementation during pregnancy." },
      { text: "The same supplement plan is appropriate for every person regardless of assessment.", reason: "Individual care and local guidance still matter." }
    ], source: sources.antenatal
  },
  {
    id: "nmcn-rm-labour-01", pathwayId: "nmcn-rm", examTag: "NMCN RM pathway practice", subject: "maternal-newborn", topic: "Support in labour", difficulty: "Foundational",
    learningObjective: "Recognize continuous support as a recommended part of respectful labour care.", learningPoint: "Continuous support during labour is recommended across stages in the WHO table.",
    stem: "A woman in labour asks whether her chosen support person can remain with her. What response best reflects WHO intrapartum-care recommendations, subject to local policy and safety?",
    correctAt: 2, correct: "Support continuous companionship during labour and explain any local arrangements that apply.",
    correctReason: "WHO lists continuous support for the woman during all stages of labour; local service arrangements should be explained respectfully.",
    wrong: [
      { text: "Allow support only during the first stage.", reason: "WHO lists continuous support across all stages." },
      { text: "Refuse because support people never have a role in labour care.", reason: "This conflicts with the WHO recommendation for continuous support." },
      { text: "Allow support only if the person agrees with every clinical decision.", reason: "Companionship is not a substitute for consent or the woman's own decisions." }
    ], source: sources.antenatal
  },
  {
    id: "nmcn-rm-newborn-01", pathwayId: "nmcn-rm", examTag: "NMCN RM pathway practice", subject: "maternal-newborn", topic: "Essential newborn care", difficulty: "Applied",
    learningObjective: "Select routine thermal and bonding care for a stable newborn.", learningPoint: "For a newborn without complications, drying and skin-to-skin care support warmth and early feeding.",
    stem: "A newborn has no complication requiring separation. Which immediate-care approach is consistent with WHO essential newborn care?",
    correctAt: 0, correct: "Dry the newborn, support skin-to-skin contact, keep the baby warm, and assist early breastfeeding when both are ready.",
    correctReason: "WHO essential newborn care includes thorough drying, thermal care, skin-to-skin contact, assessment, and support for early breastfeeding when clinically appropriate.",
    wrong: [
      { text: "Bathe the newborn immediately and leave the baby uncovered for observation.", reason: "This can increase heat loss and omits the listed routine thermal-care measures." },
      { text: "Separate every newborn from the mother until the first routine visit.", reason: "Routine separation is not the WHO approach for a newborn without complications." },
      { text: "Delay assessment of breathing until after feeding.", reason: "Assessment of breathing is part of immediate newborn care." }
    ], source: sources.newborn
  },
  {
    id: "nmcn-rm-newborn-02", pathwayId: "nmcn-rm", examTag: "NMCN RM pathway practice", subject: "maternal-newborn", topic: "Cord care", difficulty: "Foundational",
    learningObjective: "Recognize the WHO recommendation for delayed cord clamping in routine birth care.", learningPoint: "WHO describes delayed cord clamping at about 1–3 minutes while essential newborn care begins.",
    stem: "A vigorous newborn and mother are stable after birth. Which cord-clamping timing matches the WHO newborn-care recommendation?",
    correctAt: 3, correct: "Delay clamping for approximately 1–3 minutes while initiating essential newborn care, unless clinical circumstances require otherwise.",
    correctReason: "WHO recommends delayed cord clamping after 1–3 minutes for routine births while essential newborn care begins; immediate clinical needs take priority.",
    wrong: [
      { text: "Clamp immediately in every birth before assessing the newborn.", reason: "This does not reflect routine delayed-clamping guidance." },
      { text: "Wait several hours before clamping in every birth.", reason: "That timing is not the WHO recommendation cited here." },
      { text: "Use the same delay even when an urgent clinical intervention requires a different sequence.", reason: "Clinical condition and local protocols can require a different immediate response." }
    ], source: sources.newborn
  },
  {
    id: "nmcn-rm-pph-01", pathwayId: "nmcn-rm", examTag: "NMCN RM pathway practice", subject: "maternal-newborn", topic: "Postpartum haemorrhage recognition", difficulty: "Advanced",
    learningObjective: "Recognize the 2025 WHO early-response threshold for postpartum bleeding with abnormal observations.", learningPoint: "WHO advises action at 300 mL with abnormal vital signs, or at 500 mL, with clinical judgement also considered.",
    stem: "After birth, measured blood loss is 350 mL and the woman's observations are abnormal. What is the safest response in a facility using the 2025 WHO guidance?",
    correctAt: 1, correct: "Activate the facility's postpartum-haemorrhage response and escalate promptly; do not wait for a 500 mL threshold.",
    correctReason: "The 2025 WHO consolidated guidance supports prompt action at 300 mL when accompanied by abnormal vital signs, as well as at 500 mL or when clinical judgement indicates.",
    wrong: [
      { text: "Continue routine observation until blood loss reaches 500 mL.", reason: "This delays response despite the lower threshold combined with abnormal observations." },
      { text: "Wait for a second abnormal observation before alerting the team.", reason: "The described combination already meets the early-response threshold in the cited guidance." },
      { text: "Manage the situation alone without activating local support.", reason: "The guidance emphasizes prompt response and escalation; local emergency procedures apply." }
    ], source: sources.postpartum
  },
  {
    id: "nmcn-rm-postnatal-01", pathwayId: "nmcn-rm", examTag: "NMCN RM pathway practice", subject: "maternal-newborn", topic: "Immediate postnatal assessment", difficulty: "Applied",
    learningObjective: "Recognize key maternal observations in the first postnatal day.", learningPoint: "Early postnatal care includes vital signs, uterine involution, vaginal bleeding, and danger-sign assessment.",
    stem: "During the first postnatal day, which assessment set best matches the WHO postnatal-care table?",
    correctAt: 2, correct: "Assess maternal vital signs, uterine involution, vaginal bleeding, and signs of postpartum haemorrhage or infection.",
    correctReason: "WHO lists these physical checks within the first postnatal visit and recommends counselling about danger signs.",
    wrong: [
      { text: "Assess only the newborn and postpone maternal checks until six weeks.", reason: "WHO includes maternal assessment within 24 hours after birth." },
      { text: "Record only whether the mother reports pain.", reason: "Pain alone does not replace checks for bleeding, uterine involution, vital signs, and infection." },
      { text: "Avoid asking about bleeding if the mother appears comfortable.", reason: "Appearance alone does not replace objective assessment and monitoring." }
    ], source: sources.antenatal
  },
  {
    id: "nmcn-rm-postnatal-02", pathwayId: "nmcn-rm", examTag: "NMCN RM pathway practice", subject: "maternal-newborn", topic: "Postnatal mental wellbeing", difficulty: "Applied",
    learningObjective: "Plan follow-up that includes maternal emotional wellbeing.", learningPoint: "WHO includes maternal mood and depression screening in postnatal follow-up contacts.",
    stem: "A midwife is reviewing a postnatal follow-up plan. Which item should be included alongside physical recovery checks?",
    correctAt: 0, correct: "A supportive check of the mother's mood and emotional wellbeing, with an appropriate referral route if concerns arise.",
    correctReason: "WHO's postnatal-care recommendations include screening for postpartum depression and assessing emotional wellbeing during follow-up.",
    wrong: [
      { text: "Assume that emotional distress is expected and does not need discussion.", reason: "This can miss concerns and does not follow the recommendation to assess wellbeing." },
      { text: "Ask only whether the mother is sleeping through the night.", reason: "One symptom does not replace a broader, appropriate assessment." },
      { text: "Diagnose a mental-health condition from one screening question.", reason: "Screening is not a diagnosis; concerns require appropriate assessment and referral." }
    ], source: sources.antenatal
  },

  // NMCN RPHN — Nigeria-specific surveillance and PHC references are used where available.
  {
    id: "nmcn-rphn-assessment-01", pathwayId: "nmcn-rphn", examTag: "NMCN RPHN pathway practice", subject: "community-health", topic: "Community diagnosis", difficulty: "Applied",
    learningObjective: "Build a community profile from multiple data sources and resident perspectives.", learningPoint: "Use health data, community knowledge, and assets; check who is missing from each source.",
    stem: "A team is preparing a community diagnosis for a local government area. Which approach provides the soundest starting evidence?",
    correctAt: 1, correct: "Combine appropriate population data, service information, community perspectives, and existing local assets.",
    correctReason: "A community health assessment combines evidence sources and community knowledge, while checking limitations and representation.",
    wrong: [
      { text: "Use one facility register as the complete picture of the population.", reason: "Facility records can omit people who do not access that facility." },
      { text: "Select a programme first and collect only data that supports it.", reason: "This risks confirmation bias and a poor fit to community priorities." },
      { text: "Ask a single leader to speak for all groups and age ranges.", reason: "One informant cannot establish that all community perspectives are represented." }
    ], source: sources.communityAssessment
  },
  {
    id: "nmcn-rphn-surv-01", pathwayId: "nmcn-rphn", examTag: "NMCN RPHN pathway practice", subject: "public-health", topic: "Public health surveillance", difficulty: "Foundational",
    learningObjective: "Distinguish ongoing surveillance from a one-time survey.", learningPoint: "Surveillance is systematic, ongoing, interpreted, shared, and linked to public-health action.",
    stem: "Which activity best fits the core idea of public-health surveillance?",
    correctAt: 3, correct: "Ongoing systematic collection, analysis, interpretation, and communication of health information for action.",
    correctReason: "The cited surveillance framework describes an ongoing, systematic process that connects analyzed information to public-health action.",
    wrong: [
      { text: "A one-time survey whose results are filed without interpretation.", reason: "This lacks ongoing surveillance and the link to action." },
      { text: "A list of clinic visitors with no defined health question.", reason: "A raw list is not a systematic surveillance process." },
      { text: "A public rumour repeated without verification or documentation.", reason: "Unverified information should be assessed through the appropriate event-based pathway." }
    ], source: sources.surveillance
  },
  {
    id: "nmcn-rphn-idr-01", pathwayId: "nmcn-rphn", examTag: "NMCN RPHN pathway practice", subject: "community-health", topic: "Event-based surveillance", difficulty: "Applied",
    learningObjective: "Respond appropriately to a community report of a possible unusual health event.", learningPoint: "Record and verify a signal through Nigeria's IDSR pathway before drawing conclusions.",
    stem: "A community informant reports several people with a similar unusual illness. What is the most appropriate initial public-health response?",
    correctAt: 0, correct: "Document the report and promptly notify the designated surveillance contact using the local IDSR process for verification and follow-up.",
    correctReason: "Nigeria's IDSR guidance includes event-based and community-based surveillance; reports should be handled through the designated verification and response pathway.",
    wrong: [
      { text: "Post the names and suspected diagnosis of affected people on social media.", reason: "This can breach privacy and spread unverified information." },
      { text: "Wait for a laboratory result before alerting any surveillance contact.", reason: "An unusual event signal can require prompt reporting and verification under local procedures." },
      { text: "Announce a confirmed outbreak before the event is assessed.", reason: "A report is a signal to verify, not proof of an outbreak." }
    ], source: sources.surveillance
  },
  {
    id: "nmcn-rphn-data-01", pathwayId: "nmcn-rphn", examTag: "NMCN RPHN pathway practice", subject: "public-health", topic: "Data quality", difficulty: "Applied",
    learningObjective: "Check reporting completeness and consistency before interpreting trends.", learningPoint: "A changing reporting process can look like a disease trend.",
    stem: "A district's reported cases increase sharply in the same month that several facilities begin reporting for the first time. What should an analyst check before attributing the rise to increased disease?",
    correctAt: 2, correct: "Whether reporting coverage, case definitions, and data completeness changed during that period.",
    correctReason: "Surveillance interpretation depends on how data were collected and reported; a coverage change can alter counts without the same change in disease occurrence.",
    wrong: [
      { text: "Assume that every increase in a report count is a true outbreak.", reason: "Counts need interpretation in light of reporting and case-definition changes." },
      { text: "Remove the new facilities' reports so the old trend looks stable.", reason: "Excluding valid data to preserve a trend can bias the analysis." },
      { text: "Compare only the total count and ignore the reporting denominator.", reason: "The number of reporting sites and completeness affect interpretation." }
    ], source: sources.surveillance
  },
  {
    id: "nmcn-rphn-case-01", pathwayId: "nmcn-rphn", examTag: "NMCN RPHN pathway practice", subject: "community-health", topic: "Standard case definitions", difficulty: "Applied",
    learningObjective: "Use the current standard case definition when classifying reports.", learningPoint: "Consistent case definitions make surveillance reports more comparable.",
    stem: "Two facilities classify a suspected priority disease using different symptom thresholds. What should the surveillance team do?",
    correctAt: 1, correct: "Refer both facilities to the current national standard case definition and clarify how it should be applied.",
    correctReason: "Nigeria's IDSR guidance provides standard case definitions so reports can be classified consistently; the current national guidance should be followed.",
    wrong: [
      { text: "Allow each facility to keep its own definition to preserve autonomy.", reason: "Different definitions undermine comparability and can distort trends." },
      { text: "Average the two thresholds and create a new district definition.", reason: "A local average is not a substitute for the current national case definition." },
      { text: "Classify every report as confirmed to avoid missing cases.", reason: "A suspected classification should not be mislabeled as confirmed." }
    ], source: sources.surveillance
  },
  {
    id: "nmcn-rphn-immunization-01", pathwayId: "nmcn-rphn", examTag: "NMCN RPHN pathway practice", subject: "community-health", topic: "Immunization outreach planning", difficulty: "Applied",
    learningObjective: "Use routine-immunization gap data to plan community outreach.", learningPoint: "Outreach plans should use local gap data and improve access rather than assume families are unwilling.",
    stem: "Routine-immunization records show that some wards have lower service reach than others. What is the best next planning step?",
    correctAt: 3, correct: "Review local access and data-quality barriers with the community and plan targeted fixed or outreach services through the PHC team.",
    correctReason: "NPHCDA describes routine-immunization coordination that uses data visibility and action, and supports increased fixed and outreach services where gaps exist.",
    wrong: [
      { text: "Repeat the same clinic schedule in every ward without reviewing access.", reason: "Uniform scheduling may not address local barriers or the documented gap." },
      { text: "Assume caregivers are uninterested and stop follow-up.", reason: "That conclusion is unsupported and does not improve access." },
      { text: "Change the national vaccine schedule based on one ward's record.", reason: "Schedule changes must follow national guidance, not local improvisation." }
    ], source: sources.nphcda
  },
  {
    id: "nmcn-rphn-community-01", pathwayId: "nmcn-rphn", examTag: "NMCN RPHN pathway practice", subject: "community-health", topic: "Community participation", difficulty: "Applied",
    learningObjective: "Include affected groups in priority setting and programme planning.", learningPoint: "Community participation improves the relevance and legitimacy of local priorities.",
    stem: "A community team is choosing between two feasible health-promotion priorities. Which process is most defensible?",
    correctAt: 2, correct: "Share the evidence and criteria, invite affected groups to contribute, and document how the priority was chosen.",
    correctReason: "Transparent criteria and community perspectives support a relevant, accountable community health assessment and plan.",
    wrong: [
      { text: "Let the outside team choose the topic it already has materials for.", reason: "Convenience alone does not establish community priority." },
      { text: "Ask only the most influential household to select for everyone.", reason: "One household cannot represent the community's diverse needs." },
      { text: "Choose the issue with the strongest anecdote and skip the other information.", reason: "An anecdote may be important but should be considered alongside broader evidence and community input." }
    ], source: sources.communityAssessment
  },
  {
    id: "nmcn-rphn-eval-01", pathwayId: "nmcn-rphn", examTag: "NMCN RPHN pathway practice", subject: "public-health", topic: "Programme evaluation", difficulty: "Applied",
    learningObjective: "Select an indicator that measures whether a community intervention reached its intended group.", learningPoint: "Choose an indicator tied to the intervention's objective and population.",
    stem: "A team runs an outreach session intended to improve access for an underserved ward. Which measure best helps evaluate whether the outreach reached its intended group?",
    correctAt: 1, correct: "The proportion of the target group in that ward who received the intended service during the evaluation period.",
    correctReason: "An indicator should relate to the programme objective and intended population; attendance at an event alone does not demonstrate service reach.",
    wrong: [
      { text: "The number of posters printed for all wards.", reason: "Poster volume does not show whether the intended group received the service." },
      { text: "The number of staff assigned, regardless of service delivered.", reason: "Staffing is an input measure, not a direct measure of target-group reach." },
      { text: "The number of people who attended an unrelated clinic.", reason: "That count is not linked to the intervention's target population or outcome." }
    ], source: sources.nphcda
  },
  {
    id: "nmcn-rphn-phc-01", pathwayId: "nmcn-rphn", examTag: "NMCN RPHN pathway practice", subject: "community-health", topic: "Primary health-care coordination", difficulty: "Foundational",
    learningObjective: "Recognize community co-management as part of people-oriented PHC systems.", learningPoint: "PHC planning includes community participation and coordination with local structures.",
    stem: "A PHC team is revising its outreach plan. Which approach best fits NPHCDA's description of people-oriented PHC development?",
    correctAt: 0, correct: "Coordinate with community structures and use local information to plan accessible services with available resources.",
    correctReason: "NPHCDA describes people-oriented PHC with community co-management and optimal use of available resources.",
    wrong: [
      { text: "Design the plan without local input and announce it only after rollout.", reason: "This omits community co-management and may miss access barriers." },
      { text: "Use all resources for the most visible health issue without reviewing need.", reason: "Resource use should be informed by need and local planning." },
      { text: "Replace routine services with one campaign regardless of continuity.", reason: "A campaign alone may not sustain ongoing PHC access." }
    ], source: sources.nphcda
  },
  {
    id: "nmcn-rphn-communication-01", pathwayId: "nmcn-rphn", examTag: "NMCN RPHN pathway practice", subject: "public-health", topic: "Risk communication", difficulty: "Applied",
    learningObjective: "Communicate a developing public-health signal without overstating certainty.", learningPoint: "Explain what is known, what is being checked, and where verified updates will come from.",
    stem: "Community members ask about an unverified report of a possible disease cluster. Which response best supports responsible communication?",
    correctAt: 3, correct: "Acknowledge the concern, explain that the report is being verified, and direct people to the designated public-health updates and care pathway.",
    correctReason: "Clear communication can address concern without presenting a signal as a confirmed outbreak; Nigeria's IDSR includes event verification and information sharing.",
    wrong: [
      { text: "Share the unverified report as confirmed so residents will take it seriously.", reason: "That can spread misinformation and undermine trust." },
      { text: "Refuse to answer any questions until the investigation is closed.", reason: "Silence can leave a vacuum; communicate uncertainty and verified updates appropriately." },
      { text: "Promise that no risk exists before verification is complete.", reason: "That overstates what is known." }
    ], source: sources.surveillance
  },

  // NCLEX pathways are study groupings only. These items are not NCSBN-approved or blueprint-mapped.
  {
    id: "nclex-rn-clinical-01", pathwayId: "nclex-rn", examTag: "NCLEX-RN pathway practice", subject: "medical-surgical", topic: "Recognizing acute change", difficulty: "Applied",
    learningObjective: "Prioritize a new acute change over a stable, ongoing concern.", learningPoint: "A sudden change in breathing or circulation warrants immediate assessment and escalation.",
    stem: "At the start of a shift, which patient should the registered nurse assess first?",
    correctAt: 2, correct: "A patient with new severe breathlessness and a falling oxygen reading.",
    correctReason: "A new respiratory change can signal immediate deterioration and needs prompt assessment and escalation according to local emergency procedures.",
    wrong: [
      { text: "A patient requesting a routine update about tomorrow's discharge.", reason: "The request is important but does not describe an acute threat." },
      { text: "A patient with unchanged chronic joint pain asking for the scheduled comfort measure.", reason: "Address the need promptly, but the described condition is stable." },
      { text: "A patient whose meal tray is late.", reason: "This concern does not take priority over a new breathing problem." }
    ], source: sources.ncLexRn
  },
  {
    id: "nclex-rn-med-01", pathwayId: "nclex-rn", examTag: "NCLEX-RN pathway practice", subject: "pharmacology", topic: "Medication safety", difficulty: "Applied",
    learningObjective: "Respond safely to a medication discrepancy before administration.", learningPoint: "Stop and clarify a mismatch rather than choosing an option by assumption.",
    stem: "The medication label does not match the current electronic order. What should the nurse do before administering the medication?",
    correctAt: 0, correct: "Pause the administration and resolve the discrepancy with the authorized source using facility policy.",
    correctReason: "Medication-safety guidance emphasizes reducing risk across prescribing, dispensing, administration, and monitoring; a mismatch should be resolved before proceeding.",
    wrong: [
      { text: "Use whichever instruction was entered most recently without confirming it.", reason: "A timestamp alone does not establish that the conflicting information is correct." },
      { text: "Ask the patient to choose which dose sounds familiar.", reason: "The patient may not know the current order, and the discrepancy remains." },
      { text: "Administer both listed doses at half strength.", reason: "Combining conflicting instructions creates a new, unauthorized regimen." }
    ], source: sources.medication
  },
  {
    id: "nclex-rn-ipc-01", pathwayId: "nclex-rn", examTag: "NCLEX-RN pathway practice", subject: "nursing-fundamentals", topic: "Infection prevention", difficulty: "Foundational",
    learningObjective: "Apply hand hygiene after touching a patient's environment.", learningPoint: "The patient's surroundings count even when the patient is not touched.",
    stem: "A nurse adjusts a bedside table and then leaves the room without touching the patient. Which hand-hygiene moment applies?",
    correctAt: 3, correct: "After touching patient surroundings.",
    correctReason: "The WHO five moments include hand hygiene after contact with a patient's surroundings, even without direct patient contact.",
    wrong: [
      { text: "Before touching a patient only.", reason: "The nurse has already touched the surroundings; the moment described is after environmental contact." },
      { text: "Only before a sterile procedure.", reason: "No clean or aseptic procedure is described." },
      { text: "No moment applies until the next patient is touched.", reason: "WHO includes the patient environment as a hand-hygiene moment." }
    ], source: sources.hygiene
  },
  {
    id: "nclex-rn-mental-01", pathwayId: "nclex-rn", examTag: "NCLEX-RN pathway practice", subject: "mental-health", topic: "Therapeutic communication", difficulty: "Applied",
    learningObjective: "Respond to a patient's distress with an open, non-judgmental prompt.", learningPoint: "Acknowledge the concern and invite the patient to describe it.",
    stem: "A patient says, “I am frightened about what the diagnosis might mean.” Which response is most therapeutic?",
    correctAt: 1, correct: "“What worries you most right now?”",
    correctReason: "An open invitation recognizes the emotion and helps the patient share their concern without minimizing it.",
    wrong: [
      { text: "“There is no reason to be frightened until the test results arrive.”", reason: "This dismisses the patient's present emotion." },
      { text: "“Try to stop thinking about it.”", reason: "This gives advice without exploring the concern." },
      { text: "“I know exactly how you feel.”", reason: "The nurse cannot assume the patient's experience is identical to their own." }
    ], source: sources.mentalHealth
  },
  {
    id: "nclex-rn-anc-01", pathwayId: "nclex-rn", examTag: "NCLEX-RN pathway practice", subject: "maternal-newborn", topic: "Antenatal care", difficulty: "Foundational",
    learningObjective: "Identify routine antenatal monitoring listed in WHO guidance.", learningPoint: "WHO lists blood-pressure measurement at each antenatal contact.",
    stem: "A nurse is reviewing a routine antenatal visit checklist. Which measurement does WHO list at every contact throughout pregnancy?",
    correctAt: 0, correct: "Blood pressure.",
    correctReason: "WHO's antenatal intervention table lists blood-pressure measurement at every contact; local practice guides thresholds and follow-up.",
    wrong: [
      { text: "Gestational-diabetes testing at every contact.", reason: "The WHO table lists this at a later pregnancy interval, not every contact." },
      { text: "Ultrasound at every contact.", reason: "The table lists ultrasound for early dating, not every contact." },
      { text: "Anti-D immunoglobulin for every pregnant client at every visit.", reason: "This is not a universal every-contact measurement or intervention." }
    ], source: sources.antenatal
  },
  {
    id: "nclex-rn-medrec-01", pathwayId: "nclex-rn", examTag: "NCLEX-RN pathway practice", subject: "pharmacology", topic: "Care transitions", difficulty: "Applied",
    learningObjective: "Resolve conflicting medication information during a transition of care.", learningPoint: "Reconciliation is an active comparison and clarification process.",
    stem: "A patient says the home medication list differs from the discharge list. Which action best supports safe continuity?",
    correctAt: 2, correct: "Compare both lists with the patient and care record, then clarify unresolved differences with the responsible clinician or pharmacist.",
    correctReason: "Medication reconciliation is intended to identify and resolve discrepancies during transitions rather than simply copy a list.",
    wrong: [
      { text: "Tell the patient to follow whichever list is shorter.", reason: "List length does not determine clinical correctness." },
      { text: "Discard the home list because discharge instructions always contain every current medicine.", reason: "The discrepancy should be reviewed, not assumed away." },
      { text: "Combine both lists and instruct the patient to take every item.", reason: "Combining lists without resolving differences can lead to duplication or harm." }
    ], source: sources.medication
  },
  {
    id: "nclex-rn-newborn-01", pathwayId: "nclex-rn", examTag: "NCLEX-RN pathway practice", subject: "child-health", topic: "Newborn thermal care", difficulty: "Applied",
    learningObjective: "Select routine thermal care for a stable newborn.", learningPoint: "Drying and skin-to-skin contact are part of essential newborn care.",
    stem: "A stable newborn is placed on the mother's chest after birth. Which action supports essential newborn care?",
    correctAt: 1, correct: "Dry the newborn, maintain warmth, and support skin-to-skin contact while assessing breathing.",
    correctReason: "WHO essential newborn care includes thorough drying, thermal care, skin-to-skin contact, and assessment of breathing.",
    wrong: [
      { text: "Delay assessment of breathing until the first feeding is complete.", reason: "Breathing assessment is part of immediate care." },
      { text: "Bathe the newborn at once to remove all vernix.", reason: "Immediate bathing can interrupt warmth and skin-to-skin care." },
      { text: "Leave the newborn uncovered so the nurse can observe the skin.", reason: "Thermal protection is a core part of routine newborn care." }
    ], source: sources.newborn
  },
  {
    id: "nclex-rn-safety-01", pathwayId: "nclex-rn", examTag: "NCLEX-RN pathway practice", subject: "professional-practice", topic: "Safety event communication", difficulty: "Applied",
    learningObjective: "Use transparent, policy-based communication after a safety event.", learningPoint: "Document accurately and follow the organization's disclosure and reporting process.",
    stem: "A patient received a medication later than scheduled and asks whether this matters. What is the nurse's best response?",
    correctAt: 3, correct: "Give an honest, factual response within the nurse's role, assess for effects, and follow facility reporting and disclosure policy.",
    correctReason: "Safe care includes assessment, accurate documentation, and appropriate communication and reporting rather than concealment or speculation.",
    wrong: [
      { text: "Say the medicine was given on time to avoid worry.", reason: "This is inaccurate and undermines trust and safety review." },
      { text: "Promise that there can be no effect without checking the medication or the patient.", reason: "That assurance is unsupported." },
      { text: "Tell the patient to file a complaint before the nurse will respond.", reason: "This avoids the immediate need to answer honestly and assess the patient." }
    ], source: sources.medication
  },
  {
    id: "nclex-rn-cues-01", pathwayId: "nclex-rn", examTag: "NCLEX-RN pathway practice", subject: "medical-surgical", topic: "Clinical cue recognition", difficulty: "Advanced",
    learningObjective: "Interpret a new change in the context of a patient's baseline.", learningPoint: "A new deviation from baseline can be more meaningful than one isolated number.",
    stem: "A patient's blood pressure is near their documented baseline, but they have become newly difficult to rouse. What should the nurse do?",
    correctAt: 0, correct: "Assess the patient promptly, gather relevant cues, and escalate the acute change according to local procedures.",
    correctReason: "A new change in responsiveness is a clinically important cue even when one measurement appears near baseline; prompt assessment and escalation are appropriate.",
    wrong: [
      { text: "Wait until the next scheduled round because the blood pressure is near baseline.", reason: "One near-baseline measurement does not explain a new change in responsiveness." },
      { text: "Assume the patient is sleeping and document without assessment.", reason: "This labels the change without checking the patient's condition." },
      { text: "Give a sedating medication to help the patient rest.", reason: "This could worsen or obscure an unexplained change." }
    ], source: sources.ncLexRn
  },
  {
    id: "nclex-rn-referral-01", pathwayId: "nclex-rn", examTag: "NCLEX-RN pathway practice", subject: "professional-practice", topic: "Care coordination", difficulty: "Applied",
    learningObjective: "Coordinate follow-up when a patient cannot access a planned service.", learningPoint: "A plan should account for practical barriers and connect the patient to an appropriate alternative.",
    stem: "A patient says they cannot travel to the follow-up clinic arranged for next week. What is the nurse's best next step?",
    correctAt: 2, correct: "Explore the barrier with the patient and coordinate an appropriate alternative or referral with the care team.",
    correctReason: "Care coordination should address access barriers and support a feasible follow-up plan with the patient and responsible team.",
    wrong: [
      { text: "Mark the patient as noncompliant and close the referral.", reason: "This labels the patient without exploring the access barrier." },
      { text: "Tell the patient to attend regardless of the barrier.", reason: "This does not create a feasible plan." },
      { text: "Change the appointment without checking what the patient can access.", reason: "A different date alone may not resolve the barrier." }
    ], source: sources.ncLexRn
  },

  // NCLEX-PN items emphasize observing, communicating, and safe action within local scope.
  {
    id: "nclex-pn-change-01", pathwayId: "nclex-pn", examTag: "NCLEX-PN pathway practice", subject: "professional-practice", topic: "Recognizing change", difficulty: "Applied",
    learningObjective: "Respond promptly to a new patient change within assigned responsibilities.", learningPoint: "Observe, take immediate safe steps, and report a significant change promptly.",
    stem: "A practical-nursing student notes that a patient is suddenly less responsive than earlier. What is the safest next action?",
    correctAt: 1, correct: "Stay with the patient, obtain immediate assistance, and report the change promptly through the supervising nurse or emergency process.",
    correctReason: "A sudden change in responsiveness needs immediate attention; the learner should act within training and local supervision arrangements.",
    wrong: [
      { text: "Wait for the next scheduled observation round.", reason: "This delays assessment of an acute change." },
      { text: "Assume the patient is tired because they were awake earlier.", reason: "An assumption does not assess or address the change." },
      { text: "Leave the patient alone to search for the chart before calling anyone.", reason: "The priority is to maintain safety and get assistance." }
    ], source: sources.ncLexPn
  },
  {
    id: "nclex-pn-med-01", pathwayId: "nclex-pn", examTag: "NCLEX-PN pathway practice", subject: "pharmacology", topic: "Medication order safety", difficulty: "Foundational",
    learningObjective: "Seek clarification when a medication instruction is incomplete.", learningPoint: "Do not fill in a missing medication detail by guessing.",
    stem: "A medication instruction lacks a route, and the route cannot be confirmed in the record. What should the practical nurse do?",
    correctAt: 3, correct: "Pause and obtain clarification from the authorized clinician according to local policy before administration.",
    correctReason: "An incomplete direction should be clarified before use; the nurse should not infer a missing medication detail.",
    wrong: [
      { text: "Use the route listed for another patient taking the same medicine.", reason: "Another patient's order does not establish this patient's route." },
      { text: "Choose the route that is easiest to administer.", reason: "Convenience does not establish the prescribed route." },
      { text: "Ask the patient to choose a route.", reason: "The route is part of the authorized medication direction, not a preference to guess." }
    ], source: sources.medication
  },
  {
    id: "nclex-pn-ipc-01", pathwayId: "nclex-pn", examTag: "NCLEX-PN pathway practice", subject: "nursing-fundamentals", topic: "Hand hygiene", difficulty: "Foundational",
    learningObjective: "Apply hand hygiene before contact with a patient.", learningPoint: "Perform hand hygiene before touching a patient, even when routine care is planned.",
    stem: "A practical nurse enters a room to take a patient's routine observations. Which action follows the WHO five-moments framework before patient contact?",
    correctAt: 0, correct: "Perform hand hygiene before touching the patient.",
    correctReason: "The first WHO moment is before touching a patient.",
    wrong: [
      { text: "Wear gloves instead of performing hand hygiene.", reason: "Gloves do not replace the indicated hand-hygiene moment." },
      { text: "Wait until after the observations are recorded.", reason: "That is after patient contact and misses the before-contact moment." },
      { text: "Clean hands only if the patient appears unwell.", reason: "The moment applies regardless of visible illness." }
    ], source: sources.hygiene
  },
  {
    id: "nclex-pn-team-01", pathwayId: "nclex-pn", examTag: "NCLEX-PN pathway practice", subject: "professional-practice", topic: "Reporting findings", difficulty: "Applied",
    learningObjective: "Communicate new objective findings promptly to the supervising team.", learningPoint: "Report what was observed, when it changed, and what action was taken.",
    stem: "During routine care, a practical nurse observes that a patient's breathing has become more laboured. Which handoff is most useful?",
    correctAt: 2, correct: "Promptly report the observed change, relevant measurements, timing, and immediate actions to the responsible nurse.",
    correctReason: "Timely, objective communication helps the responsible team assess a developing change and decide next steps.",
    wrong: [
      { text: "Wait until the end of the shift so the report is complete.", reason: "A new breathing change may require timely assessment." },
      { text: "Report only that the patient “looks bad.”", reason: "This lacks specific observed information." },
      { text: "Tell the patient to mention it during the next routine appointment.", reason: "The patient is currently in care and the change should be reported to the team." }
    ], source: sources.ncLexPn
  },
  {
    id: "nclex-pn-med-02", pathwayId: "nclex-pn", examTag: "NCLEX-PN pathway practice", subject: "pharmacology", topic: "Adverse-effect response", difficulty: "Applied",
    learningObjective: "Escalate a possible medication-related change without independently altering the regimen.", learningPoint: "Assess and report a concerning change; follow authorized directions for any medication adjustment.",
    stem: "A patient reports a new concerning symptom shortly after a medication dose. What should the practical nurse do?",
    correctAt: 1, correct: "Assess the patient within training, report the timing and symptom promptly, and follow the authorized clinical direction.",
    correctReason: "Medication safety includes monitoring and communication; treatment changes should follow authorized clinical direction and local scope.",
    wrong: [
      { text: "Tell the patient to take an extra dose to see whether the symptom improves.", reason: "An extra dose is an unsafe, unauthorized experiment." },
      { text: "Stop every medication permanently without notifying the care team.", reason: "This makes an independent treatment change and may cause additional harm." },
      { text: "Document only at the end of the day without communicating the change.", reason: "Timely communication may be needed for assessment and care." }
    ], source: sources.medication
  },
  {
    id: "nclex-pn-teach-01", pathwayId: "nclex-pn", examTag: "NCLEX-PN pathway practice", subject: "professional-practice", topic: "Patient education", difficulty: "Applied",
    learningObjective: "Check patient understanding after routine education.", learningPoint: "Ask the patient to explain the next step in their own words.",
    stem: "After explaining how to use a follow-up appointment card, which response best checks the patient's understanding?",
    correctAt: 3, correct: "Ask the patient to tell you when and where they plan to attend.",
    correctReason: "An open teach-back prompt checks understanding more effectively than asking for a yes/no response.",
    wrong: [
      { text: "Ask, “You understand, right?” and end the conversation.", reason: "This can encourage agreement without revealing misunderstanding." },
      { text: "Repeat the instructions using more medical terminology.", reason: "More jargon does not check whether the plan is understood." },
      { text: "Ask a visitor to answer even though the patient can respond.", reason: "This bypasses the patient and does not check their understanding." }
    ], source: sources.communityAssessment
  },
  {
    id: "nclex-pn-privacy-01", pathwayId: "nclex-pn", examTag: "NCLEX-PN pathway practice", subject: "professional-practice", topic: "Confidentiality", difficulty: "Foundational",
    learningObjective: "Protect private health information when communicating outside the care team.", learningPoint: "Share patient information only through an authorized, appropriate channel.",
    stem: "A friend asks a practical nurse whether a neighbour was admitted to the facility. What is the appropriate response?",
    correctAt: 0, correct: "Do not confirm or disclose the person's care information; direct the friend to contact the person or an authorized contact.",
    correctReason: "Patient information should be handled through authorized channels and shared only when permitted for care or another lawful purpose.",
    wrong: [
      { text: "Confirm the admission but omit the diagnosis.", reason: "Even confirming attendance can disclose private information." },
      { text: "Share the information if the friend promises not to repeat it.", reason: "A promise does not authorize disclosure." },
      { text: "Post a vague update online without naming the neighbour.", reason: "Context can still identify the person, and public posting is not an authorized channel." }
    ], source: sources.ncLexPn
  },
  {
    id: "nclex-pn-newborn-01", pathwayId: "nclex-pn", examTag: "NCLEX-PN pathway practice", subject: "child-health", topic: "Newborn support", difficulty: "Foundational",
    learningObjective: "Support warmth and early feeding for a stable newborn.", learningPoint: "Drying, warmth, skin-to-skin contact, and breastfeeding support are elements of essential newborn care.",
    stem: "A stable newborn is with the mother after birth. Which action supports essential newborn care?",
    correctAt: 2, correct: "Keep the newborn warm, support skin-to-skin contact, and assist breastfeeding when the mother and baby are ready.",
    correctReason: "WHO essential newborn care includes thermal protection, skin-to-skin contact, and breast-milk feeding support.",
    wrong: [
      { text: "Place the newborn uncovered on a cool surface for routine observation.", reason: "This increases heat loss and interrupts skin-to-skin care." },
      { text: "Delay all feeding support until the next day.", reason: "Routine early feeding support is part of essential newborn care when both are ready." },
      { text: "Separate a stable newborn without a clinical reason.", reason: "Routine separation is not the recommended approach for a newborn without complications." }
    ], source: sources.newborn
  },
  {
    id: "nclex-pn-document-01", pathwayId: "nclex-pn", examTag: "NCLEX-PN pathway practice", subject: "professional-practice", topic: "Objective documentation", difficulty: "Applied",
    learningObjective: "Document observations factually and distinguish observation from interpretation.", learningPoint: "Record measurable findings and the patient's own words when relevant.",
    stem: "A patient declines an offered meal and says, “I feel nauseated.” Which note is most objective?",
    correctAt: 1, correct: "“Patient declined meal and stated, ‘I feel nauseated.’ Supervising nurse notified per care plan.”",
    correctReason: "The note records the observed action, the patient's words, and the communication made without assigning an unsupported cause.",
    wrong: [
      { text: "“Patient is being difficult and does not want to cooperate.”", reason: "This is judgmental and does not record the patient's stated symptom." },
      { text: "“Patient refused because of a medication reaction.”", reason: "The cause is not established by the information provided." },
      { text: "“Patient ate lunch normally.”", reason: "This contradicts the observed refusal." }
    ], source: sources.ncLexPn
  },
  {
    id: "nclex-pn-mental-01", pathwayId: "nclex-pn", examTag: "NCLEX-PN pathway practice", subject: "mental-health", topic: "Responding to distress", difficulty: "Applied",
    learningObjective: "Respond to a distressed patient without dismissing or directing the emotion.", learningPoint: "Acknowledge distress and invite a description before offering options.",
    stem: "A patient says they are upset about being away from home. Which response is most appropriate?",
    correctAt: 3, correct: "“Being away from home sounds difficult. What would help you feel more supported today?”",
    correctReason: "The response acknowledges the feeling and invites the patient to identify a support need.",
    wrong: [
      { text: "“You should be grateful you are receiving care.”", reason: "This judges the patient's emotion and can shut down communication." },
      { text: "“Don't worry; you will be home soon.”", reason: "This offers unsupported reassurance." },
      { text: "“Everyone gets homesick, so try to ignore it.”", reason: "This minimizes the patient's experience." }
    ], source: sources.mentalHealth
  },
  {
    id: "nclex-pn-handover-01", pathwayId: "nclex-pn", examTag: "NCLEX-PN pathway practice", subject: "professional-practice", topic: "Care handoff", difficulty: "Applied",
    learningObjective: "Provide a concise factual handoff within the assigned role.", learningPoint: "Share current observations, changes, and work that still needs attention.",
    stem: "A practical nurse is handing over care. Which detail should be included about a patient whose dressing became saturated?",
    correctAt: 0, correct: "When the change was noticed, what was observed, what actions were taken, and who was notified.",
    correctReason: "A factual handoff gives the receiving team information needed to follow up and continue care.",
    wrong: [
      { text: "Only the nurse's guess about why the dressing became saturated.", reason: "An unconfirmed cause should not replace objective observations and actions." },
      { text: "A summary of unrelated details about other patients.", reason: "Unrelated information can obscure the patient's immediate follow-up." },
      { text: "Nothing, because the next nurse can inspect the patient later.", reason: "A meaningful change and actions taken should be communicated for continuity." }
    ], source: sources.ncLexPn
  }
];

export const pathwayQuestions: Question[] = drafts.map(createQuestion);
