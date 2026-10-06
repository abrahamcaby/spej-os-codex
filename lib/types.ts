import type { AcquisitionMotion } from "./gtm-sources";
export type IndustrySource = {
  id: string;
  name: string;
  url: string;
};

export type AiProvider = "none" | "openai" | "anthropic" | "gemini" | "xai" | "lmstudio" | "ollama";
export type AiKeyProvider = Exclude<AiProvider, "none">;
export type LocalAiProvider = Extract<AiKeyProvider, "lmstudio" | "ollama">;
export type AiModelOption = {
  id: string;
  label: string;
  /** Actual loaded capacity, never the model's theoretical maximum. */
  contextLength?: number;
};
export type AiModelsResponse = {
  provider: AiProvider;
  models: AiModelOption[];
  defaultModel: string;
  checkedAt: string;
  cached: boolean;
  localOnly: boolean;
  error?: string;
};

export type AudiencePlatform =
  | "youtube"
  | "x"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "threads"
  | "tiktok";

export type AudienceAccountInput = {
  id: string;
  platform: AudiencePlatform;
  label: string;
  username: string;
  accountId: string;
  profileUrl: string;
  credential?: string;
  credentialSet?: boolean;
  clearCredential?: boolean;
};

export type MentionIdentityProfile = {
  id: string;
  label: string;
  type: "company" | "person" | "custom";
  enabled: boolean;
  /** Exact names, brand phrases, and handles belonging to this identity only. */
  terms: string[];
  /** Rare organization aliases that may stand alone as exact identity proof. */
  standaloneCompanyTerms?: string[];
  /** Official domains belonging to this identity only. */
  websites: string[];
  /** Exact public profile URLs used as identity evidence, never as owned domains. */
  officialProfileUrls: string[];
  /** Identity-specific roles, products, employers, or collaborators. */
  identityAnchors: string[];
  /** Namesake contexts that apply only to this identity. */
  negativeTerms: string[];
};

export type PublicSettings = {
  general: {
    workspaceName: string;
  };
  industry: {
    sources: IndustrySource[];
    keywords: string[];
    description: string;
    excludedTerms: string[];
    dailyLimit: number;
  };
  mentions: {
    /**
     * Profiles are the authoritative identity boundaries. The flat fields are
     * retained for backward-compatible settings imports and are derived from
     * profiles whenever settings are saved.
     */
    profiles?: MentionIdentityProfile[];
    terms: string[];
    websites: string[];
    identityAnchors: string[];
    negativeTerms: string[];
    strictMode: boolean;
    excludeOwnedSites: boolean;
  };
  newsletters: {
    googleClientId: string;
    googleClientSecretSet: boolean;
    connected: boolean;
    connectedEmail: string;
    gmailQuery: string;
  };
  audience: {
    accounts: AudienceAccountInput[];
  };
  ai: {
    provider: AiProvider;
    model: string;
    localBaseUrls: Record<LocalAiProvider, string>;
    keySet: Record<AiKeyProvider, boolean>;
    keySource: Record<AiKeyProvider, "none" | "settings" | "environment">;
  };
  dailyBrief: {
    sourceLabels: string[];
    lookbackDays: number;
    sections: { industry: number; mentions: number; newsletters: number };
  };
};

export type SettingsUpdate = Omit<
  PublicSettings,
  "newsletters" | "audience" | "industry" | "mentions" | "ai"
> & {
  industry: Omit<PublicSettings["industry"], "description" | "excludedTerms" | "dailyLimit"> &
    Partial<Pick<PublicSettings["industry"], "description" | "excludedTerms" | "dailyLimit">>;
  mentions: Omit<PublicSettings["mentions"], "negativeTerms" | "excludeOwnedSites"> &
    Partial<Pick<PublicSettings["mentions"], "negativeTerms" | "excludeOwnedSites">>;
  newsletters: PublicSettings["newsletters"] & {
    googleClientSecret?: string;
  };
  audience: {
    accounts: AudienceAccountInput[];
  };
  ai?: {
    provider: AiProvider;
    model: string;
    localBaseUrls?: Partial<Record<LocalAiProvider, string>>;
    apiKeys?: Partial<Record<AiKeyProvider, string>>;
    clearKeys?: AiKeyProvider[];
  };
};

export type ContentWorkflow = {
  archiveReason: "user" | "expired" | "not-current";
  archivedAt?: string;
  restoreEligible: boolean;
};

