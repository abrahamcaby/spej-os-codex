import "server-only";

import { createHash } from "node:crypto";
import { canonicalizeMentionUrl } from "@/lib/mention-filter";
import {
  configuredMentionProfiles,
  groupMentionProfiles,
  MENTION_AI_CONCURRENCY,
  mentionResearchCoverage,
  settleMentionWork,
} from "@/lib/mention-work";
import { parseAiJson, runConfiguredAi } from "@/lib/server/ai";
import type { StoredSettings } from "@/lib/server/settings";
import type { AiKeyProvider } from "@/lib/types";
import type { MentionIdentityProfile } from "@/lib/types";

type MentionResearchCandidate = { url: string; profileId: string };

type CachedMentionResearch = {
  expiresAt: number;
  result: Promise<{
    provider: AiKeyProvider;
    candidates: MentionResearchCandidate[];
    urls: string[];
    totalIdentityCount: number;
    completedIdentityCount: number;
    failedIdentityCount: number;
    failedGroupCount: number;
  }>;
};

declare global {
  var controlCenterMentionAiCache: Map<string, CachedMentionResearch> | undefined;
}

function cache() {
  return globalThis.controlCenterMentionAiCache ??=
    new Map<string, CachedMentionResearch>();
}

function researchKey(settings: StoredSettings, now: number) {
  return createHash("sha256").update(JSON.stringify({
    provider: settings.ai.provider,
    model: settings.ai.model,
    profiles: configuredMentionProfiles(settings.mentions),
    negatives: settings.mentions.negativeTerms,
    niche: settings.industry.description,
    topics: settings.industry.keywords,
    twoHourBucket: Math.floor(now / (2 * 60 * 60 * 1000)),
  })).digest("hex");
}

function validResearchCandidates(value: unknown, profileIds: Set<string>, limit = 16) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("The AI mention response was not an object.");
  const candidates = (value as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates))
    throw new Error("The AI mention response omitted candidates.");
  const urls = candidates.flatMap((candidate): MentionResearchCandidate[] => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const raw = (candidate as { url?: unknown }).url;
    const profileId = (candidate as { profileId?: unknown }).profileId;
    if (typeof profileId !== "string" || !profileIds.has(profileId)) return [];
    if (typeof raw !== "string") return [];
    const canonical = canonicalizeMentionUrl(raw);
    if (!canonical) return [];
    try {
      const url = new URL(canonical);
      if (!/^https?:$/.test(url.protocol)) return [];
      const host = url.hostname.toLowerCase();
      if (
        host === "google.com" || host.endsWith(".google.com") ||
        host === "bing.com" || host.endsWith(".bing.com")
      ) return [];
      return [{ url: canonical, profileId }];
    } catch {
      return [];
    }
  });
  return [...new Map(urls.map((candidate) => [`${candidate.profileId}:${candidate.url}`, candidate])).values()].slice(0, limit);
}

function researchPrompt(
  settings: StoredSettings,
  profiles: MentionIdentityProfile[],
  windowDays: number,
) {
  return [
    `Run a focused public-web search for new third-party mentions from the past ${windowDays} days.`,
    "Use no more than two targeted searches per identity profile and return at most 12 strong direct URLs total.",
    "This is discovery only. Return direct canonical page or post URLs where an exact configured identity appears; never return search-result URLs or homepages.",
    `Identity profiles for this focused pass: ${JSON.stringify(profiles.map((profile) => ({ id: profile.id, label: profile.label, terms: profile.terms, standaloneCompanyTerms: profile.standaloneCompanyTerms, websites: profile.websites, officialProfileUrls: profile.officialProfileUrls, identityAnchors: profile.identityAnchors, negativeTerms: profile.negativeTerms })))}`,
    `Industry description: ${settings.industry.description || "not supplied"}`,
    `Industry topics: ${JSON.stringify(settings.industry.keywords)}`,
    `Known false-positive contexts: ${JSON.stringify(settings.mentions.negativeTerms)}`,
    "Look across articles, podcast/show notes, video pages, newsletters, directories, forums, Reddit, GitHub, Instagram, TikTok, LinkedIn, Threads, and X. Do not include Facebook.",
    "Disambiguate common names aggressively. Evidence and anchors from one profile must never be used to validate another profile.",
    "Generic category words such as AI, media, content, marketing, sales, business, technology, creator, founder, or leadership never prove identity.",
    "Official domains may establish identity but are not third-party mentions and should not be returned.",
    "Do not treat snippets as proof. The app will independently fetch every URL and reject pages without literal URL-local evidence.",
    "Return JSON only: {\"candidates\":[{\"profileId\":\"supplied-profile-id\",\"url\":\"https://direct.example/page-or-post\"}]}. Use only supplied profile IDs. Return an empty array when no credible new URLs are found.",
  ].join("\n\n");
}

export async function researchMentionsWithAi(
  settings: StoredSettings,
  options: { now?: number; windowDays: number },
) {
  const now = options.now ?? Date.now();
  const key = researchKey(settings, now);
  const existing = cache().get(key);
  if (existing && existing.expiresAt > now) return existing.result;
  for (const [storedKey, entry] of cache()) {
    if (entry.expiresAt <= now) cache().delete(storedKey);
  }
  const profiles = configuredMentionProfiles(settings.mentions);
  const groups = groupMentionProfiles(profiles);
  const result = settleMentionWork(groups, MENTION_AI_CONCURRENCY, async (profileGroup) => {
    const response = await runConfiguredAi(settings, {
      webSearch: true,
      maxOutputTokens: 2_500,
      prompt: researchPrompt(settings, profileGroup, options.windowDays),
    });
    return {
      provider: response.provider,
      candidates: validResearchCandidates(parseAiJson<unknown>(response.text), new Set(profileGroup.map(({ id }) => id)), 12),
    };
  }).then((responses) => {
      const fulfilled = responses.filter(
        (response): response is PromiseFulfilledResult<{
          provider: AiKeyProvider;
          candidates: MentionResearchCandidate[];
        }> =>
          response.status === "fulfilled",
      );
      if (!fulfilled.length) {
        const failure = responses.find((response) => response.status === "rejected") as PromiseRejectedResult | undefined;
        throw failure?.reason instanceof Error
          ? failure.reason
          : new Error("The selected AI provider could not complete web research.");
      }
      const candidates = [...new Map(fulfilled.flatMap((response) => response.value.candidates)
        .map((candidate) => [`${candidate.profileId}:${candidate.url}`, candidate])).values()].slice(0, 40);
      return {
        provider: fulfilled[0].value.provider,
        candidates,
        urls: [...new Set(candidates.map(({ url }) => url))],
        ...mentionResearchCoverage(groups, responses),
      };
    });
  cache().set(key, { expiresAt: now + 2 * 60 * 60 * 1000, result });
  result.catch(() => {
    const current = cache().get(key);
    if (current?.result === result) cache().delete(key);
  });
  return result;
}
