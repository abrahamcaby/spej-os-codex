import { boundedPriority, newsletterPriority } from "./feed-priority";
import { canonicalizeIndustryUrl, normalizeIndustryTitle } from "./industry-curation";
import { canonicalizeNewsletterUrl, newsletterTitlesMatch } from "./newsletter-intelligence";
import type {
  DailyIntelligenceDigest,
  LiveFeedResponse,
  LiveStory,
  NewsletterFeedResponse,
  NewsletterTopic,
  PublicSettings,
} from "./types";

type DigestChannel = "industry" | "newsletters";

type DigestCandidate = {
  id: string;
  channel: DigestChannel;
  title: string;
  summary: string;
  url: string;
  occurredAt: string;
  importanceScore: number;
  sources: string[];
  sourceUrls: string[];
};

const eventStopWords = new Set([
  "a", "an", "and", "are", "as", "at", "by", "for", "from", "has", "in", "is", "it", "its",
  "lets", "new", "of", "on", "or", "that", "the", "their", "this", "to", "was", "with",
  "allowing", "announces", "announced", "introduces", "introduced", "launches", "launched", "releases",
  "released", "reveals", "says", "unveils", "unveiled",
]);

const genericEventTokens = new Set([
  "agent", "ai", "framework", "model", "operate", "platform", "physical-system", "research", "standard",
]);

const eventSynonyms: Record<string, string> = {
  agents: "agent",
  devices: "physical-system",
  device: "physical-system",
  hardware: "physical-system",
  physical: "physical-system",
  framework: "standard",
  frameworks: "standard",
  protocol: "standard",
  protocols: "standard",
  specification: "standard",
  specifications: "standard",
  control: "operate",
  controls: "operate",
  operating: "operate",
  operates: "operate",
};

function timestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function activeAt(item: LiveStory | NewsletterTopic, hours: number, now: number) {
  if (item.workflow?.archiveReason === "user") return false;
  const occurredAt = "receivedAt" in item
    ? item.receivedAt
    : item.publishedAt || item.discoveredAt || "";
  const occurred = timestamp(occurredAt);
  return Number.isFinite(occurred) && occurred >= now - hours * 3_600_000 && occurred <= now + 10 * 60_000;
}

function canonical(value: string) {
  return canonicalizeNewsletterUrl(value) || canonicalizeIndustryUrl(value);
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  return values.flatMap((raw) => {
    const value = raw.trim();
    const key = value.toLocaleLowerCase("en-US");
    if (!value || seen.has(key)) return [];
    seen.add(key);
    return [value];
  });
}

function uniqueUrls(values: string[]) {
  const seen = new Set<string>();
  return values.flatMap((raw) => {
    const value = canonical(raw);
    if (!value || seen.has(value)) return [];
    seen.add(value);
    return [value];
  });
}

function sortCandidates(candidates: DigestCandidate[]) {
  return [...candidates].sort((left, right) =>
    right.importanceScore - left.importanceScore ||
    timestamp(right.occurredAt) - timestamp(left.occurredAt) ||
    left.id.localeCompare(right.id));
}

function normalizedEventTitle(value: string, sources: string[]) {
  const stripped = sources.map((source) => normalizeIndustryTitle(value, source))
    .find((candidate) => candidate.length < normalizeIndustryTitle(value).length);
  return stripped || normalizeIndustryTitle(value);
}

function eventTitleTokens(value: string, sources: string[]) {
  return new Set(normalizedEventTitle(value, sources).split(" ").flatMap((token) => {
    if (token.length < 2 || eventStopWords.has(token)) return [];
    return [eventSynonyms[token] || token];
  }));
}

function eventTitlesMatch(left: DigestCandidate, right: DigestCandidate) {
  const leftTitle = normalizedEventTitle(left.title, left.sources);
  const rightTitle = normalizedEventTitle(right.title, right.sources);
  if (newsletterTitlesMatch(leftTitle, rightTitle)) return true;
  const leftTokens = eventTitleTokens(left.title, left.sources);
  const rightTokens = eventTitleTokens(right.title, right.sources);
  if (leftTokens.size < 3 || rightTokens.size < 3) return false;
  const shared = [...leftTokens].filter((token) => rightTokens.has(token));
  const smaller = Math.min(leftTokens.size, rightTokens.size);
  const hasDistinctiveEntity = shared.some((token) => !genericEventTokens.has(token));
  const overlap = shared.length / smaller;
  return hasDistinctiveEntity && shared.length >= 4 &&
    (overlap >= 0.6 || (shared.length >= 5 && overlap >= 0.5));
}

function industryCandidate(item: LiveStory): DigestCandidate {
  const url = canonical(item.url) || item.url;
  return {
    id: item.id,
    channel: "industry",
    title: item.title,
    summary: item.aiSummary || item.summary,
    url,
    occurredAt: item.publishedAt || item.discoveredAt || "",
    importanceScore: boundedPriority(item.importanceScore, 0),
    sources: uniqueStrings([item.source]),
    sourceUrls: url ? [url] : [],
  };
}

