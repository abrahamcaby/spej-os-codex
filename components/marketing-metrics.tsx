"use client";

import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, BarChart3, ChevronLeft, ChevronRight, Download, Pencil, Plus, UsersRound } from "lucide-react";
import type { AccountItem, ActivityItem, CampaignItem, ContactItem, ContentItem, MarketingMetricCategory, MarketingMetricItem, MarketingMetricUnit, OpportunityItem } from "@/lib/types";
import { MARKETING_METRIC_CATEGORIES, MARKETING_METRIC_DEFINITIONS, cleanMarketingMetrics, latestMarketingMetrics, marketingMetricDefinition, marketingMetricValue, metricSourceKey, upsertMarketingMetric } from "@/lib/marketing-metrics";
import { ACTIVITY_CHANNELS, csvCell, gtmMetrics, metricMonth } from "@/lib/gtm-metrics";
import { GtmActivityForm } from "./gtm-activity-form";

type MetricsDestination = "relationships" | "pipeline" | "tasks" | "projects" | "content" | "audience" | "campaigns";
type View = "Overview" | "Prospecting" | "Marketing & Content" | "Sources & Data";
const views: View[] = ["Overview", "Prospecting", "Marketing & Content", "Sources & Data"];
const viewLabels: Record<View, string> = {
  Overview: "Overview",
  Prospecting: "Prospecting",
  "Marketing & Content": "Content",
  "Sources & Data": "Data Sources",
};
const channels: Array<{ category: MarketingMetricCategory; input: string; reach: string; engagement: string; audience?: string; growth?: string; meetings: string }> = [
  { category: "LinkedIn & 5-3-1", input: "linkedin-posts", reach: "linkedin-impressions", engagement: "linkedin-engagements", audience: "linkedin-followers", growth: "linkedin-new-followers", meetings: "linkedin-meetings" },
  { category: "YouTube", input: "youtube-published", reach: "youtube-views", engagement: "youtube-comments", audience: "youtube-subscribers", growth: "youtube-new-subscribers", meetings: "youtube-meetings" },
  { category: "Email & Newsletter", input: "newsletter-issues", reach: "emails-sent", engagement: "email-clicks", audience: "email-subscribers", growth: "email-opt-ins", meetings: "email-meetings" },
  { category: "Website & SEO", input: "website-articles", reach: "website-visitors", engagement: "website-key-events", meetings: "website-meetings" },
  { category: "Awareness & Events", input: "events-run", reach: "media-mentions", engagement: "event-leads", meetings: "event-meetings" },
  { category: "Other Social", input: "social-posts", reach: "social-impressions", engagement: "social-engagements", audience: "social-followers", growth: "social-new-followers", meetings: "social-meetings" },
];

function channelLabel(category: MarketingMetricCategory) {
  return category === "LinkedIn & 5-3-1" ? "LinkedIn" : category;
}

