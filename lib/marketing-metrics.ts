import type { MarketingMetricCategory, MarketingMetricItem, MarketingMetricUnit } from "./types";

export type MarketingMetricDefinition = {
  key: string;
  label: string;
  category: MarketingMetricCategory;
  unit: MarketingMetricUnit;
  defaultSource: string;
  description: string;
};

export const MARKETING_METRIC_CATEGORIES: MarketingMetricCategory[] = [
  "Website & SEO",
  "Email & Newsletter",
  "LinkedIn & 5-3-1",
  "YouTube",
  "Awareness & Events",
  "Other Social",
];

export const MARKETING_METRIC_DEFINITIONS: MarketingMetricDefinition[] = [
  { key: "linkedin-posts", label: "LinkedIn posts published", category: "LinkedIn & 5-3-1", unit: "count", defaultSource: "Spej LinkedIn", description: "Monthly total from this account. A separate cross-check, not added to posts already tracked in Content." },
  { key: "linkedin-comments", label: "Comments received", category: "LinkedIn & 5-3-1", unit: "count", defaultSource: "Spej LinkedIn", description: "Comments received on this account's content; different from comments your team makes." },
  { key: "linkedin-new-followers", label: "New LinkedIn followers", category: "LinkedIn & 5-3-1", unit: "count", defaultSource: "Spej LinkedIn", description: "Gross new followers reported during the month, not lifetime followers." },
  { key: "linkedin-leads", label: "LinkedIn inquiries / leads", category: "LinkedIn & 5-3-1", unit: "count", defaultSource: "Spej LinkedIn", description: "Channel-attributed inquiries or lead submissions; not added to unique CRM people." },
  { key: "youtube-published", label: "Videos published", category: "YouTube", unit: "count", defaultSource: "YouTube Studio", description: "Monthly videos published, including only the account and formats covered by this report." },
  { key: "youtube-comments", label: "YouTube comments received", category: "YouTube", unit: "count", defaultSource: "YouTube Studio", description: "Comments received during the reporting month." },
  { key: "youtube-new-subscribers", label: "New YouTube subscribers", category: "YouTube", unit: "count", defaultSource: "YouTube Studio", description: "Gross subscribers gained in the reporting month." },
  { key: "youtube-meetings", label: "Meetings attributed to YouTube", category: "YouTube", unit: "count", defaultSource: "CRM / YouTube", description: "Bookings with explicit YouTube attribution, not inferred from views." },
  { key: "newsletter-issues", label: "Newsletter issues published", category: "Email & Newsletter", unit: "count", defaultSource: "Newsletter platform", description: "Number of distinct issues or campaigns sent; separate from the number of recipients." },
  { key: "email-clicks", label: "Email clicks", category: "Email & Newsletter", unit: "count", defaultSource: "Newsletter platform", description: "Clicks reported by the email platform for this month." },
  { key: "email-meetings", label: "Meetings attributed to email", category: "Email & Newsletter", unit: "count", defaultSource: "CRM / Email", description: "Bookings explicitly attributed to marketing email." },
  { key: "website-articles", label: "Articles / pages published", category: "Website & SEO", unit: "count", defaultSource: "Website", description: "New published website content during the month." },
  { key: "website-meetings", label: "Website meetings booked", category: "Website & SEO", unit: "count", defaultSource: "Booking platform", description: "Verified completed bookings from the website, not button clicks." },
  { key: "events-run", label: "Events / appearances delivered", category: "Awareness & Events", unit: "count", defaultSource: "Event", description: "In-person or virtual events and speaking appearances completed." },
  { key: "event-meetings", label: "Meetings from events", category: "Awareness & Events", unit: "count", defaultSource: "CRM / Event", description: "Meetings booked with known event attribution." },
  { key: "social-posts", label: "Other social posts published", category: "Other Social", unit: "count", defaultSource: "Social platform", description: "Posts published; use a separate source label for each platform and account." },
  { key: "social-comments", label: "Other social comments received", category: "Other Social", unit: "count", defaultSource: "Social platform", description: "Comments received on content for the named account." },
  { key: "social-new-followers", label: "Other social new followers", category: "Other Social", unit: "count", defaultSource: "Social platform", description: "Gross new followers gained during the month." },
  { key: "social-meetings", label: "Meetings from other social", category: "Other Social", unit: "count", defaultSource: "CRM / Social", description: "Explicitly attributed bookings for the named platform." },
  { key: "website-visitors", label: "Website visitors", category: "Website & SEO", unit: "count", defaultSource: "Google Analytics", description: "People or users visiting the Spej website." },
  { key: "organic-visitors", label: "Organic visitors", category: "Website & SEO", unit: "count", defaultSource: "Google Analytics", description: "Website visitors arriving from organic search." },
  { key: "website-key-events", label: "Website key events", category: "Website & SEO", unit: "count", defaultSource: "Google Analytics", description: "Meaningful website actions such as a lead form or meeting-booking completion." },
  { key: "search-impressions", label: "Search impressions", category: "Website & SEO", unit: "count", defaultSource: "Google Search Console", description: "Times Spej appeared in Google search results." },
  { key: "search-clicks", label: "Search clicks", category: "Website & SEO", unit: "count", defaultSource: "Google Search Console", description: "Clicks from Google search results to Spej pages." },
  { key: "search-ctr", label: "Search click-through rate", category: "Website & SEO", unit: "percent", defaultSource: "Google Search Console", description: "Search clicks divided by search impressions." },
  { key: "search-position", label: "Average search position", category: "Website & SEO", unit: "position", defaultSource: "Google Search Console", description: "Average position of the top Spej result across observed searches." },
  { key: "email-subscribers", label: "Active subscribers", category: "Email & Newsletter", unit: "count", defaultSource: "Newsletter platform", description: "Current active newsletter or email audience." },
  { key: "email-opt-ins", label: "New email opt-ins", category: "Email & Newsletter", unit: "count", defaultSource: "Newsletter platform", description: "New subscribers captured during the period." },
  { key: "emails-sent", label: "Emails sent", category: "Email & Newsletter", unit: "count", defaultSource: "Newsletter platform", description: "Marketing or newsletter emails delivered during the period." },
  { key: "email-open-rate", label: "Average open rate", category: "Email & Newsletter", unit: "percent", defaultSource: "Newsletter platform", description: "Average reported open rate for the period." },
  { key: "email-click-rate", label: "Average click rate", category: "Email & Newsletter", unit: "percent", defaultSource: "Newsletter platform", description: "Average reported email click rate for the period." },
  { key: "email-unsubscribes", label: "Unsubscribes", category: "Email & Newsletter", unit: "count", defaultSource: "Newsletter platform", description: "People who unsubscribed during the period." },
  { key: "linkedin-followers", label: "LinkedIn followers", category: "LinkedIn & 5-3-1", unit: "count", defaultSource: "LinkedIn", description: "Followers across the selected Spej or personal LinkedIn account." },
  { key: "linkedin-page-views", label: "LinkedIn page/profile views", category: "LinkedIn & 5-3-1", unit: "count", defaultSource: "LinkedIn", description: "Views of the selected company page or personal profile." },
  { key: "linkedin-search-appearances", label: "LinkedIn search appearances", category: "LinkedIn & 5-3-1", unit: "count", defaultSource: "LinkedIn", description: "Times the selected LinkedIn presence appeared in search." },
  { key: "linkedin-impressions", label: "LinkedIn impressions", category: "LinkedIn & 5-3-1", unit: "count", defaultSource: "LinkedIn", description: "Post or page impressions during the period." },
  { key: "linkedin-engagements", label: "LinkedIn engagements", category: "LinkedIn & 5-3-1", unit: "count", defaultSource: "LinkedIn", description: "Reactions, comments, reposts, or other substantive engagement." },
  { key: "linkedin-conversations", label: "LinkedIn conversations", category: "LinkedIn & 5-3-1", unit: "count", defaultSource: "CRM / LinkedIn", description: "Meaningful conversations started or advanced on LinkedIn." },
  { key: "linkedin-meetings", label: "Meetings booked from LinkedIn", category: "LinkedIn & 5-3-1", unit: "count", defaultSource: "CRM / LinkedIn", description: "Meetings attributable to LinkedIn relationship activity." },
  { key: "youtube-subscribers", label: "YouTube subscribers", category: "YouTube", unit: "count", defaultSource: "YouTube Studio", description: "Current YouTube subscribers." },
  { key: "youtube-impressions", label: "YouTube impressions", category: "YouTube", unit: "count", defaultSource: "YouTube Studio", description: "Thumbnail impressions during the period." },
  { key: "youtube-views", label: "YouTube views", category: "YouTube", unit: "count", defaultSource: "YouTube Studio", description: "Video views during the period." },
  { key: "youtube-unique-viewers", label: "YouTube unique viewers", category: "YouTube", unit: "count", defaultSource: "YouTube Studio", description: "Estimated distinct viewers during the period." },
  { key: "youtube-watch-hours", label: "YouTube watch hours", category: "YouTube", unit: "hours", defaultSource: "YouTube Studio", description: "Total watch time in hours." },
  { key: "youtube-ctr", label: "YouTube click-through rate", category: "YouTube", unit: "percent", defaultSource: "YouTube Studio", description: "YouTube impressions that became views." },
  { key: "media-mentions", label: "Media and brand mentions", category: "Awareness & Events", unit: "count", defaultSource: "Spej Intelligence", description: "Relevant third-party mentions observed during the period." },
  { key: "event-leads", label: "Event leads", category: "Awareness & Events", unit: "count", defaultSource: "CRM / Event", description: "New people captured from in-person or virtual events." },
  { key: "direct-inquiries", label: "Direct inquiries", category: "Awareness & Events", unit: "count", defaultSource: "CRM", description: "Inbound calls, messages, or referrals not captured by another channel." },
  { key: "social-followers", label: "Other social followers", category: "Other Social", unit: "count", defaultSource: "Social platform", description: "Followers on another social platform." },
  { key: "social-impressions", label: "Other social impressions", category: "Other Social", unit: "count", defaultSource: "Social platform", description: "Impressions on another social platform." },
  { key: "social-engagements", label: "Other social engagements", category: "Other Social", unit: "count", defaultSource: "Social platform", description: "Engagement actions on another social platform." },
  { key: "social-clicks", label: "Other social outbound clicks", category: "Other Social", unit: "count", defaultSource: "Social platform", description: "Outbound traffic from another social platform." },
];