export type LiveStory = {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  discoveredAt?: string;
  lastModifiedAt?: string;
  matchedTerm?: string;
  matchedProfileId?: string;
  matchedProfileLabel?: string;
  matchedProfileIds?: string[];
  matchedProfileLabels?: string[];
  kind?: "feed" | "sitemap" | "topic" | "mention";
  confidence?: "high" | "medium";
  matchReasons?: string[];
  importanceScore?: number;
  importanceReason?: string;
  aiSummary?: string;
  curationMode?: "local" | AiKeyProvider;
  collectionScope?: string;
  workflow?: ContentWorkflow;
};

export type IndustrySourceStatus = {
  sourceId: string;
  source: string;
  mode: "feed" | "sitemap" | "topics";
  endpoint: string;
  state: "live" | "baseline" | "unchanged" | "changed";
  message: string;
};

export type LiveFeedResponse = {
  configured: boolean;
  checkedAt: string;
  items: LiveStory[];
  errors: string[];
  sourceStatuses?: IndustrySourceStatus[];
  filteredOut?: number;
  reviewCount?: number;
  windowDays?: number;
  providerStatuses?: Array<{
    provider: string;
    state: "live" | "degraded" | "disabled";
    message: string;
  }>;
  freshnessHours?: number;
  discoveredCount?: number;
  surfacedLimit?: number;
  curationMode?: "local" | AiKeyProvider;
  archivedItems?: LiveStory[];
  archiveCount?: number;
  historyItems?: LiveStory[];
  historyCount?: number;
};

export type NewsletterFeedResponse = {
  configured: boolean;
  connected: boolean;
  aiConfigured?: boolean;
  aiProvider?: AiKeyProvider;
  curationMode?: "local" | AiKeyProvider;
  checkedAt: string;
  items: NewsletterTopic[];
  archivedItems: NewsletterTopic[];
  archiveCount: number;
  historyItems?: NewsletterTopic[];
  historyCount?: number;
  freshnessHours?: number;
  errors: string[];
  issueCount?: number;
  mentionCount?: number;
  newsletterCount?: number;
  newIssueCount?: number;
  pendingIssueCount?: number;
};

export type AudiencePrimaryMetric = "followers" | "subscribers" | "page likes";

export type AudienceMetric = {
  id: string;
  platform: AudiencePlatform;
  label: string;
  handle: string;
  total: number | null;
  change: number | null;
  changeComparedAt?: string;
  primaryLabel?: AudiencePrimaryMetric;
  secondaryLabel?: string;
  secondaryValue?: number;
  checkedAt: string;
  error?: string;
  source?: string;
  stale?: boolean;
  lastSuccessfulAt?: string;
};

export type NewsletterItem = {
  id: string;
  sender: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  gmailUrl: string;
  workflow?: ContentWorkflow;
};

export type NewsletterSourceLink = {
  url: string;
  title: string;
  publisher: string;
};

export type NewsletterTopic = {
  id: string;
  kind: "newsletter-topic";
  title: string;
  summary: string;
  importanceScore?: number;
  importanceBaseScore?: number;
  importanceReason?: string;
  curationMode?: "local" | AiKeyProvider;
  receivedAt: string;
  url: string;
  gmailUrl: string;
  coverageCount: number;
  newsletterCount: number;
  newsletterSources: string[];
  evidenceIssueIds?: string[];
  sourceLinks: NewsletterSourceLink[];
  collectionScope: string;
  workflow?: ContentWorkflow;
};

export type ReminderItem = {
  id: string | number;
  type: string;
  title: string;
  source: string;
  note: string;
  accent: string;
  url?: string;
  createdAt?: string;
  archivedAt?: string;
  added?: string;
};

export type TaskCategory = "Sales" | "Partnerships" | "Marketing" | "5-3-1" | "Content" | "Project Work" | "Client Delivery" | "Operations" | "General";
export type TaskPriority = "Urgent" | "High" | "Normal" | "Low";
export type TaskVisibility = "Private" | "Workspace" | "Company";
export type TaskWorkspaceId = "gtm" | "project-management" | "company";
export type WorkStatus = "Not Started" | "In Progress" | "Waiting" | "Blocked" | "In Review";
export type WorkEffort = "Quick" | "Small" | "Medium" | "Large";

