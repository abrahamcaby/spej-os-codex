"use client";

import { useId, useState } from "react";
import { Clock3, KeyRound, LockKeyhole, Plus, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import {
  ACCESS_CONTROL_REFERENCE_NOTICE,
  explainEffectivePortalAccess,
  isStableAccessId,
  type AccessCapability,
  type AccessDataScope,
  type AccessRole,
  type AccessSubject,
  type AccessTenantPolicy,
} from "@/lib/access-control";
import styles from "./access-management-panel.module.css";

export type AccessPortalOption = { readonly id: string; readonly label: string; readonly description?: string };
export type AccessFeatureOption = { readonly id: string; readonly label: string; readonly description?: string; readonly enabled: boolean; readonly expiresAt?: string };
export type AccessPrincipalOption = { readonly id: string; readonly label: string; readonly description?: string; readonly principalType: "person" | "service"; readonly status: "active" | "revoked" };
export type AccessAuditEvent = { readonly id: string; readonly occurredAt: string; readonly action: string; readonly detail: string };
export type AccessRecordGrantInput = { readonly portalId: string; readonly recordKind: string; readonly recordId: string; readonly capabilities: readonly AccessCapability[]; readonly expiresAt?: string };

export type AccessManagementPanelProps = {
  /** Display text only. Authorization always uses subject stable IDs. */
  readonly subjectLabel: string;
  readonly subject: AccessSubject;
  readonly roles: readonly AccessRole[];
  readonly portals: readonly AccessPortalOption[];
  readonly tenantPolicy?: AccessTenantPolicy;
  readonly principalOptions?: readonly AccessPrincipalOption[];
  readonly selectedPrincipalId?: string;
  readonly featureOptions?: readonly AccessFeatureOption[];
  readonly moduleFlags?: readonly AccessFeatureOption[];
  readonly dataScopes?: readonly AccessDataScope[];
  readonly actionCapabilities?: readonly AccessCapability[];
  readonly accessUntil?: string;
  readonly auditEvents?: readonly AccessAuditEvent[];
  readonly now?: Date;
  readonly readOnly?: boolean;
  readonly onPrincipalChange?: (principalId: string) => void;
  readonly onPrincipalStatusChange?: (status: "active" | "revoked") => void;
  readonly onRoleAccessChange?: (roleId: string, assigned: boolean) => void;
  readonly onPortalAccessChange?: (portalId: string, allowed: boolean) => void;
  readonly onFeatureAccessChange?: (featureId: string, enabled: boolean) => void;
  readonly onModuleFlagChange?: (portalId: string, enabled: boolean) => void;
  readonly onDataScopeChange?: (scope: AccessDataScope, enabled: boolean) => void;
  readonly onActionCapabilityChange?: (capability: AccessCapability, enabled: boolean) => void;
  readonly onAccessUntilChange?: (value: string) => void;
  readonly onAddRecordGrant?: (grant: AccessRecordGrantInput) => void;
  readonly onAddToolGrant?: (toolId: string, capability: AccessCapability, expiresAt?: string) => void;
  readonly onRemoveDirectRule?: (ruleId: string) => void;
};

const SCOPE_OPTIONS: readonly { id: AccessDataScope; label: string }[] = [
  { id: "own", label: "Owned by them" }, { id: "assigned", label: "Assigned to them" },
  { id: "team", label: "Their teams" }, { id: "company", label: "Entire company" },
];
const ACTION_OPTIONS: readonly { id: AccessCapability; label: string }[] = [
  { id: "view", label: "View" }, { id: "create", label: "Create" }, { id: "edit", label: "Edit" },
  { id: "approve", label: "Approve" }, { id: "export", label: "Export" }, { id: "delete", label: "Delete" },
];

function directRuleSummary(subject: AccessSubject, now: Date) {
  const active = (subject.directRules || []).filter((rule) => !rule.expiresAt || Date.parse(rule.expiresAt) > now.getTime());
  const selectedRecords = new Set(active.flatMap((rule) => rule.recordKinds?.includes("tool") ? [] : rule.recordIds || []));
  return { selectedRecords: selectedRecords.size, denies: active.filter((rule) => rule.effect === "deny").length, temporary: active.filter((rule) => rule.expiresAt).length };
}

function toLocalDateTime(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** Controlled preview UI. Production must persist changes through an authenticated access-administration service. */
export function AccessManagementPanel({
  subjectLabel, subject, roles, portals, tenantPolicy, principalOptions = [], selectedPrincipalId,
  featureOptions = [], moduleFlags = [], dataScopes = [], actionCapabilities = [], accessUntil = "", auditEvents = [],
  now = new Date(), readOnly = false, onPrincipalChange, onPrincipalStatusChange, onRoleAccessChange,
  onPortalAccessChange, onFeatureAccessChange, onModuleFlagChange, onDataScopeChange, onActionCapabilityChange,
  onAccessUntilChange, onAddRecordGrant, onAddToolGrant, onRemoveDirectRule,
}: AccessManagementPanelProps) {
  const headingId = useId();
  const accessUntilId = useId();
  const [recordPortal, setRecordPortal] = useState("projects");
  const [recordKind, setRecordKind] = useState("project");
  const [recordId, setRecordId] = useState("");
  const [recordExpiry, setRecordExpiry] = useState("");
  const [toolId, setToolId] = useState("");
  const [toolCapability, setToolCapability] = useState<AccessCapability>("view");
  const [toolExpiry, setToolExpiry] = useState("");
  const assignedRoles = new Set(subject.roleIds);
  const effective = explainEffectivePortalAccess({ subject, roles, portalIds: portals.map((portal) => portal.id), now, tenantPolicy });
  const portalById = new Map(effective.map((portal) => [portal.portalId, portal]));
  const direct = directRuleSummary(subject, now);
  const selectedPrincipal = principalOptions.find((option) => option.id === selectedPrincipalId);
  const exactRules = (subject.directRules || []).filter((rule) => rule.recordIds?.length && !rule.recordKinds?.includes("tool"));
  const toolRules = (subject.directRules || []).filter((rule) => rule.recordKinds?.includes("tool") && rule.recordIds?.length);

  return <section className={styles.root} aria-labelledby={headingId}>
    <header className={styles.header}><div className={styles.titleIcon}><ShieldCheck size={20} /></div><div><p className={styles.eyebrow}>Access design preview</p><h2 id={headingId}>{subjectLabel}</h2><p>Choose a starting role, then add only the access this identity needs.</p></div><span className={styles.subjectType}>{subject.principalType === "service" ? "Service account" : "Team member"}</span></header>
    <div className={styles.notice}><LockKeyhole size={15} /><span>{ACCESS_CONTROL_REFERENCE_NOTICE}</span></div>

    {principalOptions.length > 0 && <div className={styles.principalBar}>
      <label><span>Identity</span><select value={selectedPrincipalId} onChange={(event) => onPrincipalChange?.(event.target.value)} disabled={readOnly || !onPrincipalChange}>{principalOptions.map((option) => <option value={option.id} key={option.id}>{option.label} · {option.principalType === "service" ? "Service" : "Person"}</option>)}</select></label>
      <div><b>{selectedPrincipal?.description || "Preview identity"}</b><small>{selectedPrincipal?.status === "revoked" ? "Access revoked" : "Active access"}</small></div>
      <button className={selectedPrincipal?.status === "revoked" ? styles.restoreButton : styles.revokeButton} type="button" disabled={readOnly || !onPrincipalStatusChange} onClick={() => onPrincipalStatusChange?.(selectedPrincipal?.status === "revoked" ? "active" : "revoked")}>{selectedPrincipal?.status === "revoked" ? "Restore" : "Revoke"}</button>
    </div>}

    <div className={styles.summaryGrid}><div><span>Roles</span><strong>{subject.roleIds.length}</strong></div><div><span>Portals</span><strong>{effective.filter((portal) => portal.capabilities.includes("view")).length}</strong></div><div><span>Selected records</span><strong>{direct.selectedRecords}</strong></div><div><span>Active denies</span><strong>{direct.denies}</strong></div></div>

    <div className={styles.twoColumns}>
      <div className={styles.section}><div className={styles.sectionTitle}><UsersRound size={16} /><div><h3>Starting roles</h3><p>Roles provide safe defaults. Confidential records still need an exact grant.</p></div></div><div className={styles.optionGrid}>{roles.filter((role) => role.tenantId === subject.tenantId).map((role) => <label className={styles.option} key={role.id}><input type="checkbox" checked={assignedRoles.has(role.id)} disabled={readOnly || !onRoleAccessChange} onChange={(event) => onRoleAccessChange?.(role.id, event.target.checked)} /><span><b>{role.label}</b>{role.description && <small>{role.description}</small>}</span></label>)}</div></div>
      <div className={styles.section}><div className={styles.sectionTitle}><KeyRound size={16} /><div><h3>Portal visibility</h3><p>This controls navigation only. Data scope and actions are managed separately.</p></div></div><div className={styles.portalList}>{portals.map((portal) => { const allowed = Boolean(portalById.get(portal.id)?.capabilities.includes("view")); return <div className={styles.portalRow} key={portal.id}><div><b>{portal.label}</b>{portal.description && <small>{portal.description}</small>}</div><label className={styles.switch}><input aria-label={`${portal.label} visibility`} type="checkbox" checked={allowed} disabled={readOnly || !onPortalAccessChange} onChange={(event) => onPortalAccessChange?.(portal.id, event.target.checked)} /><span>{allowed ? "On" : "Off"}</span></label></div>; })}</div></div>
    </div>

    <div className={styles.section}><div className={styles.sectionTitle}><ShieldCheck size={16} /><div><h3>Additional data and actions</h3><p>Roles cover normal work. Use these controls only to extend an identity beyond its role.</p></div></div><div className={styles.permissionGrid}>
      <fieldset><legend>Data scope</legend>{SCOPE_OPTIONS.map((option) => <label key={option.id}><input type="checkbox" checked={dataScopes.includes(option.id)} disabled={readOnly || !onDataScopeChange} onChange={(event) => onDataScopeChange?.(option.id, event.target.checked)} /><span>{option.label}</span></label>)}</fieldset>
      <fieldset><legend>Allowed actions</legend>{ACTION_OPTIONS.map((option) => <label key={option.id}><input type="checkbox" checked={actionCapabilities.includes(option.id)} disabled={readOnly || !onActionCapabilityChange} onChange={(event) => onActionCapabilityChange?.(option.id, event.target.checked)} /><span>{option.label}</span></label>)}</fieldset>
    </div>{dataScopes.includes("company") && <p className={styles.warning}>Entire-company access can include every non-confidential record in an enabled portal. Use a narrower scope when possible.</p>}</div>

    <div className={styles.section}><div className={styles.sectionTitle}><LockKeyhole size={16} /><div><h3>Confidential record grants</h3><p>Invite this identity to one project, account, or file without opening the rest of the workspace.</p></div></div>
      <div className={styles.grantForm}><label><span>Portal</span><select value={recordPortal} onChange={(event) => setRecordPortal(event.target.value)}>{portals.filter((portal) => !["admin", "my-work", "sosa"].includes(portal.id)).map((portal) => <option value={portal.id} key={portal.id}>{portal.label}</option>)}</select></label><label><span>Record type</span><select value={recordKind} onChange={(event) => setRecordKind(event.target.value)}><option value="project">Project</option><option value="account">Account</option><option value="file">File</option></select></label><label><span>Stable record ID</span><input value={recordId} onChange={(event) => setRecordId(event.target.value)} placeholder="project-demo-01" aria-invalid={Boolean(recordId.trim()) && !isStableAccessId(recordId.trim())} /></label><label><span>Expires</span><input type="datetime-local" value={recordExpiry} onChange={(event) => setRecordExpiry(event.target.value)} /></label><button type="button" className="button button-secondary" disabled={readOnly || !onAddRecordGrant || !isStableAccessId(recordId.trim())} onClick={() => { onAddRecordGrant?.({ portalId: recordPortal, recordKind, recordId: recordId.trim(), capabilities: ["view"], ...(recordExpiry ? { expiresAt: new Date(recordExpiry).toISOString() } : {}) }); setRecordId(""); }}><Plus size={13} /> Add view access</button></div>
      {exactRules.length > 0 && <div className={styles.grantList}>{exactRules.map((rule) => <div key={rule.id}><span><b>{rule.recordKinds?.join(", ") || "record"}</b><small>{rule.recordIds?.join(", ")} · {rule.capabilities.join(", ")}{rule.expiresAt ? ` · until ${new Date(rule.expiresAt).toLocaleString()}` : ""}</small></span><button type="button" aria-label={`Remove ${rule.id}`} disabled={readOnly || !onRemoveDirectRule} onClick={() => onRemoveDirectRule?.(rule.id)}><Trash2 size={13} /></button></div>)}</div>}
    </div>

    {featureOptions.length > 0 && <div className={styles.section}><div className={styles.sectionTitle}><ShieldCheck size={16} /><div><h3>Identity features</h3><p>These switches participate in effective access; normal record and source permissions still apply.</p></div></div><div className={styles.optionGrid}>{featureOptions.map((option) => <label className={styles.option} key={option.id}><input type="checkbox" checked={option.enabled} disabled={readOnly || !onFeatureAccessChange} onChange={(event) => onFeatureAccessChange?.(option.id, event.target.checked)} /><span><b>{option.label}</b>{option.description && <small>{option.description}{option.expiresAt ? ` · until ${new Date(option.expiresAt).toLocaleString()}` : ""}</small>}</span></label>)}</div></div>}
    {moduleFlags.length > 0 && <div className={styles.section}><div className={styles.sectionTitle}><KeyRound size={16} /><div><h3>Company module flags</h3><p>A disabled module is unavailable to every role and direct grant in this tenant.</p></div></div><div className={styles.compactOptions}>{moduleFlags.map((option) => <label key={option.id}><input type="checkbox" checked={option.enabled} disabled={readOnly || !onModuleFlagChange} onChange={(event) => onModuleFlagChange?.(option.id, event.target.checked)} /><span>{option.label}</span></label>)}</div></div>}

    {subject.principalType === "service" && <div className={styles.section}><div className={styles.sectionTitle}><KeyRound size={16} /><div><h3>API and MCP tool allowlist</h3><p>Service accounts can call only exact tools. Rate limits and key rotation remain gateway controls.</p></div></div><div className={styles.toolForm}><input value={toolId} onChange={(event) => setToolId(event.target.value)} placeholder="crm.search" aria-label="Tool ID" aria-invalid={Boolean(toolId.trim()) && !isStableAccessId(toolId.trim())} /><select value={toolCapability} onChange={(event) => setToolCapability(event.target.value as AccessCapability)}><option value="view">Read</option><option value="create">Create</option><option value="edit">Edit</option><option value="approve">Approve</option><option value="export">Export</option></select><input aria-label="Tool access expiration" type="datetime-local" value={toolExpiry} onChange={(event) => setToolExpiry(event.target.value)} /><button type="button" className="button button-secondary" disabled={readOnly || !onAddToolGrant || !isStableAccessId(toolId.trim())} onClick={() => { onAddToolGrant?.(toolId.trim(), toolCapability, toolExpiry ? new Date(toolExpiry).toISOString() : undefined); setToolId(""); }}><Plus size={13} /> Allow tool</button></div>{toolRules.length > 0 && <div className={styles.grantList}>{toolRules.map((rule) => <div key={rule.id}><span><b>{rule.recordIds?.join(", ")}</b><small>{rule.capabilities.join(", ")}{rule.expiresAt ? ` · until ${new Date(rule.expiresAt).toLocaleString()}` : ""}</small></span><button type="button" aria-label={`Remove ${rule.id}`} disabled={readOnly || !onRemoveDirectRule} onClick={() => onRemoveDirectRule?.(rule.id)}><Trash2 size={13} /></button></div>)}</div>}</div>}

    <div className={styles.expiryRow}><Clock3 size={16} /><label htmlFor={accessUntilId}><b>All access ends</b><small>Applies to roles, direct grants, and identity features. Leave blank for ongoing access.</small></label><input id={accessUntilId} type="datetime-local" value={toLocalDateTime(accessUntil)} disabled={readOnly || !onAccessUntilChange} onChange={(event) => onAccessUntilChange?.(event.target.value)} /><span>{direct.temporary} active temporary rule{direct.temporary === 1 ? "" : "s"}</span></div>
    <div className={styles.section}><div className={styles.sectionTitle}><Clock3 size={16} /><div><h3>Access audit preview</h3><p>Production writes these events to the existing immutable audit service.</p></div></div><div className={styles.auditList}>{auditEvents.length ? auditEvents.slice(0, 6).map((event) => <div key={event.id}><time>{new Date(event.occurredAt).toLocaleString()}</time><b>{event.action}</b><span>{event.detail}</span></div>) : <p>No preview access changes yet.</p>}</div></div>
  </section>;
}
