import type {
  AuthorityContentCategory,
  ContentCategory,
  ContentStream,
  PersonalContentPillar,
} from "./types";

// Retained only to read historical records, not as a separate publishing workflow.
export const PERSONAL_CONTENT_PILLARS: PersonalContentPillar[] = [
  "Moments That Matter",
  "Hero-Making Expertise",
  "Human Interests",
  "Collaboration",
  "Unassigned",
];

export const AUTHORITY_CONTENT_CATEGORIES: AuthorityContentCategory[] = [
  "AI Literacy, Training & Enablement",
  "AI Strategy & Business Alignment",
  "Agentic AI, Automation & Human-Agent Operations",
  "Build vs. Buy, Vendor Strategy & Procurement",
  "Change Management & Stakeholder Communication",
  "Client Field Notes & Failure Modes",
  "Cybersecurity & AI Security",
  "Data Readiness, Integration & Legacy Systems",
  "Evaluation, Reliability, Monitoring & Observability",
  "Executive Role-Based Briefings",
  "Executive Sponsorship, Ownership & Operating Model",
  "Function-by-Function Use Cases & Scorecards",
  "Governance, Responsible AI & Risk Management",
  "Human Oversight, Trust & Attention",
  "MSPs, IT Advisors & Partner Ecosystems",
  "Mid-Market Readiness & Resource Constraints",
  "Model Strategy, Routing & Architecture",
  "Open Source, Open Weight & Closed Models",
  "Pilot-to-Production & Scaling",
  "Plain-Language Explainers, Myths & Terminology",
  "Privacy, Legal, IP & Regulatory Compliance",
  "Private AI, Sovereignty & Data Residency",
  "ROI, Value Realization & AI Economics",
  "Regulated and Operations-Heavy Industries",
  "Research Translation & Trend Interpretation",
  "The AI Culture Blueprint & the 5Cs",
  "The Business Brain: Knowledge, Context & Ontology",
  "Use-Case Discovery & Prioritization",
  "Workflow Discovery & Redesign",
  "Workforce, Role Redesign & Incentives",
  "Unassigned",
];

// Keep the stored value stable while presenting one shared Content workflow.
export const COMPANY_CONTENT_STREAM: ContentStream = "Spej Authority-building content";
export const COMPANY_CONTENT_CATEGORIES: readonly ContentCategory[] = AUTHORITY_CONTENT_CATEGORIES;

export function contentCategoryLabel(category: ContentCategory): string {
  return COMPANY_CONTENT_CATEGORIES.includes(category as AuthorityContentCategory)
    ? category
    : "Saved category";
}

export function contentCategoriesForStream(stream: ContentStream): ContentCategory[] {
  return stream === "Personal LinkedIns"
    ? PERSONAL_CONTENT_PILLARS
    : AUTHORITY_CONTENT_CATEGORIES;
}

function categoryFromAngle(angle: unknown): AuthorityContentCategory | undefined {
  if (typeof angle !== "string") return undefined;
  const match = angle.match(/(?:^|\n)Category:\s*([^\n]+)/i);
  const category = match?.[1]?.trim();
  return AUTHORITY_CONTENT_CATEGORIES.includes(category as AuthorityContentCategory)
    ? category as AuthorityContentCategory
    : undefined;
}

export function normalizeContentCategory(stream: ContentStream, value: unknown, angle?: unknown): ContentCategory {
  const categories = contentCategoriesForStream(stream);
  if (categories.includes(value as ContentCategory)) return value as ContentCategory;
  if (stream === "Spej Authority-building content") return categoryFromAngle(angle) || "Unassigned";
  return "Unassigned";
}
