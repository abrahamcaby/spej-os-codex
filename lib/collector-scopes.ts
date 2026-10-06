import { collectionScope } from "./collection-scope";
import type { PublicSettings } from "./types";
import { isLocalAiProvider } from "./ai-providers";
import { configuredMentionProfiles } from "./mention-work";

type FeedSettings = Pick<PublicSettings, "industry" | "mentions"> & {
  ai: Pick<PublicSettings["ai"], "provider" | "model"> & Partial<Pick<PublicSettings["ai"], "localBaseUrls">>;
};

export function industryCacheScope(settings: FeedSettings) {
  return collectionScope("industry-response-v1", [
    settings.industry.description,
    ...settings.industry.sources.map((source) => `${source.id}:${source.url}`),
    ...settings.industry.keywords.map((keyword) => `topic:${keyword}`),
    ...settings.industry.excludedTerms.map((term) => `exclude:${term}`),
    `limit:${settings.industry.dailyLimit}`,
    `ai:${settings.ai.provider}:${settings.ai.model}`,
    ...(isLocalAiProvider(settings.ai.provider) ? [settings.ai.localBaseUrls?.[settings.ai.provider] || ""] : []),
  ]);
}

export function mentionsCacheScope(settings: FeedSettings) {
  const profiles = configuredMentionProfiles(settings.mentions);
  return collectionScope("mentions-response-v2-profiles", [
    `strict:${settings.mentions.strictMode}`,
    ...profiles.flatMap((profile) => [
      `profile:${profile.id}:${profile.label}:${profile.type}:${profile.enabled}`,
      ...profile.terms.map((term) => `${profile.id}:term:${term}`),
      ...(profile.standaloneCompanyTerms ?? []).map((term) => `${profile.id}:standalone-company:${term}`),
      ...profile.websites.map((website) => `${profile.id}:website:${website}`),
      ...profile.officialProfileUrls.map((url) => `${profile.id}:profile-url:${url}`),
      ...profile.identityAnchors.map((anchor) => `${profile.id}:anchor:${anchor}`),
      ...profile.negativeTerms.map((term) => `${profile.id}:exclude:${term}`),
    ]),
    ...settings.mentions.negativeTerms.map((term) => `exclude:${term}`),
    `exclude-owned:${settings.mentions.excludeOwnedSites}`,
    ...settings.industry.keywords.map((keyword) => `niche:${keyword}`),
    ...(settings.ai.provider !== "none" ? [`description:${settings.industry.description}`] : []),
    `ai:${settings.ai.provider}:${settings.ai.model}`,
    ...(isLocalAiProvider(settings.ai.provider) ? [settings.ai.localBaseUrls?.[settings.ai.provider] || ""] : []),
  ]);
}