export type TaskItem = {
  id: string | number;
  title: string;
  description: string;
  due: string;
  recurrence: string;
  priority: TaskPriority;
  owner?: string;
  /** Stable profile ID for authorization mapping; owner remains display/migration data. */
  ownerProfileId?: string;
  /** Missing legacy values fail closed to Private during normalization. */
  visibility?: TaskVisibility;
  /** Stable work-area key. A linked project's work area remains authoritative. */
  workspaceId?: TaskWorkspaceId;
  status?: WorkStatus;
  effort?: WorkEffort;
  parentId?: string | number;
  category?: TaskCategory;
  relatedType?: "account" | "contact" | "opportunity" | "partnership" | "project" | "campaign" | "content";
  relatedId?: string;
  done: boolean;
  createdAt?: string;
  completedAt?: string;
  seriesId?: string | number;
  recurrenceAnchorDay?: number;
};

export type ContentStage = "Idea" | "Research" | "Drafting" | "Production" | "Scheduled" | "Published";
export type ContentStream = "Personal LinkedIns" | "Spej Authority-building content";
export type ContentReviewStatus = "Not Requested" | "Pending Review" | "Changes Requested" | "Approved";
export type PersonalContentPillar = "Moments That Matter" | "Hero-Making Expertise" | "Human Interests" | "Collaboration" | "Unassigned";
export type AuthorityContentCategory =
  | "AI Literacy, Training & Enablement"
  | "AI Strategy & Business Alignment"
  | "Agentic AI, Automation & Human-Agent Operations"
  | "Build vs. Buy, Vendor Strategy & Procurement"
  | "Change Management & Stakeholder Communication"
  | "Client Field Notes & Failure Modes"
  | "Cybersecurity & AI Security"
  | "Data Readiness, Integration & Legacy Systems"
  | "Evaluation, Reliability, Monitoring & Observability"
  | "Executive Role-Based Briefings"
  | "Executive Sponsorship, Ownership & Operating Model"
  | "Function-by-Function Use Cases & Scorecards"
  | "Governance, Responsible AI & Risk Management"
  | "Human Oversight, Trust & Attention"
  | "MSPs, IT Advisors & Partner Ecosystems"
  | "Mid-Market Readiness & Resource Constraints"
  | "Model Strategy, Routing & Architecture"
  | "Open Source, Open Weight & Closed Models"
  | "Pilot-to-Production & Scaling"
  | "Plain-Language Explainers, Myths & Terminology"
  | "Privacy, Legal, IP & Regulatory Compliance"
  | "Private AI, Sovereignty & Data Residency"
  | "ROI, Value Realization & AI Economics"
  | "Regulated and Operations-Heavy Industries"
  | "Research Translation & Trend Interpretation"
  | "The AI Culture Blueprint & the 5Cs"
  | "The Business Brain: Knowledge, Context & Ontology"
  | "Use-Case Discovery & Prioritization"
  | "Workflow Discovery & Redesign"
  | "Workforce, Role Redesign & Incentives"
  | "Unassigned";
export type ContentCategory = PersonalContentPillar | AuthorityContentCategory;
export type ContentPillar = PersonalContentPillar;
export type SocialActionType = "Comment" | "Connect" | "DM" | "Video / audio DM" | "Profile review" | "Share resource" | "Other";
export type BuyingRole = "Decision Maker" | "Champion" | "Influencer" | "Technical Evaluator" | "Other";

export type ContentItem = {
  id: string;
  title: string;
  format: "YouTube" | "Newsletter" | "LinkedIn" | "Short-form" | "Article" | "Other";
  stage: ContentStage;
  publishDate: string;
  angle: string;
  pillar: ContentCategory;
  stream: ContentStream;
  owner?: string;
  /** Stable profile ID; owner remains the display label captured with the record. */
  ownerProfileId?: string;
  approver?: string;
  /** Stable profile ID for review routing; approver remains a display snapshot. */
  approverProfileId?: string;
  reviewStatus?: ContentReviewStatus;
  reviewDue?: string;
  campaignId?: string;
  sourceUrl?: string;
  createdAt: string;
};

export type CampaignItem = {
  id: string;
  name: string;
  status: "Planning" | "Active" | "Paused" | "Complete";
  objective: string;
  audience: string;
  owner: string;
  ownerProfileId?: string;
  primaryChannel: "Multi-channel" | "LinkedIn" | "Email" | "YouTube" | "Website" | "Event" | "Partner" | "Other";
  startDate: string;
  endDate: string;
  successMeasure: string;
  notes: string;
  createdAt: string;
  archivedAt?: string;
};