function periodLabel(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1, 12));
}
function priorPeriod(period: string) {
  const [year, month] = period.split("-").map(Number);
  return metricMonth(new Date(year, month - 2, 1, 12));
}
function number(value: number) { return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value); }
function money(value: number) { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
function formatMetric(value: number | undefined, unit: MarketingMetricUnit) {
  if (value === undefined) return "Not recorded";
  return unit === "percent" ? `${number(value)}%` : unit === "hours" ? `${number(value)} hrs` : number(value);
}
function MetricCard({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return <div className="gtm-metric-card"><span>{label}</span><strong>{typeof value === "number" ? number(value) : value}</strong><small>{detail}</small></div>;
}

export function MarketingMetricsView({ metrics, setMetrics, accounts, contacts, activities, setActivities, opportunities, campaigns, content, goTo, defaultOwner = "" }: {
  metrics: MarketingMetricItem[]; setMetrics: React.Dispatch<React.SetStateAction<MarketingMetricItem[]>>;
  accounts: AccountItem[]; contacts: ContactItem[]; activities: ActivityItem[]; setActivities: React.Dispatch<React.SetStateAction<ActivityItem[]>>;
  opportunities: OpportunityItem[]; campaigns: CampaignItem[]; content: ContentItem[];
  defaultOwner?: string;
  goTo: (tab: MetricsDestination) => void;
}) {
  const [period, setPeriod] = useState(metricMonth);
  const [view, setView] = useState<View>("Overview");
  const [activityForm, setActivityForm] = useState<ActivityItem | "new" | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingMetricId, setEditingMetricId] = useState<string | undefined>();
  const [category, setCategory] = useState<MarketingMetricCategory>("LinkedIn & 5-3-1");
  const [metricKey, setMetricKey] = useState("linkedin-posts");
  const [value, setValue] = useState("");
  const [source, setSource] = useState("Spej LinkedIn");
  const [notes, setNotes] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [activityChannel, setActivityChannel] = useState("");
  const [activityOwner, setActivityOwner] = useState("");
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const previousPeriod = priorPeriod(period);
  const result = useMemo(() => gtmMetrics({ accounts, contacts, activities, opportunities, content }, period), [accounts, contacts, activities, opportunities, content, period]);
  const definitions = MARKETING_METRIC_DEFINITIONS.filter((item) => item.category === category);
  const selectedDefinition = marketingMetricDefinition(metricKey)!;
  const currentItems = latestMarketingMetrics(metrics).filter((item) => item.period === period && (!sourceFilter || metricSourceKey(item.source) === metricSourceKey(sourceFilter)));
  const sourceNames = [...new Map(metrics.map((item) => [metricSourceKey(item.source), item.source])).values()].sort();
  const owners = [...new Set(result.activities.map((item) => item.owner || "Unassigned"))].sort();
  const visibleActivities = result.activities.filter((item) => (!activityChannel || item.channel === activityChannel) && (!activityOwner || (item.owner || "Unassigned") === activityOwner));
  const getValue = (key: string) => marketingMetricValue(metrics, period, key, sourceFilter || undefined);
  const resetForm = () => { setValue(""); setNotes(""); setShowForm(false); setEditingMetricId(undefined); setFormError(""); };
  const changePeriod = (next: string) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(next) || next === period) return;
    setPeriod(next); resetForm(); setActivityForm(null);
    setNotice(showForm || activityForm ? "Reporting month changed. The unsaved form was closed; no saved records were changed." : "");
  };
  const openMetric = (key = "linkedin-posts") => {
    const definition = marketingMetricDefinition(key)!;
    setEditingMetricId(undefined); setCategory(definition.category); setMetricKey(key); setSource(sourceFilter || definition.defaultSource); setValue(""); setNotes(""); setFormError(""); setShowForm(true); setActivityForm(null);
  };
  const saveMetric = (event: FormEvent) => {
    event.preventDefault();
    const cleaned = cleanMarketingMetrics([{ id: crypto.randomUUID(), period, metricKey, value, source, notes, updatedAt: new Date().toISOString() }])[0];
    if (!cleaned) return setFormError("Enter a valid non-negative value. Counts must be whole numbers; percentages must be 0–100.");
    if (!source.trim()) return setFormError("Name the specific platform account or report.");
    setMetrics((items) => upsertMarketingMetric(items, cleaned, editingMetricId));
    setNotice(`Saved ${selectedDefinition.label} for ${periodLabel(period)}.`); resetForm();
  };
  const exportReport = () => {
    const rows: Array<Array<string | number>> = [["period", "area", "metric", "value", "source", "notes"]];
    for (const [label, count] of [["Outreach attempts", result.outreachCount], ["Unique people contacted", result.uniquePeople], ["New CRM people", result.newPeople], ["New people currently marked Prospect", result.newProspects], ["Leads first recorded", result.newLeads], ["Calls attempted", result.callsAttempted], ["Calls connected", result.callsConnected], ["Meetings booked", result.meetingsBooked], ["Meetings held", result.meetingsHeld], ["Content published", result.published.length], ["New opportunities", result.newOpportunities.length], ["Wins", result.wins.length]] as const) rows.push([period, "GTM records", label, count, "Local CRM / activity / content", "Period event totals, not cohort conversions"]);
    currentItems.forEach((item) => rows.push([period, item.category, marketingMetricDefinition(item.metricKey)?.label || item.metricKey, item.value, item.source, item.notes]));
    const url = URL.createObjectURL(new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `spej-gtm-metrics-${period}.csv`; anchor.click(); URL.revokeObjectURL(url);
    setNotice("Exported the period performance report. Platform rows follow the selected source filter; GTM totals cover the whole team.");
  };

  return <div className="view metrics-view gtm-metrics-view">
    <div className="page-heading"><div><p className="eyebrow">Sales and marketing results</p><h1>GTM Performance</h1><p className="page-description">Track sales and marketing activity, response, and business results.</p></div><div className="gtm-heading-actions"><button className="button button-secondary" onClick={() => openMetric()}><Plus size={15}/> Record channel results</button><button className="button button-primary" onClick={() => { setActivityForm("new"); setShowForm(false); }}><Plus size={15}/> Log activity</button></div></div>
    <div className="gtm-metrics-toolbar"><nav className="filter-row" aria-label="GTM Performance sections">{views.map((item) => <button key={item} aria-current={view === item ? "page" : undefined} className={view === item ? "active" : ""} onClick={() => setView(item)}>{viewLabels[item]}</button>)}</nav><div className="gtm-month-control"><button className="button button-ghost" aria-label="Previous reporting month" onClick={() => changePeriod(priorPeriod(period))}><ChevronLeft size={16}/></button><label>Reporting month<input aria-label="Reporting month" type="month" required value={period} onInput={(e) => changePeriod(e.currentTarget.value)} onChange={(e) => changePeriod(e.target.value)}/></label><button className="button button-ghost" aria-label="Next reporting month" onClick={() => { const [year, month] = period.split("-").map(Number); changePeriod(metricMonth(new Date(year, month, 1, 12))); }}><ChevronRight size={16}/></button></div><button className="button button-ghost" onClick={exportReport}><Download size={15}/> Export results</button></div>
    <p className="gtm-period-note">{periodLabel(period)} · {period === metricMonth() ? "Month to date" : "Recorded period totals"} · Work recorded in GTM, not a claim of full platform coverage.</p>
    {(view === "Overview" || view === "Prospecting") && <p className="gtm-period-note">Client relationship care: <strong>{result.clientCareActivities}</strong> activities · Partner relationship care: <strong>{result.partnerCareActivities}</strong>. These are separate from prospecting. {result.unclassifiedPurposeActivities > 0 && `${result.unclassifiedPurposeActivities} activities have no classified purpose; their typed events remain in historical totals until reviewed in the activity log.`}</p>}
    {notice && <p className="relationship-notice" role="status">{notice}</p>}
    {activityForm && <GtmActivityForm
      key={activityForm === "new" ? "new" : activityForm.id}
      accounts={accounts}
      contacts={contacts}
      campaigns={campaigns}
      initial={activityForm === "new" ? undefined : activityForm}
      defaultOwner={defaultOwner}
      onCancel={() => setActivityForm(null)}
      onSave={(item) => {
        setActivities((items) => [item, ...items.filter((current) => current.id !== item.id)]);
        setActivityForm(null);
        setNotice("Activity saved to the shared CRM log and included in its activity month.");
      }}
    />}
    {showForm && <form className="metrics-form" onSubmit={saveMetric}><div><p className="eyebrow">Monthly source total</p><h2>{selectedDefinition.label}</h2><p>{selectedDefinition.description}</p><p>Saving the same month, metric, and source replaces its previous value.</p></div><div className="metrics-form-grid">
      <label>Source category<select value={category} onChange={(e) => { const first = MARKETING_METRIC_DEFINITIONS.find((item) => item.category === e.target.value)!; setCategory(first.category); setMetricKey(first.key); setSource(sourceFilter || first.defaultSource); }}>{MARKETING_METRIC_CATEGORIES.map((item) => <option key={item} value={item}>{channelLabel(item)}</option>)}</select></label>
      <label>Metric<select value={metricKey} onChange={(e) => setMetricKey(e.target.value)}>{definitions.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
      <label>Value<input autoFocus required type="number" min="0" max={selectedDefinition.unit === "percent" ? 100 : undefined} step={selectedDefinition.unit === "count" ? 1 : "any"} value={value} onChange={(e) => setValue(e.target.value)}/></label>
      <label>Specific source<input required maxLength={160} list="gtm-sources" value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Spej LinkedIn"/><datalist id="gtm-sources">{sourceNames.map((item) => <option key={item}>{item}</option>)}<option>Spej LinkedIn</option><option>Aby LinkedIn</option><option>YouTube Studio</option><option>Google Analytics</option></datalist></label>
      <label className="metrics-notes">Notes<input maxLength={1200} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Account, report period, attribution method, or caveat"/></label>
      {formError && <p role="alert">{formError}</p>}
    </div><div className="form-actions"><button type="button" className="button button-ghost" onClick={resetForm}>Cancel</button><button className="button button-primary">Save metric</button></div></form>}

    {view === "Overview" && <>
      <section className="gtm-score-grid" aria-label="GTM period overview">
        <MetricCard label="Outreach attempts" value={result.outreachCount} detail={`${result.uniquePeople} linked people · ${result.firstContactedPeople} first recorded contact`}/>
        <MetricCard label="Content published" value={result.published.length} detail="Actual publish dates from Content"/>
        <MetricCard label="Leads first recorded" value={result.newLeads} detail={`${result.newPeople} new CRM people (not all leads)`}/>
        <MetricCard label="Meetings booked" value={result.meetingsBooked} detail={`${result.meetingsHeld} meetings held this month`}/>
        <MetricCard label="Opportunities created" value={result.newOpportunities.length} detail={`${money(result.newPipeline)} current value of those deals`}/>
        <MetricCard label="Deals won" value={result.wins.length} detail={`${money(result.wonValue)} · recorded close dates`}/>
      </section>
      <div className="gtm-path-grid"><section className="panel gtm-path"><p className="eyebrow">Sales motion</p><h2>Prospecting → conversations → opportunities</h2><p>Attempts and unique people are different measures. Bookings, held meetings, and wins are counted separately.</p><button className="button button-secondary" onClick={() => setView("Prospecting")}>Review prospecting <ArrowRight size={14}/></button></section><section className="panel gtm-path"><p className="eyebrow">Marketing motion</p><h2>Publish → earn attention → create demand</h2><p>Keep your publishing cadence next to account-level reach, engagement, audience growth, and attributed bookings.</p><button className="button button-secondary" onClick={() => setView("Marketing & Content")}>Review marketing <ArrowRight size={14}/></button></section></div>
      <section className="panel gtm-detail-panel"><h2>Specific sources</h2><p>The specific source recorded on each CRM person or opportunity. These are independent monthly counts, not a conversion funnel or proof of causation.</p>{result.sourceRows.length ? <div className="gtm-table-scroll"><table><thead><tr><th>Specific source</th><th>New people</th><th>Leads first recorded</th><th>New opportunities</th><th>Wins</th></tr></thead><tbody>{result.sourceRows.map((row) => <tr key={row.source}><th>{row.source}</th><td>{row.people}</td><td>{row.leads}</td><td>{row.opportunities}</td><td>{row.wins}</td></tr>)}</tbody></table></div> : <p className="gtm-empty"><UsersRound size={18}/> Add dated CRM records with their source to build this view.</p>}<button className="button button-ghost" onClick={() => goTo("pipeline")}>Open sales pipeline <ArrowRight size={14}/></button></section>
      <p className="gtm-period-note">Current open pipeline: <strong>{money(result.openPipeline)}</strong>. This is today’s pipeline, not the selected month’s historical balance.</p>
      <section className="panel gtm-detail-panel"><h2>Source categories</h2><p>Source categories group inbound, outbound, networks, referrals, events, and partners. They stay separate from the offering and specific source above. Unclassified means the origin has not been recorded; it is never guessed.</p>{result.acquisitionRows.length ? <div className="gtm-table-scroll"><table><thead><tr><th>Source category</th><th>New people</th><th>Leads first recorded</th><th>New opportunities</th><th>Wins</th></tr></thead><tbody>{result.acquisitionRows.map((row) => <tr key={row.source}><th>{row.source}</th><td>{row.people}</td><td>{row.leads}</td><td>{row.opportunities}</td><td>{row.wins}</td></tr>)}</tbody></table></div> : <p className="gtm-empty">Set a source category on people and opportunities to compare recorded origins. These independent counts are not conversion rates.</p>}</section>
    </>}

    {view === "Prospecting" && <>
      <section className="gtm-score-grid" aria-label="Prospecting inputs and outcomes">
        <MetricCard label="Outreach attempts" value={result.outreachCount} detail="Messages, follow-ups, call attempts, connection requests"/>
        <MetricCard label="Unique people contacted" value={result.uniquePeople} detail={`${result.unlinkedOutreach} unlinked attempts excluded from people`}/>
        <MetricCard label="First recorded contact" value={result.firstContactedPeople} detail="No earlier typed outreach in this GTM history"/>
        <MetricCard label="Replies received" value={result.replies} detail="Explicit inbound reply events"/>
        <MetricCard label="Calls attempted / connected" value={`${result.callsAttempted} / ${result.callsConnected}`} detail="Connected outbound calls are also counted as attempts"/>
        <MetricCard label="Meetings booked / held" value={`${result.meetingsBooked} / ${result.meetingsHeld}`} detail={`${result.noShows} no-shows · ${result.meetingsCancelled} cancellations`}/>
      </section>
      <div className="gtm-path-grid"><section className="panel gtm-detail-panel"><h2>Build the prospect base</h2><div className="gtm-stat-lines"><p><span>New CRM people</span><b>{result.newPeople}</b></p><p><span>New people currently marked Prospect</span><b>{result.newProspects}</b></p><p><span>Leads first recorded</span><b>{result.newLeads}</b></p><p><span>New accounts</span><b>{result.newAccounts}</b></p></div><p>A prospect is someone you want to engage. A lead has expressed relevant interest. Personal, customer, and partner contacts are not automatically leads.</p><button className="button button-ghost" onClick={() => goTo("relationships")}>Manage people & accounts <ArrowRight size={14}/></button></section><section className="panel gtm-detail-panel"><h2>Prospecting activity</h2><div className="gtm-stat-lines"><p><span>Follow-ups sent</span><b>{result.followUps}</b></p><p><span>Comments made</span><b>{result.comments}</b></p><p><span>Connection requests</span><b>{result.connections}</b></p></div><p>Profile reviews and general notes are not outreach. A received comment is a marketing result; a comment your team makes is an activity.</p></section></div>
      <section className="panel gtm-detail-panel"><div className="gtm-section-heading"><div><h2>Shared activity log</h2><p>Log here or in CRM. Both update the same records.</p></div><button className="button button-secondary" onClick={() => { setActivityForm("new"); setShowForm(false); }}>Log activity</button></div><div className="gtm-inline-filters"><label>Activity channel<select value={activityChannel} onChange={(e) => setActivityChannel(e.target.value)}><option value="">All channels</option>{ACTIVITY_CHANNELS.map((item) => <option key={item}>{item}</option>)}</select></label><label>Activity owner filter<select value={activityOwner} onChange={(e) => setActivityOwner(e.target.value)}><option value="">All owners</option>{owners.map((item) => <option key={item}>{item}</option>)}</select></label></div>
        {visibleActivities.length ? <div className="gtm-table-scroll"><table><thead><tr><th>Date / type</th><th>Person / channel</th><th>Owner / campaign</th><th>Context</th><th>Action</th></tr></thead><tbody>{[...visibleActivities].sort((a,b) => b.occurredAt.localeCompare(a.occurredAt)).map((item) => <tr key={item.id}><td>{item.occurredAt}<strong>{item.metricType || "Needs classification"}</strong><small>{item.purpose || "Purpose unclassified"}</small></td><td>{contacts.find((person) => person.id === item.contactId)?.name || "Unlinked"}<small>{item.channel}</small></td><td>{item.owner || "Unassigned"}<small>{campaigns.find((campaign) => campaign.id === item.campaignId)?.name || "No campaign"}</small></td><td>{item.summary}</td><td><button className="button button-ghost" aria-label={`Edit activity: ${item.summary}`} onClick={() => { setActivityForm(item); setShowForm(false); }}><Pencil size={14}/> Edit</button></td></tr>)}</tbody></table></div> : <p className="gtm-empty">No matching activities recorded in this month.</p>}
      </section>
    </>}

    {view === "Marketing & Content" && <>
      <section className="panel gtm-detail-panel"><div className="gtm-section-heading"><div><h2>Publishing cadence</h2><p>One shared Content workflow. Published items count once, using their actual publish date.</p></div><button className="button button-secondary" onClick={() => goTo("content")}>Open content library <ArrowRight size={14}/></button></div><div className="gtm-metric-card"><span>Content published</span><strong>{result.published.length}</strong><small>{["LinkedIn", "YouTube", "Newsletter", "Article", "Short-form", "Other"].map((format) => `${result.published.filter((item) => item.format === format).length} ${format}`).join(" · ")}</small></div></section>
      <div className="gtm-section-heading"><div><h2>Inputs alongside channel results</h2><p>Reported platform totals stay separate from the Content count above. Lifetime audience is not monthly growth.</p></div><label>Specific source<select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}><option value="">All recorded sources</option>{sourceNames.map((item) => <option key={item}>{item}</option>)}</select></label></div>
      <div className="gtm-channel-grid">{channels.map((channel) => <section className="panel gtm-channel-card" key={channel.category}><header><h2>{channelLabel(channel.category)}</h2><button className="button button-ghost" aria-label={`Record ${channelLabel(channel.category)} results`} onClick={() => openMetric(channel.input)}><Plus size={14}/> Record</button></header>{[{ label: "Input · published / delivered", key: channel.input }, { label: "Reach / distribution", key: channel.reach }, { label: "Response", key: channel.engagement }, ...(channel.audience ? [{ label: "Audience · latest monthly snapshot", key: channel.audience }] : []), ...(channel.growth ? [{ label: "Growth · gross additions", key: channel.growth }] : []), { label: "Outcome · attributed bookings", key: channel.meetings }].map(({ label, key }) => <div className="gtm-channel-metric" key={key}><span><small>{label}</small><b>{marketingMetricDefinition(key)!.label}</b></span><strong>{formatMetric(getValue(key), "count")}</strong></div>)}</section>)}</div>
      <p className="gtm-period-note">All sources combines reported counts across accounts, not unique people across platforms. Monthly views may come from older posts. Booking attribution must be explicitly recorded; it is not inferred from posting volume.</p>
      {currentItems.length > 0 && <section className="panel gtm-detail-panel"><h2>Recorded channel detail</h2><p>Includes comments, watch time, search, and all other saved measures. Changes compare the same source and metric with {periodLabel(previousPeriod)}.</p><div className="gtm-table-scroll"><table><thead><tr><th>Metric</th><th>Source</th><th>This month</th><th>Prior month</th><th>Change</th></tr></thead><tbody>{currentItems.map((item) => { const previous = marketingMetricValue(metrics, previousPeriod, item.metricKey, item.source); return <tr key={item.id}><th>{marketingMetricDefinition(item.metricKey)?.label}</th><td>{item.source}</td><td>{formatMetric(item.value, item.unit)}</td><td>{formatMetric(previous, item.unit)}</td><td>{previous === undefined ? "No comparable reading" : `${item.value - previous > 0 ? "+" : ""}${number(item.value - previous)}${item.unit === "percent" ? " percentage points" : item.unit === "position" ? " positions" : ""}`}</td></tr>; })}</tbody></table></div></section>}
    </>}

    {view === "Sources & Data" && <>
      <section className="panel gtm-detail-panel"><h2>What is automatic today?</h2><div className="gtm-table-scroll"><table><thead><tr><th>Source</th><th>Current behavior</th><th>Next connection for Spej IT</th></tr></thead><tbody><tr><th>GTM CRM, activities, content</th><td>Counts update from saved records; manual entry or reviewed Sosa proposals.</td><td>Spej OS canonical IDs and shared record synchronization.</td></tr><tr><th>Platform analytics</th><td>Monthly account-level snapshots entered here. No GA4 or social analytics connector is active here.</td><td>GA4, Search Console, approved social and newsletter APIs or exports.</td></tr><tr><th>Calls and meetings</th><td>Explicit booked, held, cancelled and no-show activity events.</td><td>Outlook / Teams event IDs, lifecycle updates and duplicate protection.</td></tr><tr><th>Public audience tracker</th><td>Separate best-effort public profile readings, not auto-imported into this monthly performance view.</td><td>Verified account mapping and dated monthly snapshots.</td></tr></tbody></table></div><button className="button button-ghost" onClick={() => goTo("audience")}>Open audience source tracker <ArrowRight size={14}/></button></section>
      <section className="panel gtm-detail-panel"><h2>Data quality checks</h2><ul><li>{result.unclassifiedActivities} activities in this month need classification. Old meeting notes are not assumed to be held meetings. <button className="gtm-inline-link" onClick={() => setView("Prospecting")}>Review activity log</button></li><li>{result.undatedLeads} people marked Lead lack the date interest was first recorded. Add it in CRM → People to count their lead month.</li><li>{result.undatedPublished} published content records and {result.undatedWins} won opportunities lack valid outcome dates; excluded from monthly outcome counts.</li><li>{result.unlinkedOutreach} outreach attempts lack an active linked person; included in attempts, excluded from unique people.</li><li>Archived CRM/activity records are excluded. Use archive for records you no longer want included; it is not a historical close operation.</li><li>Do not combine a total-account export and its individual account rows. Reuse the exact source label when updating a monthly total.</li><li>Rates and average positions are shown per source. No unweighted cross-account averages or unlinked funnel conversion percentages.</li></ul></section>
      <section className="panel gtm-detail-panel"><div className="gtm-section-heading"><div><h2>Monthly source data</h2><p>Edit a reported total without adding it again. Older same-source duplicates are superseded in calculations.</p></div><label>Specific source<select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}><option value="">All recorded sources</option>{sourceNames.map((item) => <option key={item}>{item}</option>)}</select></label></div>{currentItems.length ? <div className="gtm-table-scroll"><table><thead><tr><th>Metric / specific source</th><th>Value</th><th>Notes / updated</th><th>Action</th></tr></thead><tbody>{currentItems.map((item) => <tr key={item.id}><th>{marketingMetricDefinition(item.metricKey)?.label}<small>{item.source}</small></th><td>{formatMetric(item.value, item.unit)}</td><td>{item.notes || "No coverage note"}<small>{item.updatedAt.slice(0,10)}</small></td><td><button className="button button-ghost" aria-label={`Edit ${item.metricKey} from ${item.source}`} onClick={() => { openMetric(item.metricKey); setEditingMetricId(item.id); setSource(item.source); setValue(String(item.value)); setNotes(item.notes); }}><Pencil size={14}/> Edit</button></td></tr>)}</tbody></table></div> : <p className="gtm-empty"><BarChart3 size={18}/> No monthly platform totals recorded for this selection.</p>}</section>
    </>}
  </div>;
}
