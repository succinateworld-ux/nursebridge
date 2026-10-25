export const PATHWAY_IDS = ["nmcn-rn", "nmcn-rm", "nmcn-rphn", "nclex-rn", "nclex-pn"] as const;
export type PathwayId = typeof PATHWAY_IDS[number];

export interface PathwayReference {
  title: string;
  url: string;
  publisher: string;
  sourceCheckedAt: string;
}

export interface ExamPathway {
  id: PathwayId;
  name: string;
  credential: string;
  jurisdiction: string;
  purpose: string;
  focusAreas: string[];
  source: PathwayReference;
  blueprintStatus: string;
  blueprintVerified: boolean;
}

const checkedAt = "2026-10-24";
const nmcnExamReference: PathwayReference = {
  title: "NMCN Examination Division",
  url: "https://nmcn.gov.ng/unitexam.html",
  publisher: "Nursing and Midwifery Council of Nigeria",
  sourceCheckedAt: checkedAt
};

export const examPathways: ExamPathway[] = [
  {
    id: "nmcn-rn",
    name: "NMCN Registered Nurse",
    credential: "RN · Professional qualifying examination",
    jurisdiction: "Nigeria",
    purpose: "Preparation for the Nursing and Midwifery Council of Nigeria general nursing qualifying examination.",
    focusAreas: ["Nursing fundamentals and safety", "Adult health", "Maternal and child health", "Mental health", "Community health", "Professional practice"],
    source: nmcnExamReference,
    blueprintStatus: "The Council confirms general nursing qualifying examinations. A public, detailed current examination blueprint was not available in the pages checked.",
    blueprintVerified: false
  },
  {
    id: "nmcn-rm",
    name: "NMCN Registered Midwife",
    credential: "RM · Professional qualifying examination",
    jurisdiction: "Nigeria",
    purpose: "Preparation for the Nursing and Midwifery Council of Nigeria midwifery qualifying examination.",
    focusAreas: ["Midwifery foundations", "Antenatal care", "Labour and birth", "Postnatal and newborn care", "Reproductive health", "Professional practice"],
    source: nmcnExamReference,
    blueprintStatus: "The Council confirms midwifery qualifying examinations. A public, detailed current examination blueprint was not available in the pages checked.",
    blueprintVerified: false
  },
  {
    id: "nmcn-rphn",
    name: "NMCN Registered Public Health Nurse",
    credential: "RPHN · Post-basic nursing pathway",
    jurisdiction: "Nigeria",
    purpose: "Public health nursing revision for nurses pursuing an RPHN qualification.",
    focusAreas: ["Community assessment", "Health promotion", "Primary health care", "Population health", "Epidemiology and surveillance", "Professional practice"],
    source: nmcnExamReference,
    blueprintStatus: "The Council lists post-basic examinations and curriculum oversight. A public RPHN-specific current blueprint was not available in the pages checked.",
    blueprintVerified: false
  },
  {
    id: "nclex-rn",
    name: "NCLEX-RN",
    credential: "Registered Nurse licensure examination",
    jurisdiction: "United States and participating nursing regulators",
    purpose: "Preparation for registered nurse licensure examination candidates using original practice material.",
    focusAreas: ["Safe and effective care", "Health promotion", "Psychosocial integrity", "Physiological integrity", "Clinical judgment"],
    source: {
      title: "2026 NCLEX-RN Test Plan",
      url: "https://www.ncsbn.org/publications/2026-nclex-rn-test-plan",
      publisher: "National Council of State Boards of Nursing",
      sourceCheckedAt: checkedAt
    },
    blueprintStatus: "The NCSBN 2026 RN plan was checked; it is effective April 1, 2026 through March 31, 2029. NurseBridge questions are not yet mapped or independently reviewed against it.",
    blueprintVerified: true
  },
  {
    id: "nclex-pn",
    name: "NCLEX-PN",
    credential: "Practical Nurse licensure examination",
    jurisdiction: "United States and participating nursing regulators",
    purpose: "Preparation for practical nurse licensure examination candidates using original practice material.",
    focusAreas: ["Coordinated care", "Safety and infection prevention", "Health promotion", "Psychosocial integrity", "Physiological integrity"],
    source: {
      title: "2026 NCLEX-PN Test Plan",
      url: "https://www.ncsbn.org/public-files/2026_PN_Test%20Plan-F.pdf",
      publisher: "National Council of State Boards of Nursing",
      sourceCheckedAt: checkedAt
    },
    blueprintStatus: "The NCSBN 2026 PN test plan was checked. NurseBridge questions are not yet mapped or independently reviewed against it.",
    blueprintVerified: true
  }
];

export function getPathway(id: PathwayId | null | undefined): ExamPathway | null {
  return examPathways.find(pathway => pathway.id === id) ?? null;
}

export function isPathwayId(value: unknown): value is PathwayId {
  return typeof value === "string" && PATHWAY_IDS.includes(value as PathwayId);
}