export type OriginSnapshot = {
  source: string;
  acquisitionMotion: AcquisitionMotion;
  sourceDate: string;
  originatingContactId?: string;
  referrerContactId?: string;
  sourceArtifactId?: string;
};

export type EvidenceFact = {
  id: string;
  topic: string;
  text: string;
  kind: "Customer statement" | "Internal observation" | "Hypothesis" | "AI suggestion";
  sourceLabel: string;
  /** Original event date; blank means unknown, never the import date. */
  sourceDate: string;
  capturedAt: string;
  status: "Current" | "Conflicting" | "Superseded";
};

export type RelationshipConnection = {
  id: string;
  fromContactId?: string;
  viaContactId?: string;
  toAccountId?: string;
  toContactId?: string;
  context: string;
  kind: "Confirmed relationship" | "Public affiliation" | "Possible introduction" | "Actual introduction";
  introductionStatus: "Not requested" | "Offered" | "Requested" | "Completed" | "Accepted";
  validator: string;
  lastInteractionDate: string;
  relevance: string;
  nextStep: string;
  dueDate: string;
  evidence: string;
  evidenceDate: string;
  confidence: "Unknown" | "Low" | "Medium" | "High";
};

export type NurturePlan = {
  approach: "Responsive" | "Deferred" | "Dormant" | "Internal builder" | "Introducer" | "Existing client" | "Poor fit";
  owner: string;
  nextAction: string;
  dueDate: string;
  trigger: string;
  reason: string;
  desiredOutcome: string;
  pauseCondition: string;
  state: "Active" | "Paused";
};

export type AiProfile = {
  usage: string;
  maturity: "Unknown" | "Exploring" | "Piloting" | "In production" | "Scaling";
  implementationReadiness: "Unknown" | "Needs foundations" | "Partly ready" | "Ready for scoped work";
  primaryConcern: "Unknown" | "Security / governance" | "Cost / ROI" | "Adoption" | "Data readiness" | "Capability / capacity" | "Other";
  otherConcerns: string;
  nextQuestion: string;
  evidence: string;
  evidenceDate: string;
  reviewer: string;
  reviewStatus: "Needs review" | "Human reviewed";
};

export type ContactNurture = {
  method: "Personal" | "Campaign" | "Coordinated mix";
  state: "Active" | "Paused" | "Ended";
  owner: string;
  channel: "Email" | "LinkedIn" | "Call" | "Meeting" | "Introduction" | "Event" | "Other";
  campaign: string;
  nextAction: string;
  dueDate: string;
  trigger: string;
  coordination: string;
  emailEligibility: "Unknown" | "Reviewed eligible" | "Ineligible";
  eligibilityEvidence: string;
  eligibilityAccountId: string;
  eligibilityEmail: string;
};

export type AdoptionOutcome = {
  technicalAcceptance: "Unknown" | "Not accepted" | "Accepted";
  adoption: "Unknown" | "Not started" | "Testing" | "Below target" | "On target";
  measure: string;
  baseline: string;
  target: string;
  observed: string;
  evidence: string;
  evidenceDate: string;
  owner: string;
  reviewDate: string;
  blocker: string;
};

export type DiscoveryEconomics = {
  budgetStatus: "Unknown" | "Discussing" | "Customer confirmed" | "Not funded";
  budgetEvidence: string;
  deliveryCapacity: "Unknown" | "Needs review" | "Available" | "Constrained";
  discoveryEffort: string;
  nextQuestion: string;
};

export type OutreachHold = {
  active: boolean;
  reason: string;
  /** A review date, not automatic permission to resume outreach. */
  until: string;
  releaseCondition: string;
};

export type DeliveryContext = {
  scope: string;
  deliverables: string;
  startConditions: string;
  customerCounterpart: string;
  commitments: string;
  openQuestions: string;
  expansionIdeas: string;
  verifiedOutcomes: string;
  sourceEvidence: string;
};

