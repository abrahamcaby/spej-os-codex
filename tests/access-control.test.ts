import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluatePortalAccess,
  evaluateRecordAccess,
  evaluateFieldAccess,
  evaluateToolAccess,
  explainEffectivePortalAccess,
  filterAuthorizedRecords,
  type AccessRole,
  type AccessRule,
  type AccessSubject,
} from "../lib/access-control";

const TENANT = "tenant-spej";
const NOW = new Date("2026-09-03T16:00:00.000Z");

function rule(overrides: Partial<AccessRule> = {}): AccessRule {
  return {
    id: "rule-default",
    tenantId: TENANT,
    effect: "allow",
    portalIds: ["my-work"],
    capabilities: ["view"],
    scopes: ["assigned"],
    ...overrides,
  };
}

function role(id: string, rules: readonly AccessRule[]): AccessRole {
  return { id, tenantId: TENANT, label: id, rules };
}

function subject(overrides: Partial<AccessSubject> = {}): AccessSubject {
  return {
    principalId: "entra:employee-1",
    tenantId: TENANT,
    profileId: "profile-employee-1",
    roleIds: [],
    teamIds: [],
    ...overrides,
  };
}

test("a new employee can use assigned work without gaining CRM lead-list access", () => {
  const employeeRole = role("role-project-member", [
    rule({
      id: "rule-project-member",
      portalIds: ["my-work", "projects"],
      capabilities: ["view", "edit"],
      scopes: ["assigned"],
    }),
  ]);
  const employee = subject({ roleIds: [employeeRole.id] });
  assert.equal(evaluatePortalAccess({ subject: employee, roles: [employeeRole], portalId: "my-work", now: NOW }).allowed, true);
  assert.equal(evaluatePortalAccess({ subject: employee, roles: [employeeRole], portalId: "crm", now: NOW }).allowed, false);

  const assignedProject = {
    tenantId: TENANT,
    portalId: "projects",
    kind: "project",
    id: "project-assigned",
    assigneeProfileIds: [employee.profileId!],
  };
  const unassignedLead = {
    tenantId: TENANT,
    portalId: "crm",
    kind: "lead",
    id: "lead-private-list",
    assigneeProfileIds: ["profile-gtm-owner"],
  };
  assert.equal(evaluateRecordAccess({ subject: employee, roles: [employeeRole], resource: assignedProject, now: NOW }).allowed, true);
  assert.equal(evaluateRecordAccess({ subject: employee, roles: [employeeRole], resource: unassignedLead, now: NOW }).allowed, false);
});

test("a temporary contractor grant exposes GTM only during its approved window", () => {
  const temporaryGtm = rule({
    id: "grant-contractor-gtm",
    portalIds: ["gtm"],
    capabilities: ["view", "edit"],
    scopes: ["team"],
    startsAt: "2026-09-01T00:00:00.000Z",
    expiresAt: "2026-09-10T00:00:00.000Z",
  });
  const contractor = subject({
    principalId: "entra:contractor-7",
    profileId: "profile-contractor-7",
    teamIds: ["team-gtm"],
    directRules: [temporaryGtm],
  });
  const campaign = {
    tenantId: TENANT,
    portalId: "gtm",
    kind: "campaign",
    id: "campaign-1",
    teamIds: ["team-gtm"],
  };
  assert.equal(evaluatePortalAccess({ subject: contractor, roles: [], portalId: "gtm", now: NOW }).allowed, true);
  assert.equal(evaluateRecordAccess({ subject: contractor, roles: [], resource: campaign, now: NOW }).allowed, true);

  const expired = evaluateRecordAccess({
    subject: contractor,
    roles: [],
    resource: campaign,
    now: new Date("2026-09-11T00:00:00.000Z"),
  });
  assert.equal(expired.allowed, false);
  assert.deepEqual(expired.ignoredExpiredRuleIds, [temporaryGtm.id]);
  assert.equal(evaluatePortalAccess({ subject: contractor, roles: [], portalId: "crm", now: NOW }).allowed, false);
});

test("a confidential project stays hidden until an exact record grant is active", () => {
  const companyProjects = role("role-operations", [
    rule({ id: "rule-company-projects", portalIds: ["projects"], capabilities: ["view"], scopes: ["company"] }),
  ]);
  const confidentialProject = {
    tenantId: TENANT,
    portalId: "projects",
    kind: "project",
    id: "project-confidential-merger",
    confidential: true,
  } as const;
  const operator = subject({ roleIds: [companyProjects.id] });
  const withoutInvitation = evaluateRecordAccess({ subject: operator, roles: [companyProjects], resource: confidentialProject, now: NOW });
  assert.equal(withoutInvitation.allowed, false);
  assert.equal(withoutInvitation.code, "confidential-record");

  const invited = subject({
    roleIds: [companyProjects.id],
    directRules: [rule({
      id: "grant-confidential-project",
      portalIds: ["projects"],
      capabilities: ["view"],
      scopes: ["selected-records"],
      recordKinds: ["project"],
      recordIds: [confidentialProject.id],
    })],
  });
  assert.equal(evaluateRecordAccess({ subject: invited, roles: [companyProjects], resource: confidentialProject, now: NOW }).allowed, true);
});

