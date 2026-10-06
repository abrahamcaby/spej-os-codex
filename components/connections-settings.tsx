"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { ArrowDownToLine, ChevronDown, Copy, Link2, ShieldCheck, Trash2 } from "lucide-react";
import { CONNECTION_CATALOG } from "@/lib/integrations/connection-catalog";
import { buildConnectionHandoff, cleanConnectionPlan, emptyConnectionPlan, type ConnectionPlan, type ConnectionScope, type ConnectionSelection } from "@/lib/integrations/connection-plan";

type ConnectionDefinition = (typeof CONNECTION_CATALOG)[number];
type PlanSnapshot = { plan: ConnectionPlan; loaded: boolean; notice: string; blocked: boolean };
type PlanStorage = Pick<Storage, "getItem" | "setItem">;
const temporaryNotice = "Browser storage is unavailable. Changes last only while these settings remain open. Download your plan to keep it.";

/** A fresh store per mounted profile; no browser APIs run during server rendering. */
export function createConnectionPlanStore(profileId: string, storageAccess: () => PlanStorage = () => window.localStorage) {
  const key = `spej:connection-plan:v1:${encodeURIComponent(profileId)}`;
  const serverSnapshot: PlanSnapshot = { plan: emptyConnectionPlan(profileId), loaded: false, notice: "", blocked: false };
  let snapshot = serverSnapshot;
  const listeners = new Set<() => void>();
  const publish = (next: PlanSnapshot) => { snapshot = next; listeners.forEach((listener) => listener()); };

  const load = () => {
    let raw: string | null;
    try { raw = storageAccess().getItem(key); }
    catch { publish({ ...snapshot, loaded: true, notice: temporaryNotice }); return; }
    try {
      const plan = raw === null ? emptyConnectionPlan(profileId) : cleanConnectionPlan(JSON.parse(raw), profileId);
      publish({ plan, loaded: true, notice: "", blocked: false });
    } catch {
      publish({ plan: emptyConnectionPlan(profileId), loaded: true, blocked: true, notice: "This browser has a saved plan that cannot be safely loaded for this profile. It has not been changed. Back it up and reset it to start a new plan." });
    }
  };
  const onStorage = (event: StorageEvent) => { if (event.key === key || event.key === null) load(); };
  const save = (plan: ConnectionPlan) => {
    if (!snapshot.loaded || snapshot.blocked) return false;
    let cleaned: ConnectionPlan;
    try { cleaned = cleanConnectionPlan(plan, profileId); }
    catch {
      publish({ ...snapshot, notice: "This selection could not be saved because the available connection options changed or are invalid. Your previous plan is unchanged. Reload these settings and choose the capabilities again." });
      return false;
    }
    let notice = "";
    try { storageAccess().setItem(key, JSON.stringify(cleaned)); }
    catch { notice = temporaryNotice; }
    publish({ plan: cleaned, loaded: true, notice, blocked: false });
    return true;
  };

  return {
    key,
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      if (listeners.size === 1 && typeof window !== "undefined") window.addEventListener("storage", onStorage);
      if (!snapshot.loaded) load();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && typeof window !== "undefined") window.removeEventListener("storage", onStorage);
      };
    },
    saveSelection: (selection: ConnectionSelection) => save({ ...snapshot.plan, selections: [
      ...snapshot.plan.selections.filter((item) => item.providerId !== selection.providerId || item.scope !== selection.scope),
      selection,
    ] }),
    removeSelection: (providerId: string, scope: ConnectionScope) => save({ ...snapshot.plan, selections: snapshot.plan.selections.filter((item) => item.providerId !== providerId || item.scope !== scope) }),
    reset: () => {
      try {
        const storage = storageAccess();
        const raw = storage.getItem(key);
        if (raw !== null) {
          let suffix = Date.now();
          while (storage.getItem(`${key}:recovery:${suffix}`) !== null) suffix += 1;
          storage.setItem(`${key}:recovery:${suffix}`, raw);
        }
        const plan = emptyConnectionPlan(profileId);
        storage.setItem(key, JSON.stringify(plan));
        publish({ plan, loaded: true, blocked: false, notice: "A fresh local plan is ready. Any previous saved data was backed up in this browser." });
      } catch {
        publish({ ...snapshot, notice: "The saved plan could not be backed up and reset. Nothing was removed. Allow browser storage and try again." });
      }
    },
  };
}