export type AccountItem = {
  id: string;
  name: string;
  type: "Prospect" | "Client" | "Partner" | "Network" | "Other";
  status: "Active" | "Nurture" | "Inactive";
  owner: string;
  ownerProfileId?: string;
  website: string;
  notes: string;
  /** How the organization first entered Spej's CRM; independent of any later opportunity source. */
  acquisitionMotion?: AcquisitionMotion;
  /** Detailed origin channel or connection context for the organization. */
  source?: string;
  /** Date the account-level origin occurred, when known. */
  sourceDate?: string;
  /** Earliest known person whose relationship led to this account entering the CRM. */
  originatingContactId?: string;
  /** Person who made the introduction, which may be outside the account. */
  referrerContactId?: string;
  /** Stable evidence pointer attached by a trusted adapter, not free-form evidence text. */
  sourceArtifactId?: string;
  originalSource?: OriginSnapshot;
  contextFacts?: EvidenceFact[];
  connections?: RelationshipConnection[];
  nurturePlan?: NurturePlan;
  aiProfile?: AiProfile;
  outreachHold?: OutreachHold;
  companySizeBand?: "Unknown" | "1-49" | "50-249" | "250-999" | "1,000-4,999" | "5,000+";
  focus531?: boolean;
  clientStatus?: "Unclassified" | "Not a client" | "Current client" | "Past client";
  isPartner?: boolean;
  outreachPreference?: "Allowed" | "No proactive outreach";
  checkInCadence?: "Not set" | "One-time" | "30 days" | "60 days" | "90 days";
  checkInOwner?: string;
  checkInContactId?: string;
  checkInReason?: string;
  lastCheckIn?: string;
  nextCheckIn?: string;
  nextMeetingDate?: string;
  checkInTaskId?: string;
  createdAt: string;
  archivedAt?: string;
};

export type ContactItem = {
  acquisitionMotion?: AcquisitionMotion;
  id: string;
  accountId: string;
  name: string;
  title: string;
  relationshipRoles?: string[];
  nurture?: ContactNurture;
  employmentHistory?: { accountId: string; title: string; endedAt: string }[];
  email: string;
  linkedinUrl?: string;
  buyingRole?: BuyingRole;
  focus531?: boolean;
  nextActionType?: SocialActionType;
  nextAction?: string;
  nextActionDue?: string;
  relationshipStrength: "New" | "Developing" | "Strong" | "Dormant";
  lifecycleStage?: "Unclassified" | "Prospect" | "Lead" | "Customer" | "Partner" | "Network";
  leadDate?: string;
  source: string;
  lastContact: string;
  notes: string;
  createdAt: string;
  archivedAt?: string;
};

export type ActivityItem = {
  id: string;
  accountId: string;
  contactId: string;
  channel: "LinkedIn 5-3-1" | "LinkedIn" | "Email" | "Meeting" | "Call" | "Referral" | "Event" | "Content" | "Other";
  actionType?: SocialActionType;
  metricType?: "Outreach sent" | "Follow-up sent" | "Reply received" | "Call attempted" | "Call connected" | "Meeting booked" | "Meeting held" | "Meeting cancelled" | "Meeting no-show" | "Comment made" | "Connection requested" | "Check-in completed" | "Other";
  purpose?: "Unclassified" | "Business development" | "Client relationship" | "Partner relationship";
  owner?: string;
  ownerProfileId?: string;
  campaignId?: string;
  opportunityId?: string;
  projectId?: string;
  sourceArtifactId?: string;
  sourceLabel?: string;
  summary: string;
  outcome: string;
  occurredAt: string;
  capturedAt?: string;
  captureMethod?: "Direct entry" | "Forwarded email" | "Pasted message" | "Meeting transcript" | "Voice transcript";
  sourceDateKnown?: boolean;
  createdAt: string;
  archivedAt?: string;
};

