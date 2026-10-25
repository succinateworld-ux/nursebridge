const source = {
  title: "Community Health Assessments and Improvement Plans",
  url: "https://portugues.cdc.gov/infrastructure/public-health-systems-emerging-practices/community-health-assessments-and-improvement-plans.html",
  publisher: "U.S. Centers for Disease Control and Prevention",
  sourceCheckedAt: "2026-10-24"
};

export const premiumReviewPack = {
  title: "Applied community health review",
  questions: [
    {
      id: "premium-community-priority-01", subject: "Public health nursing", topic: "Community diagnosis", difficulty: "Applied",
      stem: "A community assessment reports repeated missed antenatal visits, long travel times to a clinic, and strong interest in outreach from local groups. Which planning response best uses these findings?",
      options: [
        { id: "a", text: "Begin a clinic-based education campaign without discussing access barriers." },
        { id: "b", text: "Review the data with affected groups and service partners, then compare feasible options against agreed priorities." },
        { id: "c", text: "Assume every missed visit has the same cause and publish a list of households." },
        { id: "d", text: "Wait for a complete national dataset before discussing any local action." }
      ], correctOptionId: "b",
      explanation: "Assessment findings point to both access conditions and community assets. A participatory review can check interpretations and compare feasible responses using transparent criteria.",
      distractorExplanations: { a: "This ignores the reported travel barrier and community input.", c: "The assessment does not establish one cause for every household, and identifiable household lists should not be made public.", d: "Local planning can use appropriate available information while documenting uncertainty." },
      source
    },
    {
      id: "premium-community-evidence-01", subject: "Public health nursing", topic: "Assessment quality", difficulty: "Applied",
      stem: "Clinic records show fewer visits from one settlement than other areas. What should the nurse do before concluding that the settlement has less need for care?",
      options: [
        { id: "a", text: "Treat low clinic attendance as proof of low disease burden." },
        { id: "b", text: "Check what the records capture and seek suitable additional information about access, health needs, and community experience." },
        { id: "c", text: "Remove the settlement from future assessment plans." },
        { id: "d", text: "Use the clinic count alone because it is quantitative." }
      ], correctOptionId: "b",
      explanation: "Service-use data describe recorded service use. They may not represent unmet need, so interpretation should be checked with other suitable sources and community knowledge.",
      distractorExplanations: { a: "Low use can reflect barriers as well as lower need.", c: "Excluding an area could hide access gaps.", d: "Quantitative information still needs context and appropriate interpretation." },
      source
    },
    {
      id: "premium-community-assets-01", subject: "Public health nursing", topic: "Community assets", difficulty: "Foundational",
      stem: "Which information belongs in a community health assessment alongside health needs and risk factors?",
      options: [
        { id: "a", text: "Available community resources and assets that could support health improvement." },
        { id: "b", text: "Only resources already controlled by the health facility." },
        { id: "c", text: "Only the views of service providers." },
        { id: "d", text: "No contextual information because it cannot be measured." }
      ], correctOptionId: "a",
      explanation: "Community assessments consider resources and assets as well as health status, contributing conditions, and community perspectives.",
      distractorExplanations: { b: "Community assets extend beyond facility-owned resources.", c: "Community perspectives are an important part of assessment.", d: "Qualitative context can complement quantitative measures." },
      source
    }
  ]
} as const;

export function validatePremiumReviewPack(value: typeof premiumReviewPack): boolean {
  return Boolean(value.title && value.questions.length > 0 && value.questions.every(question =>
    question.options.length === 4 && question.options.some(option => option.id === question.correctOptionId) &&
    question.explanation.length > 20 && question.source.url.startsWith("https://") && /^\d{4}-\d{2}-\d{2}$/.test(question.source.sourceCheckedAt)
  ));
}

if (!validatePremiumReviewPack(premiumReviewPack)) throw new Error("Premium review content failed validation.");