function ConnectionCard({ definition, scope, selection, disabled, onSave }: {
  definition: ConnectionDefinition;
  scope: ConnectionScope;
  selection: ConnectionSelection | undefined;
  disabled: boolean;
  onSave: (selection: ConnectionSelection) => boolean;
}) {
  const id = useId();
  const [capabilityIds, setCapabilityIds] = useState<string[]>(selection?.capabilityIds || []);
  const [showWrite, setShowWrite] = useState(() => definition.capabilities.some((capability) => capability.access === "write" && selection?.capabilityIds.includes(capability.id)));
  const savedCapabilities = selection?.capabilityIds.join(",") || "";
  const [previousSavedCapabilities, setPreviousSavedCapabilities] = useState(savedCapabilities);
  const [savedNotice, setSavedNotice] = useState("");
  if (previousSavedCapabilities !== savedCapabilities) {
    setPreviousSavedCapabilities(savedCapabilities);
    setCapabilityIds(selection?.capabilityIds || []);
    setShowWrite(definition.capabilities.some((capability) => capability.access === "write" && selection?.capabilityIds.includes(capability.id)));
    if (!selection) setSavedNotice("");
  }
  const readCapabilities = definition.capabilities.filter((capability) => capability.access === "read");
  const writeCapabilities = definition.capabilities.filter((capability) => capability.access === "write");
  const toggleCapability = (capabilityId: string) => {
    setCapabilityIds((current) => current.includes(capabilityId) ? current.filter((value) => value !== capabilityId) : [...current, capabilityId]);
    setSavedNotice("");
  };
  const capabilityFields = (capabilities: typeof definition.capabilities) => capabilities.map((capability) => <label className="connections-capability" key={capability.id}>
    <input type="checkbox" checked={capabilityIds.includes(capability.id)} disabled={disabled} onChange={() => toggleCapability(capability.id)} />
    <span><strong>{capability.label}</strong><small>{capability.description}</small></span>
  </label>);

  return <article className="connections-card" aria-labelledby={`${id}-name`}>
    <div className="connections-card-heading">
      <div className="connections-provider-mark" aria-hidden="true">{definition.name.split(/[ /]+/).map((part) => part.charAt(0)).slice(0, 2).join("")}</div>
      <div><h3 id={`${id}-name`}>{definition.name}</h3><span className="connections-status"><i aria-hidden="true" />Not connected</span></div>
      {selection ? <span className="connections-planned">In your plan</span> : null}
    </div>
    <p className="connections-card-summary">{definition.summary}</p>
    <div className="connections-card-meta"><span>Last sync: Never</span><span>{scope === "personal" ? "Personal scope" : "Company scope"}</span></div>
    <details className="connections-card-details">
      <summary><span>{selection ? "Edit connection plan" : "Plan connection"}</span><ChevronDown size={16} aria-hidden="true" /></summary>
      <div className="connections-card-body">
        <fieldset disabled={disabled} className="connections-capabilities">
          <legend>What would you like Spej to use?</legend>
          <p className="connections-help">Start with read-only access. Choose only what you need.</p>
          {capabilityFields(readCapabilities)}
          {writeCapabilities.length ? <div className="connections-write-options">
            <label className="connections-write-toggle"><input type="checkbox" checked={showWrite} onChange={(event) => {
              setShowWrite(event.target.checked);
              if (!event.target.checked) setCapabilityIds((current) => current.filter((value) => !writeCapabilities.some((capability) => capability.id === value)));
              setSavedNotice("");
            }} /><span>Include write capabilities in this plan</span></label>
            {showWrite ? <div className="connections-write-fields"><p className="connections-help">These are requests for review. No permission is granted and no action runs here.</p>{capabilityFields(writeCapabilities)}</div> : null}
          </div> : null}
        </fieldset>
        <div className="connections-destinations"><h4>Where data would appear</h4><div>{definition.surfaces.map((surface) => <span key={surface}>{surface}</span>)}</div><p className="connections-help">After a supported connection is implemented and access is approved.</p></div>
        <details className="connections-setup"><summary>Setup steps for your IT team</summary><div><p className="connections-help">{definition.transport}</p><p className="connections-help">{definition.foundation}</p><ol>{definition.setupSteps.map((step) => <li key={step}>{step}</li>)}</ol><a href={definition.docsUrl} target="_blank" rel="noreferrer">Provider documentation <span aria-hidden="true">↗</span></a></div></details>
        <button type="button" className="connections-button connections-button-primary" disabled={disabled || capabilityIds.length === 0} onClick={() => {
          const saved = onSave({ providerId: definition.id, scope, capabilityIds });
          setSavedNotice(saved ? selection ? "Connection plan updated. Not sent to IT." : "Added to your local plan. Not sent to IT." : "Selection was not saved. Your previous plan is unchanged.");
        }}>{selection ? "Update connection plan" : "Add to connection plan"}</button>
        <p className="connections-help">Saved in this browser for the selected profile. Not submitted or approved.</p>
        {savedNotice ? <p role="status" className="connections-saved-notice">{savedNotice}</p> : null}
      </div>
    </details>
  </article>;
}

