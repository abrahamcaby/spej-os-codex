import type { MentionIdentityProfile, PublicSettings } from "./types";

export const MAX_MENTION_IDENTITIES = 12;
export const MAX_MENTION_PROFILES = 20;
export const MAX_MENTION_CONTEXT_VALUES = 24;
export const MAX_MENTION_VALUE_LENGTH = 200;
export const MENTION_SEARCH_CONCURRENCY = 6;
export const MENTION_AI_CONCURRENCY = 2;

export const SPEJ_MENTION_PROFILES: MentionIdentityProfile[] = [
  {
    id: "spej-ai",
    label: "Spej AI",
    type: "company",
    enabled: true,
    terms: ["Spej AI", "Spej", "@spejai"],
    standaloneCompanyTerms: ["Spej AI", "Spej"],
    websites: ["spej.ai"],
    officialProfileUrls: ["https://www.linkedin.com/company/spejai"],
    identityAnchors: ["Sagar Pandya", "Sean Blair", "Alex Krutik", "Joseph Kim", "Ken Peel", "Aby Abraham"],
    negativeTerms: [],
  },
  {
    id: "sagar-pandya",
    label: "Sagar Pandya",
    type: "person",
    enabled: true,
    terms: ["Sagar Pandya", "@heysagarpandya"],
    websites: [],
    officialProfileUrls: ["https://www.linkedin.com/in/heysagarpandya"],
    identityAnchors: ["Spej", "spej.ai", "Founder of Spej", "CEO of Spej", "Prompt First, Ask Later", "pfalpod.com"],
    negativeTerms: [],
  },
  {
    id: "sean-blair",
    label: "Sean Blair",
    type: "person",
    enabled: true,
    terms: ["Sean Blair"],
    websites: [],
    officialProfileUrls: [],
    identityAnchors: ["Spej", "spej.ai"],
    negativeTerms: [],
  },
  {
    id: "alex-krutik",
    label: "Alex Krutik",
    type: "person",
    enabled: true,
    terms: ["Alex Krutik"],
    websites: [],
    officialProfileUrls: [],
    identityAnchors: ["Spej", "spej.ai"],
    negativeTerms: [],
  },
  {
    id: "joseph-kim",
    label: "Joseph Kim",
    type: "person",
    enabled: true,
    terms: ["Joseph Kim"],
    websites: [],
    officialProfileUrls: [],
    identityAnchors: ["Spej", "spej.ai"],
    negativeTerms: [],
  },
  {
    id: "ken-peel",
    label: "Ken Peel",
    type: "person",
    enabled: true,
    terms: ["Ken Peel"],
    websites: [],
    officialProfileUrls: [],
    identityAnchors: ["Spej", "spej.ai"],
    negativeTerms: [],
  },
  {
    id: "aby-abraham",
    label: "Aby C. Abraham",
    type: "person",
    enabled: true,
    terms: ["Aby C. Abraham", "Aby C Abraham", "Aby Abraham", "@abycabraham"],
    websites: [],
    officialProfileUrls: ["https://www.linkedin.com/in/abycabraham"],
    identityAnchors: ["Spej", "spej.ai", "Director of AI Adoption and Strategic Partnerships", "Director, AI Adoption & Strategic Partnerships"],
    negativeTerms: [],
  },
];

type MentionSettingsLike = Pick<PublicSettings["mentions"],
  "profiles" | "terms" | "websites" | "identityAnchors">;

function cleanProfileId(value: string, fallback: string) {
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return cleaned || fallback;
}

function cleanProfileValues(values: unknown) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.flatMap((value) => typeof value === "string" && value.trim() ? [value.trim()] : []))];
}

function normalizedProfile(profile: Partial<MentionIdentityProfile>, index: number): MentionIdentityProfile | null {
  const terms = cleanProfileValues(profile.terms);
  const websites = cleanProfileValues(profile.websites);
  if (!terms.length && !websites.length) return null;
  const label = typeof profile.label === "string" && profile.label.trim()
    ? profile.label.trim()
    : terms[0] || websites[0];
  return {
    id: cleanProfileId(typeof profile.id === "string" ? profile.id : "", `identity-${index + 1}`),
    label,
    type: profile.type === "company" || profile.type === "person" ? profile.type : "custom",
    enabled: profile.enabled !== false,
    terms,
    standaloneCompanyTerms: profile.type === "company"
      ? cleanProfileValues(profile.standaloneCompanyTerms ??
        (profile.id === "spej-ai" ? ["Spej AI", "Spej"] : []))
      : [],
    websites,
    officialProfileUrls: cleanProfileValues(profile.officialProfileUrls),
    identityAnchors: cleanProfileValues(profile.identityAnchors),
    negativeTerms: cleanProfileValues(profile.negativeTerms),
  };
}

/**
 * Converts the legacy flat watchlist into isolated profiles. Known Spej
 * identities receive verified, identity-local defaults. Unknown legacy terms
 * are deliberately split instead of inheriting one shared anchor pool.
 */