export type OpportunityItem = {
  discoveryEconomics?: DiscoveryEconomics;
  acquisitionMotion?: AcquisitionMotion;
  id: string;
  accountId: string;
  name: string;
  stage: "Explore" | "Validate" | "Qualify" | "Shape & Estimate" | "Proposal & Decision" | "Contracting" | "Closed Won" | "Closed Lost";
  forecast: "Not Forecasted" | "Pipeline" | "Best Case" | "Commit" | "Contracted" | "Lost";
  value: number;
  /** How reliable the current value estimate is. Legacy zero values remain unknown. */
  valueConfidence?: "Unknown" | "Rough estimate" | "Validated" | "Contracted";
  valueMeaning?: "Unknown" | "Estimated" | "Proposed" | "Contracted" | "Invoiced" | "Paid";
  annualRevenuePotential?: number;
  revenueModel?: "Unknown" | "One-time" | "Recurring" | "Mixed";
  timeToRevenue?: "Unknown" | "0-30 days" | "31-90 days" | "91-180 days" | "181-365 days" | "More than 1 year";
  seriousness?: "Unknown" | "Exploratory" | "Engaged" | "Active buying" | "Commercial commitment";
  primaryContactId?: string;
  decisionAccess?: "Unknown" | "No direct access" | "Influencer" | "Champion" | "Decision maker" | "Economic buyer";
  stakeholderCoverage?: "Unknown" | "Single-threaded" | "Multi-threaded" | "Buying group mapped";
  strategicFit?: "Unknown" | "Low" | "Medium" | "High";
  expansionPotential?: "Unknown" | "Low" | "Medium" | "High";
  priorityEvidence?: string;
  priorityEvidenceSourceIds?: string[];
  priorityStatus?: "Needs review" | "Human confirmed";
  priorityReviewedAt?: string;
  attentionOverride?: "Automatic" | "Strategic" | "Priority" | "Standard" | "Light-touch";
  attentionOverrideReason?: string;
  closeDate: string;
  owner: string;
  ownerProfileId?: string;
  motion?: "AI Office" | "Plooms" | "Individual Project" | "MSP / Partner" | "Other";
  salesRoute?: "Unclassified" | "Direct" | "Partner-sourced" | "Co-sell";
  partnerAccountId?: string;
  engagementPhase?: "Discovery" | "Design" | "Delivery" | "Not Applicable";
  painPoint?: string;
  desiredOutcome?: string;
  nextSpejAction: string;
  nextCustomerDecision: string;
  nextActionDue: string;
  nextActionReason?: string;
  desiredNextOutcome?: string;
  actionState?: "Suggested" | "Assigned" | "Agreed" | "Scheduled" | "Completed";
  source: string;
  notes: string;
  createdAt: string;
  archivedAt?: string;
};

export type PartnershipItem = {
  id: string;
  accountId: string;
  name: string;
  type: "Referral" | "Strategic alliance" | "Technology" | "Delivery" | "Channel / co-selling";
  partnerCategory?: "Unclassified" | "Affiliate / referrer" | "MSP" | "IT services provider" | "Technology partner" | "Delivery partner" | "Strategic partner" | "Other";
  stage: "Identified" | "Engaging" | "Mutual Fit" | "Designing" | "Pilot / Activation" | "Active" | "Paused / Ended";
  health: "Unknown" | "Healthy" | "Watch" | "At Risk";
  owner: string;
  ownerProfileId?: string;
  nextAction: string;
  dueDate: string;
  notes: string;
  createdAt: string;
  archivedAt?: string;
};

/**
 * A permission-filtered pointer to a record owned by an existing Spej OS or
 * Microsoft service. The preview stores the stable reference, not a second
 * copy of the private ticket, file, transcript, approval, or time entry.
 */
export type CanonicalProjectRecordReference = {
  sourceSystem: "Spej OS" | "SharePoint" | "OneDrive" | "Microsoft 365" | "Other";
  recordType: "ticket" | "quality-item" | "document" | "transcript" | "decision" | "approval" | "time-entry" | "enterprise-engagement";
  externalId: string;
  title?: string;
  status?: string;
  url?: string;
  updatedAt?: string;
};

