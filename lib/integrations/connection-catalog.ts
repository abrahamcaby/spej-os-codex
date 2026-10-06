export type ConnectionId = "outlook-mail" | "outlook-calendar" | "teams" | "sharepoint" | "onedrive" | "granola" | "plaud";

export type ConnectionDefinition = {
  id: ConnectionId;
  provider: "microsoft" | "granola" | "plaud";
  name: string;
  scopes: readonly ("personal" | "company")[];
  summary: string;
  surfaces: readonly string[];
  transport: string;
  foundation: string;
  capabilities: readonly {
    id: string;
    label: string;
    description: string;
    access: "read" | "write";
  }[];
  setupSteps: readonly string[];
  docsUrl: string;
};

const MICROSOFT_DOCS = "https://learn.microsoft.com/en-us/graph/overview";
const MICROSOFT_TRANSPORT = "Proposed Microsoft Graph adapter";
const MICROSOFT_SETUP = [
  "Have IT select the tenant, account model, and exact resources for the requested capabilities.",
  "Have IT determine the minimum Microsoft Graph permissions and any required consent; this plan grants none.",
  "Implement the server-side adapter, secure sign-in, access checks, and audit logging before a connection can be enabled.",
] as const;

/** Functional requests only. These are not OAuth scopes, connections, or access grants. */
export const CONNECTION_CATALOG: readonly ConnectionDefinition[] = [
  {
    id: "outlook-mail",
    provider: "microsoft",
    name: "Outlook Mail",
    scopes: ["personal", "company"],
    summary: "Bring selected email context into relationship work and prepare follow-ups.",
    surfaces: ["My Work", "CRM", "GTM"],
    transport: MICROSOFT_TRANSPORT,
    foundation: "Pure message mapping and send-draft validation exist. No live adapter or sign-in is implemented.",
    capabilities: [
      { id: "mail.read", label: "Read email context", description: "Request bounded message context from mailboxes IT later permits.", access: "read" },
      { id: "mail.send", label: "Send reviewed email", description: "Plan a future send capability. Each send still needs separate authorization and review.", access: "write" },
    ],
    setupSteps: [...MICROSOFT_SETUP, "Define which mailboxes and message fields are needed, retention limits, and a separate send-review process."],
    docsUrl: MICROSOFT_DOCS,
  },
  {
    id: "outlook-calendar",
    provider: "microsoft",
    name: "Outlook Calendar",
    scopes: ["personal", "company"],
    summary: "Use selected calendar context for meeting preparation and scheduling.",
    surfaces: ["My Work", "Calendar", "Meeting preparation"],
    transport: MICROSOFT_TRANSPORT,
    foundation: "Pure calendar mapping and change-draft validation exist. No live adapter or sign-in is implemented.",
    capabilities: [
      { id: "calendar.read", label: "Read calendar events", description: "Request selected calendar details for preparation and availability context.", access: "read" },
      { id: "calendar.write", label: "Make reviewed calendar changes", description: "Plan future event creation, updates, or cancellations, each subject to separate review.", access: "write" },
    ],
    setupSteps: [...MICROSOFT_SETUP, "Define the calendars in scope and a separate review process for invitations, changes, and cancellations."],
    docsUrl: MICROSOFT_DOCS,
  },
  {
    id: "teams",
    provider: "microsoft",
    name: "Microsoft Teams",
    scopes: ["personal", "company"],
    summary: "Use selected conversations and meeting transcripts to support follow-through.",
    surfaces: ["My Work", "Projects", "Meeting intake"],
    transport: MICROSOFT_TRANSPORT,
    foundation: "Pure message and transcript mapping plus send-draft validation exist. No live adapter or sign-in is implemented.",
    capabilities: [
      { id: "teams.messages.read", label: "Read conversation context", description: "Request bounded context from specific chats or channels.", access: "read" },
      { id: "teams.transcripts.read", label: "Read meeting transcripts", description: "Request selected transcripts for meeting intake and action extraction.", access: "read" },
      { id: "teams.messages.send", label: "Send reviewed messages", description: "Plan a future message-send capability with separate destination and content review.", access: "write" },
    ],
    setupSteps: [...MICROSOFT_SETUP, "Identify the chats, channels, and meetings in scope; confirm transcript availability and the review process for sending."],
    docsUrl: MICROSOFT_DOCS,
  },
  {
    id: "sharepoint",
    provider: "microsoft",
    name: "SharePoint",
    scopes: ["company"],
    summary: "Plan selected company file references and permitted excerpts for shared work.",
    surfaces: ["Projects", "CRM", "SOSA"],
    transport: MICROSOFT_TRANSPORT,
    foundation: "Pure file-reference mapping and metadata-change validation exist. File ingestion and a live adapter are not implemented.",
    capabilities: [
      { id: "sharepoint.references.read", label: "Read file references", description: "Request links and limited metadata for selected files, without copying their contents.", access: "read" },
      { id: "sharepoint.excerpts.read", label: "Read permitted document excerpts", description: "Request future bounded excerpts for SOSA after source access and sensitivity checks. Document ingestion is not implemented.", access: "read" },
      { id: "sharepoint.metadata.write", label: "Update reviewed file metadata", description: "Plan future title or description changes with separate authorization and version checks.", access: "write" },
    ],
    setupSteps: [...MICROSOFT_SETUP, "Identify permitted sites and libraries, source access rules, sensitivity labels, and metadata-change review requirements.", "Implement bounded document extraction with source access checks, sensitivity handling, retention limits, and source citations before excerpt intake."],
    docsUrl: MICROSOFT_DOCS,
  },
  {
    id: "onedrive",
    provider: "microsoft",
    name: "OneDrive",
    scopes: ["personal", "company"],
    summary: "Plan selected file references and permitted excerpts for personal or shared work.",
    surfaces: ["My Work", "Projects", "SOSA"],
    transport: MICROSOFT_TRANSPORT,
    foundation: "Contract-only planning. No OneDrive-specific mapper, live adapter, or sign-in is implemented.",
    capabilities: [
      { id: "onedrive.references.read", label: "Read file references", description: "Request links and limited metadata for selected files while preserving source access rules.", access: "read" },
      { id: "onedrive.excerpts.read", label: "Read permitted document excerpts", description: "Request future bounded excerpts for SOSA after source access and sensitivity checks. Document ingestion is not implemented.", access: "read" },
    ],
    setupSteps: [...MICROSOFT_SETUP, "Implement and test the OneDrive mapping contract; define selected drives and files before any data access.", "Implement bounded document extraction with source access checks, sensitivity handling, retention limits, and source citations before excerpt intake."],
    docsUrl: MICROSOFT_DOCS,
  },
  {
    id: "granola",
    provider: "granola",
    name: "Granola",
    scopes: ["personal", "company"],
    summary: "Plan meeting-note and transcript intake for preparation and follow-ups.",
    surfaces: ["My Work", "CRM", "Meeting intake"],
    transport: "Proposed Granola MCP connection",
    foundation: "Provider documentation reviewed. The Spej adapter, sign-in, and meeting-note mapping are not implemented.",
    capabilities: [
      { id: "granola.notes.read", label: "Read meeting notes", description: "Request notes the connected user can access in their active Granola workspace.", access: "read" },
      { id: "granola.transcripts.read", label: "Read meeting transcripts", description: "Request transcripts where the account plan and workspace settings allow access.", access: "read" },
    ],
    setupSteps: [
      "Confirm the account, active workspace, plan, and note-sharing rules; a company plan does not grant workspace-wide access.",
      "Have IT review individual OAuth or supported enterprise-managed authorization and the provider's current MCP requirements.",
      "Implement the Spej MCP adapter, identity mapping, source attribution, retention controls, and access checks before connection.",
    ],
    docsUrl: "https://docs.granola.ai/help-center/sharing/integrations/mcp",
  },
  {
    id: "plaud",
    provider: "plaud",
    name: "Plaud",
    scopes: ["personal", "company"],
    summary: "Plan recording-note and transcript intake for meeting follow-through.",
    surfaces: ["My Work", "Projects", "Meeting intake"],
    transport: "Proposed Plaud MCP connection",
    foundation: "Provider documentation reviewed. The Spej adapter, sign-in, and recording mapping are not implemented.",
    capabilities: [
      { id: "plaud.recordings.read", label: "Read recording notes", description: "Request selected recording metadata, summaries, and action items from the connected account.", access: "read" },
      { id: "plaud.transcripts.read", label: "Read recording transcripts", description: "Request selected transcripts with timestamps and speaker labels for meeting intake.", access: "read" },
    ],
    setupSteps: [
      "Confirm the account, recording consent, sharing rules, and retention requirements for the intended use.",
      "Have IT select an appropriate MCP transport and review sign-in and data handling before implementation.",
      "Implement the Spej MCP adapter, identity mapping, source attribution, and access checks before connection.",
    ],
    docsUrl: "https://docs.plaud.ai/plaud-mcp-cli/mcp",
  },
];