function ProfileConnectionsSettings({ profileId, profileName }: { profileId: string; profileName: string }) {
  const id = useId();
  const [scope, setScope] = useState<ConnectionScope>("personal");
  const [store] = useState(() => createConnectionPlanStore(profileId));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [handoffNotice, setHandoffNotice] = useState("");
  const [manualCopy, setManualCopy] = useState(false);
  const available = CONNECTION_CATALOG.filter((definition) => definition.scopes.includes(scope));
  const handoff = buildConnectionHandoff(snapshot.plan);
  const hasPlan = snapshot.plan.selections.length > 0;
  const saveSelection = (selection: ConnectionSelection) => {
    const saved = store.saveSelection(selection);
    setHandoffNotice("");
    return saved;
  };
  const copyPlan = async () => {
    try {
      await navigator.clipboard.writeText(handoff);
      setHandoffNotice("Copy requested. Use View plan if your clipboard is empty.");
    } catch {
      setManualCopy(true);
      setHandoffNotice("Automatic copy is unavailable. Select the plan below and copy it manually.");
    }
  };
  const downloadPlan = () => {
    let url = "";
    try {
      url = URL.createObjectURL(new Blob([handoff], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "spej-connection-plan.json";
      link.click();
      setHandoffNotice("Download requested. If it does not appear, use View plan to copy it.");
    } catch {
      setManualCopy(true);
      setHandoffNotice("The download could not start. You can copy the plan below instead.");
    } finally {
      if (url) window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  return <section className="connections-settings" aria-labelledby={`${id}-title`}>
    <header className="connections-heading"><div className="connections-heading-icon"><Link2 size={21} aria-hidden="true" /></div><div><p className="connections-eyebrow">Your workspace, connected</p><h2 id={`${id}-title`}>Integrations &amp; Connections</h2><p>Choose the tools and information you want to bring into Spej.</p></div></header>
    <div className="connections-planning-note"><ShieldCheck size={19} aria-hidden="true" /><p>This is a connection planner. Adding a tool does not grant access, connect an account, or sync data.</p></div>
    <div className="connections-scope" role="group" aria-label="Connection scope">
      <button type="button" aria-pressed={scope === "personal"} onClick={() => setScope("personal")}>My connections</button>
      <button type="button" aria-pressed={scope === "company"} onClick={() => setScope("company")}>Company connections</button>
    </div>
    <p className="connections-scope-description">{scope === "personal" ? `Plan connections for ${profileName}’s own work.` : "Plan access to shared company tools. Company access requires an approved organizational setup."} Both scopes are part of this profile’s local plan.</p>
    {snapshot.notice ? <div className="connections-storage-notice" role="status"><p>{snapshot.notice}</p>{snapshot.blocked ? <button type="button" className="connections-button" onClick={store.reset}>Back up and reset local plan</button> : null}</div> : null}
    <div className="connections-grid">{available.map((definition) => {
      const selection = snapshot.plan.selections.find((item) => item.providerId === definition.id && item.scope === scope);
      return <ConnectionCard key={`${scope}:${definition.id}`} definition={definition} scope={scope} selection={selection} disabled={!snapshot.loaded || snapshot.blocked} onSave={saveSelection} />;
    })}</div>
    <section className="connections-plan" aria-labelledby={`${id}-plan-title`}>
      <div className="connections-plan-heading"><div><h3 id={`${id}-plan-title`}>Connection plan <span>{snapshot.plan.selections.length}</span></h3><p>For {profileName} · saved only in this browser · not sent to IT</p></div>{hasPlan ? <div className="connections-plan-actions"><button type="button" className="connections-button" onClick={downloadPlan}><ArrowDownToLine size={15} aria-hidden="true" />Download plan</button><button type="button" className="connections-button" onClick={() => void copyPlan()}><Copy size={15} aria-hidden="true" />Copy plan</button><button type="button" className="connections-button" aria-expanded={manualCopy} aria-controls={`${id}-handoff-panel`} onClick={() => setManualCopy((current) => !current)}>{manualCopy ? "Hide plan" : "View plan"}</button></div> : null}</div>
      {hasPlan ? <ul className="connections-plan-list">{snapshot.plan.selections.map((selection) => {
        const definition = CONNECTION_CATALOG.find((item) => item.id === selection.providerId)!;
        const labels = definition.capabilities.filter((capability) => selection.capabilityIds.includes(capability.id));
        return <li key={`${selection.scope}:${selection.providerId}`}><div><strong>{definition.name}</strong><span className="connections-plan-scope">{selection.scope === "personal" ? "My connections" : "Company connections"}</span><p>{labels.map((capability) => `${capability.label}${capability.access === "write" ? " (write requested)" : ""}`).join(" · ")}</p></div><button type="button" className="connections-remove" aria-label={`Remove ${definition.name} from ${selection.scope === "personal" ? "my" : "company"} connection plan`} onClick={() => { store.removeSelection(selection.providerId, selection.scope); setHandoffNotice(""); }}><Trash2 size={16} aria-hidden="true" /><span>Remove</span></button></li>;
      })}</ul> : <p className="connections-plan-empty">Your plan is empty. Open a tool above and choose the access you would like to request.</p>}
      {hasPlan ? <p className="connections-help">The handoff contains selected tools, requested capabilities, and setup guidance. It contains no credentials or private work content.</p> : null}
      {handoffNotice ? <p className="connections-handoff-notice" role="status">{handoffNotice}</p> : null}
      {manualCopy && hasPlan ? <div id={`${id}-handoff-panel`} className="connections-manual-copy"><label htmlFor={`${id}-handoff`}>Connection plan for review or manual copy</label><textarea id={`${id}-handoff`} readOnly value={handoff} rows={10} onFocus={(event) => event.currentTarget.select()} /><p className="connections-help">Select the text, then use your device’s Copy command.</p></div> : null}
    </section>
  </section>;
}

export function ConnectionsSettings(props: { profileId: string; profileName: string }) {
  return <ProfileConnectionsSettings key={props.profileId} {...props} />;
}