export function migrateMentionProfiles(settings: MentionSettingsLike): MentionIdentityProfile[] {
  if (Array.isArray(settings.profiles)) {
    const seen = new Set<string>();
    return settings.profiles.flatMap((profile, index) => {
      const normalized = normalizedProfile(profile, index);
      if (!normalized || seen.has(normalized.id)) return [];
      seen.add(normalized.id);
      return [normalized];
    });
  }

  if (!cleanProfileValues(settings.terms).length && !cleanProfileValues(settings.websites).length)
    return [];

  const legacyIdentities = [...cleanProfileValues(settings.terms), ...cleanProfileValues(settings.websites)];
  const legacyKeys = new Set(legacyIdentities.map((value) => value.toLocaleLowerCase()));
  const officialCatalog = SPEJ_MENTION_PROFILES.map((profile) => structuredClone(profile));
  const official = officialCatalog.filter((profile) => [...profile.terms, ...profile.websites]
    .some((identity) => legacyKeys.has(identity.toLocaleLowerCase())));
  const known = new Set(officialCatalog.flatMap((profile) => [...profile.terms, ...profile.websites])
    .map((value) => value.trim().toLocaleLowerCase()));
  const unknownTerms = cleanProfileValues(settings.terms)
    .filter((term) => !known.has(term.toLocaleLowerCase()));
  const unknownWebsites = cleanProfileValues(settings.websites)
    .filter((website) => !known.has(website.toLocaleLowerCase()));
  const customValues = [...unknownTerms.map((value) => ({ value, website: false })),
    ...unknownWebsites.map((value) => ({ value, website: true }))];
  const legacyAnchors = customValues.length === 1 ? cleanProfileValues(settings.identityAnchors) : [];
  const custom = customValues.map(({ value, website }, index): MentionIdentityProfile => ({
    id: cleanProfileId(value, `legacy-${index + 1}`),
    label: value,
    type: "custom",
    enabled: true,
    terms: website ? [] : [value],
    standaloneCompanyTerms: [],
    websites: website ? [value] : [],
    officialProfileUrls: [],
    identityAnchors: legacyAnchors,
    negativeTerms: [],
  }));
  return [...official, ...custom];
}

export function configuredMentionProfiles(settings: MentionSettingsLike) {
  return migrateMentionProfiles(settings).filter((profile) =>
    profile.enabled && (profile.terms.length > 0 || profile.websites.length > 0));
}

export function mentionProfileIdentities(profile: MentionIdentityProfile) {
  return [...new Set([...profile.terms, ...profile.websites].map((value) => value.trim()).filter(Boolean))];
}

export function flattenMentionProfiles(profiles: MentionIdentityProfile[]) {
  return {
    terms: [...new Set(profiles.flatMap((profile) => profile.terms))],
    websites: [...new Set(profiles.flatMap((profile) => profile.websites))],
    identityAnchors: [...new Set(profiles.flatMap((profile) => profile.identityAnchors))],
  };
}

export function groupMentionProfiles(profiles: MentionIdentityProfile[], groupSize = 2) {
  const size = Math.max(1, Math.round(groupSize));
  const groups: MentionIdentityProfile[][] = [];
  for (let index = 0; index < profiles.length; index += size)
    groups.push(profiles.slice(index, index + size));
  return groups;
}

export function cleanBoundedMentionValues(
  values: string[],
  label: string,
  maxItems: number,
) {
  if (!Array.isArray(values)) throw new Error(`${label} must be a list.`);
  const cleaned = [...new Set(values.map((value) => {
    if (typeof value !== "string") throw new Error(`${label} must contain text values only.`);
    const candidate = value.trim();
    if (candidate.length > MAX_MENTION_VALUE_LENGTH) {
      throw new Error(
        `${label} entries must be ${MAX_MENTION_VALUE_LENGTH} characters or fewer.`,
      );
    }
    return candidate;
  }).filter(Boolean))];
  if (cleaned.length > maxItems) {
    throw new Error(`${label} supports up to ${maxItems} entries.`);
  }
  return cleaned;
}

export function assertMentionIdentityLimit(terms: string[], websites: string[]) {
  const identities = configuredMentionIdentities(terms, websites);
  if (identities.length > MAX_MENTION_IDENTITIES) {
    throw new Error(
      `Mentions supports up to ${MAX_MENTION_IDENTITIES} unique names, brands, handles, and websites total.`,
    );
  }
  return identities;
}

export function configuredMentionIdentities(terms: string[], websites: string[]) {
  return [...new Set([...terms, ...websites].map((value) => value.trim()).filter(Boolean))];
}

export function groupMentionIdentities(
  terms: string[],
  websites: string[],
  groupSize = 2,
) {
  const identities = configuredMentionIdentities(terms, websites);
  const size = Math.max(1, Math.round(groupSize));
  const groups: string[][] = [];
  for (let index = 0; index < identities.length; index += size) {
    groups.push(identities.slice(index, index + size));
  }
  return groups;
}

export async function settleMentionWork<Input, Output>(
  items: Input[],
  concurrency: number,
  operation: (item: Input, index: number) => Promise<Output>,
) {
  const results = new Array<PromiseSettledResult<Output>>(items.length);
  const workerCount = Math.min(
    items.length,
    Math.max(1, Math.round(Number.isFinite(concurrency) ? concurrency : 1)),
  );
  let nextIndex = 0;
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      try {
        results[index] = { status: "fulfilled", value: await operation(items[index], index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

export function mentionResearchCoverage(
  groups: readonly (readonly unknown[])[],
  results: PromiseSettledResult<unknown>[],
) {
  let completedIdentityCount = 0;
  let failedIdentityCount = 0;
  let failedGroupCount = 0;
  groups.forEach((group, index) => {
    if (results[index]?.status === "fulfilled") completedIdentityCount += group.length;
    else {
      failedIdentityCount += group.length;
      failedGroupCount += 1;
    }
  });
  return {
    totalIdentityCount: completedIdentityCount + failedIdentityCount,
    completedIdentityCount,
    failedIdentityCount,
    failedGroupCount,
  };
}