function newsletterCandidate(item: NewsletterTopic): DigestCandidate {
  const ranked = newsletterPriority(item);
  const sourceUrls = uniqueUrls([item.url, ...item.sourceLinks.map((source) => source.url)]);
  const url = canonical(item.url) || sourceUrls[0] || item.url;
  return {
    id: item.id,
    channel: "newsletters",
    title: item.title,
    summary: item.summary,
    url,
    occurredAt: item.receivedAt,
    importanceScore: boundedPriority(ranked.importanceScore, 0),
    sources: uniqueStrings([
      ...item.sourceLinks.map((source) => source.publisher),
      ...item.newsletterSources,
    ]),
    sourceUrls,
  };
}

function sameEvent(left: DigestCandidate, right: DigestCandidate) {
  const leftUrls = new Set(left.sourceUrls);
  if (right.sourceUrls.some((url) => leftUrls.has(url))) return true;
  if (Math.abs(timestamp(left.occurredAt) - timestamp(right.occurredAt)) > 4 * 86_400_000) return false;
  return eventTitlesMatch(left, right);
}

function clusterCandidates(candidates: DigestCandidate[]) {
  const parent = candidates.map((_candidate, index) => index);
  const find = (index: number): number => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]];
      index = parent[index];
    }
    return index;
  };
  const union = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
  };
  for (let left = 0; left < candidates.length; left += 1) {
    for (let right = left + 1; right < candidates.length; right += 1) {
      if (sameEvent(candidates[left], candidates[right])) union(left, right);
    }
  }
  const groups = new Map<number, DigestCandidate[]>();
  candidates.forEach((candidate, index) => {
    const root = find(index);
    groups.set(root, [...(groups.get(root) || []), candidate]);
  });
  return [...groups.values()];
}

function latestCheckedAt(feeds: Array<LiveFeedResponse | NewsletterFeedResponse | undefined>) {
  return feeds.map((feed) => feed?.checkedAt || "")
    .filter((value) => Number.isFinite(Date.parse(value)))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] || "";
}

export function buildDailyIntelligenceDigest(
  counts: PublicSettings["dailyBrief"]["sections"],
  feeds: {
    industry?: LiveFeedResponse;
    newsletters?: NewsletterFeedResponse;
  },
  now = Date.now(),
): DailyIntelligenceDigest {
  const industry = counts.industry > 0
    ? sortCandidates((feeds.industry?.items || [])
        .filter((item) => activeAt(item, feeds.industry?.freshnessHours || 24, now))
        .map(industryCandidate))
    : [];
  const newsletters = counts.newsletters > 0
    ? sortCandidates((feeds.newsletters?.items || [])
        .filter((item) => activeAt(item, feeds.newsletters?.freshnessHours || 36, now))
        .map(newsletterCandidate))
    : [];
  const groups = clusterCandidates([...industry, ...newsletters]);
  const items = groups.map((group) => {
    const ranked = [...group].sort((left, right) =>
      right.importanceScore - left.importanceScore ||
      timestamp(right.occurredAt) - timestamp(left.occurredAt) ||
      left.id.localeCompare(right.id));
    const primary = ranked[0];
    const anchor = [...group].sort((left, right) =>
      timestamp(left.occurredAt) - timestamp(right.occurredAt) ||
      left.id.localeCompare(right.id))[0];
    const channels = uniqueStrings(group.map((item) => item.channel)) as DigestChannel[];
    const sources = uniqueStrings(group.flatMap((item) => item.sources));
    const sourceUrls = uniqueUrls(group.flatMap((item) => item.sourceUrls));
    const corroborationBoost = channels.length > 1 ? 6 : Math.min(4, Math.max(0, sources.length - 1) * 2);
    return {
      id: `intelligence:${anchor.channel}:${anchor.id}`,
      title: primary.title,
      summary: ranked.find((item) => item.summary.trim().length >= 40)?.summary || primary.summary,
      url: primary.url,
      occurredAt: [...group].sort((left, right) => timestamp(right.occurredAt) - timestamp(left.occurredAt))[0].occurredAt,
      importanceScore: boundedPriority(primary.importanceScore + corroborationBoost),
      sources,
      channels,
      coverageCount: Math.max(sourceUrls.length, sources.length, 1),
    };
  }).sort((left, right) =>
    boundedPriority(right.importanceScore, 0) - boundedPriority(left.importanceScore, 0) ||
    timestamp(right.occurredAt) - timestamp(left.occurredAt) ||
    left.id.localeCompare(right.id));
  const requestedCount = Math.max(0, Math.min(20, counts.industry + counts.newsletters));
  const checkedAt = latestCheckedAt([feeds.industry, feeds.newsletters]);
  return {
    requestedCount,
    availableCount: items.length,
    duplicatesCollapsed: industry.length + newsletters.length - items.length,
    checkedAt,
    configured: Boolean(feeds.industry?.configured || feeds.newsletters?.configured),
    stale: !checkedAt || now - Date.parse(checkedAt) > 60 * 60_000,
    items: items.slice(0, requestedCount),
  };
}