export type ProjectItem = {
  progressUpdates?: { id: string; occurredOn: string; recordedAt: string; author: string; summary: string; nextStep: string }[];
  resources?: { id: string; title: string; url: string; addedAt: string; addedBy: string }[];
  id: string;
  accountId: string;
  name: string;
  /** Retained for backward compatibility. In the UI this is only the optional DDD phase. */
  phase: "Not Applicable" | "Discovery" | "Design" | "Delivery" | "Internal";
  workArea?: "Unclassified" | "Client Delivery" | "GTM" | "Product" | "Internal Operations";
  projectType?: "Unclassified" | "AI Office" | "Plooms" | "Client Project" | "Event" | "Marketing / Media" | "Partner Enablement" | "Product Development" | "Internal Initiative" | "Other";
  playbook?: "Not set" | "Discovery / Design / Delivery" | "AI Office Delivery" | "Plooms Implementation" | "Event Production" | "Marketing / Media" | "Partner Enablement" | "Product Development" | "Custom";
  opportunityId?: string;
  commercialStatus: "Not Applicable" | "Anticipated" | "Shaping" | "Proposed" | "Contracting" | "Contracted" | "Declined";
  operationalStatus: "Not Started" | "Mobilizing" | "Active" | "At Gate" | "Complete" | "Paused" | "Stopped";
  health?: "Unknown" | "On Track" | "Watch" | "At Risk";
  owner: string;
  ownerProfileId?: string;
  startDate?: string;
  endDate?: string;
  nextMilestone: string;
  dueDate: string;
  successMeasure?: string;
  risk?: string;
  /** Reference-only projections supplied by authorized production adapters. */
  linkedRecords?: CanonicalProjectRecordReference[];
  deliveryContext?: DeliveryContext;
  adoptionOutcome?: AdoptionOutcome;
  notes: string;
  createdAt: string;
  updatedAt?: string;
  archivedAt?: string;
};

export type MarketingMetricCategory =
  | "Website & SEO"
  | "Email & Newsletter"
  | "LinkedIn & 5-3-1"
  | "YouTube"
  | "Awareness & Events"
  | "Other Social";

export type MarketingMetricUnit = "count" | "percent" | "hours" | "position";

export type MarketingMetricItem = {
  id: string;
  period: string;
  category: MarketingMetricCategory;
  metricKey: string;
  value: number;
  unit: MarketingMetricUnit;
  source: string;
  notes: string;
  updatedAt: string;
};

export type WorkspaceState = {
  reminders: ReminderItem[];
  tasks: TaskItem[];
  content: ContentItem[];
  accounts: AccountItem[];
  contacts: ContactItem[];
  activities: ActivityItem[];
  opportunities: OpportunityItem[];
  partnerships: PartnershipItem[];
  projects: ProjectItem[];
  campaigns: CampaignItem[];
  marketingMetrics: MarketingMetricItem[];
};

export type WorkspaceStateResponse = WorkspaceState & {
  initialized: boolean;
  legacyBrowserImportAllowed: boolean;
  /** True only for the isolated, synthetic executive-demo launcher. */
  syntheticDemo: boolean;
};

export type AgentWorkspaceCollection = keyof WorkspaceState;

export type AgentWorkspaceAction = {
  id: string;
  type: "create" | "update" | "complete";
  collection: AgentWorkspaceCollection;
  recordId?: string | number;
  label: string;
  reason: string;
  data: Record<string, unknown>;
};

export type AgentWorkspaceProposal = {
  baseWorkspaceVersion?: string;
  reply: string;
  needsClarification: boolean;
  actions: AgentWorkspaceAction[];
  nextWorkspace?: WorkspaceState;
  provider?: AiKeyProvider;
  model?: string;
};

export type DailyBriefItem = {
  id: string;
  source: string;
  title: string;
  summary: string;
  kind: "action" | "meeting" | "message" | "info";
  occurredAt: string;
  dueAt?: string;
  url?: string;
  syncedAt: string;
};

export type DailyBriefResponse = {
  configured: boolean;
  checkedAt: string;
  items: DailyBriefItem[];
  snapshot?: DailyBriefSnapshotSection[];
  intelligence?: DailyIntelligenceDigest;
  sourceStatuses: Array<{
    source: string;
    lastSyncedAt: string;
    lastAttemptAt: string;
    itemCount: number;
    state: "waiting" | "live" | "error";
    message: string;
  }>;
};

export type BriefCategory = "industry" | "mentions" | "newsletters";
export type DailyBriefSnapshotSection = {
  category: BriefCategory;
  requestedCount: number;
  availableCount: number;
  checkedAt: string;
  configured: boolean;
  stale: boolean;
  items: Array<{ id: string; title: string; summary: string; url: string; source: string; importanceScore?: number }>;
};

export type DailyIntelligenceDigest = {
  requestedCount: number;
  availableCount: number;
  duplicatesCollapsed: number;
  checkedAt: string;
  configured: boolean;
  stale: boolean;
  items: Array<{
    id: string;
    title: string;
    summary: string;
    url: string;
    occurredAt: string;
    importanceScore?: number;
    sources: string[];
    channels: Array<"industry" | "newsletters">;
    coverageCount: number;
  }>;
};