const definitionsByKey = new Map(MARKETING_METRIC_DEFINITIONS.map((definition) => [definition.key, definition]));

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function marketingMetricDefinition(key: string) {
  return definitionsByKey.get(key);
}

export function cleanMarketingMetrics(value: unknown): MarketingMetricItem[] {
  if (!Array.isArray(value)) throw new Error("Marketing metrics must be a list.");
  if (value.length > 20_000) throw new Error("The marketing metric list is too large.");
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<MarketingMetricItem>;
    const definition = marketingMetricDefinition(cleanText(candidate.metricKey, 80));
    const period = cleanText(candidate.period, 40);
    const numeric = Number(candidate.value);
    if (!["number", "string"].includes(typeof candidate.value) || String(candidate.value).trim() === "") return [];
    if (!definition || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period) || !Number.isFinite(numeric) || numeric < 0 || (definition.unit === "percent" && numeric > 100) || (definition.unit === "count" && !Number.isSafeInteger(numeric))) return [];
    return [{
      id: cleanText(candidate.id, 120) || crypto.randomUUID(),
      period,
      category: definition.category,
      metricKey: definition.key,
      value: numeric,
      unit: definition.unit,
      source: cleanText(candidate.source, 160) || definition.defaultSource,
      notes: cleanText(candidate.notes, 1_200),
      updatedAt: Number.isFinite(Date.parse(cleanText(candidate.updatedAt, 40))) ? new Date(candidate.updatedAt!).toISOString() : new Date().toISOString(),
    }];
  });
}

