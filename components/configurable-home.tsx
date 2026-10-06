"use client";

import { useState } from "react";
import { RoleHomeSummary, type RoleHomeSummaryProps } from "./personal-home";
import { getRoleHomeModules, TEAM_HOME_MODULES } from "@/lib/team-views";
import { homeLayoutKey, moveHomeModule, normalizeHomeLayout, resolveHomeModules, type HomeLayout, type HomeModuleId } from "@/lib/home-layout";
import { developmentStyles as styles } from "./customer-development-styles";

type Props = RoleHomeSummaryProps & { grantedModuleIds: readonly HomeModuleId[]; canViewTab: (route: string) => boolean };
/** Browser-local layout preferences, never authorization. Production still needs server-filtered records. */
export function ConfigurableHome(props: Props) {
  const profileId = props.viewer.profileId || "unknown";
  const defaults: HomeLayout = { version: 1, scope: "mine", selectedModuleIds: getRoleHomeModules({ profileId }).map((module) => module.id) };
  const [layout, setLayout] = useState<HomeLayout>(defaults);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<Record<string, HomeLayout>>({});
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState("");
  // Load only after the initial render, preserving server/client hydration parity.
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  if (node && !loaded) {
    let restored = defaults, views: Record<string, HomeLayout> = {};
    try {
      const raw = JSON.parse(localStorage.getItem(homeLayoutKey(profileId)) || "null");
      restored = normalizeHomeLayout(raw?.layout, defaults);
      if (Array.isArray(raw?.views)) views = Object.fromEntries(raw.views.slice(0, 12).filter((entry: unknown) => Array.isArray(entry) && typeof entry[0] === "string" && entry[0].trim()).map(([label, value]: [string, unknown]) => [label.slice(0, 60), normalizeHomeLayout(value, defaults)]));
    } catch { /* Missing or malformed storage must not block My Work. */ }
    setLayout(restored); setSaved(views); setLoaded(true);
  }
  const persist = (next: HomeLayout, views = saved) => {
    setLayout(next); setSaved(views); setNotice("");
    try { localStorage.setItem(homeLayoutKey(profileId), JSON.stringify({ layout: next, views: Object.entries(views) })); }
    catch { setNotice("This browser cannot save preferences. Your choices work until this page closes."); }
  };
  const available = TEAM_HOME_MODULES.filter((module) => props.grantedModuleIds.includes(module.id) && props.canViewTab(module.route));
  const modules = resolveHomeModules(layout, props.grantedModuleIds, props.canViewTab);
  // Keep permitted lookup records intact: assignment can mean approver/check-in
  // owner, and task classification needs its project's area even for a different owner.
  const withinScope = <T,>(rows: T[]) => rows;
  const accounts = props.canViewTab("relationships") ? props.accounts : [];
  return <div ref={setNode}><details className={`${styles.panel} panel`} style={{ padding: 16, marginBottom: 16 }}><summary>Customize my view</summary><p>Choose shared components, not a custom dashboard per person. Your administrator controls availability; your choices only change this browser’s layout.</p><div className={styles.fields}><label>Record scope<select value={layout.scope} onChange={(e) => persist({ ...layout, scope: e.target.value as HomeLayout["scope"] })}><option value="mine">My assigned records</option><option value="visible-workspace">Available demo workspace records</option></select></label></div><div className={styles.editor}>{available.map((module) => <label key={module.id}><input type="checkbox" checked={layout.selectedModuleIds.includes(module.id)} onChange={(e) => persist({ ...layout, selectedModuleIds: e.target.checked ? [...layout.selectedModuleIds, module.id] : layout.selectedModuleIds.filter((id) => id !== module.id) })}/> {module.label}</label>)}</div><p>Display order</p>{modules.map((module, index) => <div key={module.id} className={styles.summary}><span>{index + 1}. {module.label}</span><button type="button" aria-label={`Move ${module.label} up`} disabled={index === 0} onClick={() => persist(moveHomeModule({ ...layout, selectedModuleIds: modules.map((item) => item.id) }, module.id, -1))}>↑</button><button type="button" aria-label={`Move ${module.label} down`} disabled={index === modules.length - 1} onClick={() => persist(moveHomeModule({ ...layout, selectedModuleIds: modules.map((item) => item.id) }, module.id, 1))}>↓</button></div>)}<div className={styles.editor}><button type="button" className="button button-secondary" onClick={() => persist(defaults)}>Reset to team template</button><label>Save this view as <input maxLength={60} value={name} onChange={(e) => setName(e.target.value)}/></label><button type="button" className="button button-secondary" disabled={!name.trim() || Object.keys(saved).length >= 12} onClick={() => { persist(layout, { ...saved, [name.trim()]: layout }); setName(""); }}>Save named view</button>{Object.entries(saved).map(([label, view]) => <div className={styles.summary} key={label}><button type="button" onClick={() => persist(view)}>Load {label}</button><button type="button" aria-label={`Delete saved view ${label}`} onClick={() => persist(layout, Object.fromEntries(Object.entries(saved).filter(([key]) => key !== label)))}>Remove</button></div>)}</div>{notice && <p role="status">{notice}</p>}<p>Demo access controls are not production sign-in or server-side data security.</p></details>
    {!modules.length ? <p className="panel" style={{ padding: 16 }}>No optional components selected or available. Choose components above; your assigned work remains available.</p> : <RoleHomeSummary {...props} selectedModules={modules} scope={layout.scope} accounts={accounts} contacts={props.contacts.filter((contact) => accounts.some((account) => account.id === contact.accountId))} opportunities={props.canViewTab("pipeline") ? withinScope(props.opportunities) : []} partnerships={props.canViewTab("relationships") ? withinScope(props.partnerships) : []} projects={props.canViewTab("projects") ? withinScope(props.projects) : []} campaigns={props.canViewTab("campaigns") ? withinScope(props.campaigns) : []} content={props.canViewTab("content") ? withinScope(props.content) : []} tasks={withinScope(props.tasks)}/>}
  </div>;
}