test("an expired exact grant cannot disclose a confidential record", () => {
  const projectsRole = role("role-project-viewer", [
    rule({ id: "allow-projects-portal", portalIds: ["projects"], capabilities: ["view"], scopes: ["company"] }),
  ]);
  const expiredGrant = rule({
    id: "grant-expired-project",
    portalIds: ["projects"],
    capabilities: ["view"],
    scopes: ["selected-records"],
    recordIds: ["project-secret"],
    expiresAt: "2026-09-02T00:00:00.000Z",
  });
  const viewer = subject({ roleIds: [projectsRole.id], directRules: [expiredGrant] });
  const decision = evaluateRecordAccess({
    subject: viewer,
    roles: [projectsRole],
    resource: { tenantId: TENANT, portalId: "projects", kind: "project", id: "project-secret", confidential: true },
    now: NOW,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "confidential-record");
  assert.deepEqual(decision.ignoredExpiredRuleIds, [expiredGrant.id]);
});

test("an explicit denial takes precedence over role and direct grants", () => {
  const gtmRole = role("role-gtm", [
    rule({ id: "allow-gtm", portalIds: ["gtm"], capabilities: ["view", "export"], scopes: ["company"] }),
  ]);
  const blockedAccount = "account-no-export";
  const user = subject({
    roleIds: [gtmRole.id],
    directRules: [
      rule({
        id: "allow-account-direct",
        portalIds: ["gtm"],
        capabilities: ["export"],
        scopes: ["selected-records"],
        recordIds: [blockedAccount],
      }),
      rule({
        id: "deny-account-export",
        effect: "deny",
        portalIds: ["gtm"],
        capabilities: ["export"],
        scopes: ["selected-records"],
        recordIds: [blockedAccount],
      }),
    ],
  });
  const decision = evaluateRecordAccess({
    subject: user,
    roles: [gtmRole],
    resource: { tenantId: TENANT, portalId: "gtm", kind: "account", id: blockedAccount },
    capability: "export",
    now: NOW,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "explicit-deny");
  assert.deepEqual(decision.matchedDenyRuleIds, ["deny-account-export"]);
});

test("access administration is a separate overlay and does not imply record visibility", () => {
  const adminRole = role("role-access-admin", [
    rule({ id: "rule-access-admin", portalIds: ["admin"], capabilities: ["view", "admin"], scopes: ["company"] }),
  ]);
  const administrator = subject({ roleIds: [adminRole.id] });
  assert.equal(evaluatePortalAccess({ subject: administrator, roles: [adminRole], portalId: "admin", capability: "admin", now: NOW }).allowed, true);
  assert.equal(evaluatePortalAccess({ subject: administrator, roles: [adminRole], portalId: "crm", now: NOW }).allowed, false);
  assert.equal(evaluateRecordAccess({
    subject: administrator,
    roles: [adminRole],
    resource: { tenantId: TENANT, portalId: "projects", kind: "project", id: "project-confidential", confidential: true },
    now: NOW,
  }).allowed, false);

  const explained = explainEffectivePortalAccess({
    subject: administrator,
    roles: [adminRole],
    portalIds: ["admin", "crm"],
    now: NOW,
  });
  assert.deepEqual(explained.find((portal) => portal.portalId === "admin")?.capabilities, ["view", "admin"]);
  assert.deepEqual(explained.find((portal) => portal.portalId === "crm")?.capabilities, []);
});

test("search and SOSA context filtering removes denied and cross-tenant records before use", () => {
  const assignedRole = role("role-assigned", [
    rule({ id: "rule-assigned", portalIds: ["crm"], capabilities: ["view"], scopes: ["assigned"] }),
  ]);
  const viewer = subject({ roleIds: [assignedRole.id] });
  const records = [
    { tenantId: TENANT, portalId: "crm", kind: "account", id: "account-allowed", assigneeProfileIds: [viewer.profileId!], snippet: "Allowed context" },
    { tenantId: TENANT, portalId: "crm", kind: "account", id: "account-denied", assigneeProfileIds: ["someone-else"], snippet: "Denied context" },
    { tenantId: "tenant-other", portalId: "crm", kind: "account", id: "account-other", assigneeProfileIds: [viewer.profileId!], snippet: "Other tenant" },
  ];
  const authorized = filterAuthorizedRecords({ subject: viewer, roles: [assignedRole], records, now: NOW });
  assert.deepEqual(authorized.map((record) => record.id), ["account-allowed"]);
  assert.deepEqual(authorized.map((record) => record.snippet), ["Allowed context"]);
});

test("ownership uses a stable profile ID and never a display name", () => {
  const ownerRole = role("role-owner", [
    rule({ id: "rule-owner", portalIds: ["my-work"], capabilities: ["view"], scopes: ["own"] }),
  ]);
  const viewer = subject({ profileId: "profile-stable-42", roleIds: [ownerRole.id] });
  assert.equal(evaluateRecordAccess({
    subject: viewer,
    roles: [ownerRole],
    resource: { tenantId: TENANT, portalId: "my-work", kind: "task", id: "task-1", ownerProfileId: "profile-stable-42" },
    now: NOW,
  }).allowed, true);
  assert.equal(evaluateRecordAccess({
    subject: viewer,
    roles: [ownerRole],
    resource: { tenantId: TENANT, portalId: "my-work", kind: "task", id: "task-2", ownerProfileId: "Employee One" },
    now: NOW,
  }).allowed, false);
});

test("cross-tenant access fails before otherwise broad company rules", () => {
  const broadRole = role("role-company", [
    rule({ id: "rule-company", portalIds: ["crm"], capabilities: ["view"], scopes: ["company"] }),
  ]);
  const viewer = subject({ roleIds: [broadRole.id] });
  const decision = evaluateRecordAccess({
    subject: viewer,
    roles: [broadRole],
    resource: { tenantId: "tenant-other", portalId: "crm", kind: "lead", id: "lead-other" },
    now: NOW,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "cross-tenant");
});

test("an exact record grant does not bypass portal access", () => {
  const exactOnly = subject({
    directRules: [rule({
      id: "grant-record-without-portal",
      portalIds: ["crm"],
      capabilities: ["view"],
      scopes: ["selected-records"],
      recordIds: ["account-1"],
    })],
  });
  assert.equal(evaluatePortalAccess({ subject: exactOnly, roles: [], portalId: "crm", now: NOW }).allowed, false);
  assert.equal(evaluateRecordAccess({
    subject: exactOnly,
    roles: [],
    resource: { tenantId: TENANT, portalId: "crm", kind: "account", id: "account-1" },
    now: NOW,
  }).allowed, false);
});

test("protected fields require field-specific access and field denies override it", () => {
  const crmRole = role("role-crm", [
    rule({ id: "allow-crm-record", portalIds: ["crm"], capabilities: ["view"], scopes: ["company"] }),
  ]);
  const account = { tenantId: TENANT, portalId: "crm", kind: "account", id: "account-1" } as const;
  const baseViewer = subject({ roleIds: [crmRole.id] });
  assert.equal(evaluateFieldAccess({
    subject: baseViewer,
    roles: [crmRole],
    resource: account,
    fieldId: "forecast-value",
    restricted: true,
    now: NOW,
  }).code, "restricted-field");

  const fieldViewer = subject({
    roleIds: [crmRole.id],
    directRules: [rule({
      id: "allow-forecast-field",
      portalIds: ["crm"],
      capabilities: ["view"],
      scopes: ["company"],
      recordKinds: ["account"],
      fieldIds: ["forecast-value"],
    })],
  });
  assert.equal(evaluateFieldAccess({
    subject: fieldViewer,
    roles: [crmRole],
    resource: account,
    fieldId: "forecast-value",
    restricted: true,
    now: NOW,
  }).allowed, true);

  const deniedViewer = subject({
    ...fieldViewer,
    directRules: [
      ...fieldViewer.directRules!,
      rule({
        id: "deny-forecast-field",
        effect: "deny",
        portalIds: ["crm"],
        capabilities: ["view"],
        scopes: ["company"],
        fieldIds: ["forecast-value"],
      }),
    ],
  });
  assert.equal(evaluateFieldAccess({
    subject: deniedViewer,
    roles: [crmRole],
    resource: account,
    fieldId: "forecast-value",
    restricted: true,
    now: NOW,
  }).code, "explicit-deny");
});

test("tenant feature flags and credential revocation close every access path", () => {
  const broadRole = role("role-broad", [
    rule({ id: "allow-broad", portalIds: ["crm"], capabilities: ["view"], scopes: ["company"] }),
  ]);
  const viewer = subject({ roleIds: [broadRole.id] });
  const resource = { tenantId: TENANT, portalId: "crm", kind: "account", id: "account-1" } as const;
  assert.equal(evaluateRecordAccess({
    subject: viewer,
    roles: [broadRole],
    resource,
    tenantPolicy: { tenantId: TENANT, disabledPortalIds: ["crm"] },
    now: NOW,
  }).code, "portal-disabled");
  assert.equal(evaluateRecordAccess({
    subject: viewer,
    roles: [broadRole],
    resource,
    tenantPolicy: { tenantId: TENANT, revokedPrincipalIds: [viewer.principalId] },
    now: NOW,
  }).code, "principal-revoked");
  assert.deepEqual(filterAuthorizedRecords({
    subject: viewer,
    roles: [broadRole],
    records: [resource],
    tenantPolicy: { tenantId: TENANT, disabledPortalIds: ["crm"] },
    now: NOW,
  }), []);
});

test("service principals need an exact tenant-scoped tool allowlist entry", () => {
  const agentRole = role("role-agent-service", [
    rule({ id: "allow-sosa-portal", portalIds: ["sosa"], capabilities: ["view", "edit"], scopes: ["company"] }),
  ]);
  const service = subject({
    principalId: "service:teams-bot",
    profileId: undefined,
    principalType: "service",
    roleIds: [agentRole.id],
    directRules: [rule({
      id: "allow-tool-crm-search",
      portalIds: ["sosa"],
      capabilities: ["view"],
      scopes: ["selected-records"],
      recordKinds: ["tool"],
      recordIds: ["crm.search"],
    })],
  });
  assert.equal(evaluateToolAccess({ subject: service, roles: [agentRole], tenantId: TENANT, toolId: "crm.search", now: NOW }).allowed, true);
  assert.equal(evaluateToolAccess({ subject: service, roles: [agentRole], tenantId: TENANT, toolId: "crm.export", now: NOW }).allowed, false);
  assert.equal(evaluateToolAccess({ subject: service, roles: [agentRole], tenantId: "tenant-other", toolId: "crm.search", now: NOW }).code, "cross-tenant");
});

test("portal visibility is separate from record scope and action authority", () => {
  const separatedRole = role("role-separated", [
    rule({ id: "portal-only", boundary: "portal", portalIds: ["projects"], capabilities: ["view"], scopes: ["company"] }),
    rule({ id: "assigned-records", boundary: "records", portalIds: ["projects"], capabilities: ["view", "edit"], scopes: ["assigned"] }),
  ]);
  const viewer = subject({ roleIds: [separatedRole.id] });
  const assigned = { tenantId: TENANT, portalId: "projects", kind: "project", id: "project-assigned", assigneeProfileIds: [viewer.profileId!] } as const;
  const unassigned = { ...assigned, id: "project-unassigned", assigneeProfileIds: ["profile-other"] };
  assert.equal(evaluatePortalAccess({ subject: viewer, roles: [separatedRole], portalId: "projects", now: NOW }).allowed, true);
  assert.equal(evaluatePortalAccess({ subject: viewer, roles: [separatedRole], portalId: "projects", capability: "edit", now: NOW }).allowed, false);
  assert.equal(evaluateRecordAccess({ subject: viewer, roles: [separatedRole], resource: assigned, capability: "edit", now: NOW }).allowed, true);
  assert.equal(evaluateRecordAccess({ subject: viewer, roles: [separatedRole], resource: unassigned, capability: "view", now: NOW }).allowed, false);
});

test("identity feature switches gate connected records without replacing source permissions", () => {
  const documentRole = role("role-documents", [
    rule({ id: "docs-portal", boundary: "portal", portalIds: ["projects"], capabilities: ["view"], scopes: ["company"] }),
    rule({ id: "docs-team", boundary: "records", portalIds: ["projects"], capabilities: ["view"], scopes: ["team"] }),
  ]);
  const document = { tenantId: TENANT, portalId: "projects", kind: "file", id: "file-1", teamIds: ["team-delivery"], requiredFeatureIds: ["teams-files"] } as const;
  const withoutFeature = subject({ roleIds: [documentRole.id], teamIds: ["team-delivery"], featureIds: [] });
  const withFeature = subject({ ...withoutFeature, featureIds: ["teams-files"] });
  assert.equal(evaluateRecordAccess({ subject: withoutFeature, roles: [documentRole], resource: document, now: NOW }).code, "feature-disabled");
  assert.equal(evaluateRecordAccess({ subject: withFeature, roles: [documentRole], resource: document, now: NOW }).allowed, true);
});

test("invalid rules fail closed and return stable IDs for audit evidence", () => {
  const malformed = role("role-malformed", [
    rule({ id: "invalid-expiry-rule", expiresAt: "not-a-date" }),
    rule({ id: "invalid-capabilities-rule", capabilities: null as never }),
  ]);
  const decision = evaluatePortalAccess({ subject: subject({ roleIds: [malformed.id] }), roles: [malformed], portalId: "my-work", now: NOW });
  assert.equal(decision.allowed, false);
  assert.deepEqual(decision.ignoredInvalidRuleIds, ["invalid-expiry-rule", "invalid-capabilities-rule"]);
});