export function metricSourceKey(source: string) { return source.trim().toLowerCase(); }

export function latestMarketingMetrics(items: MarketingMetricItem[]) {
  const latest = new Map<string, MarketingMetricItem>();
  for (const item of items) {
    const key = JSON.stringify([item.period, item.metricKey, metricSourceKey(item.source)]);
    const previous = latest.get(key);
    if (!previous || item.updatedAt > previous.updatedAt) latest.set(key, item);
  }
  return [...latest.values()];
}

export function upsertMarketingMetric(items: MarketingMetricItem[], next: MarketingMetricItem, replacesId?: string) {
  const original = items.find((item) => item.id === replacesId);
  const candidates = original ? items.filter((item) => !(item.period === original.period && item.metricKey === original.metricKey && metricSourceKey(item.source) === metricSourceKey(original.source))) : items;
  const matches = (item: MarketingMetricItem) => item.period === next.period && item.metricKey === next.metricKey && metricSourceKey(item.source) === metricSourceKey(next.source);
  const existing = candidates.find(matches);
  return [{ ...next, id: existing?.id || original?.id || next.id }, ...candidates.filter((item) => !matches(item))];
}

export function marketingMetricValue(items: MarketingMetricItem[], period: string, metricKey: string, source?: string) {
  const matches = latestMarketingMetrics(items).filter((item) => item.period === period && item.metricKey === metricKey && (!source || metricSourceKey(item.source) === metricSourceKey(source)));
  if (!matches.length) return undefined;
  const definition = marketingMetricDefinition(metricKey);
  if (definition?.unit === "percent" || definition?.unit === "position") {
    // Rates across accounts lack a shared denominator. Never average them blindly.
    return matches.length === 1 ? matches[0].value : undefined;
  }
  return matches.reduce((sum, item) => sum + item.value, 0);
}
