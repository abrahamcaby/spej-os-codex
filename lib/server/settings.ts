import "server-only";

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import {
  mkdir,
  readFile,
  rename,
  writeFile,
  chmod,
  rm,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  AiKeyProvider,
  LocalAiProvider,
  AudienceAccountInput,
  PublicSettings,
  SettingsUpdate,
} from "@/lib/types";
import {
  GOOGLE_OAUTH_CLIENT_ID_ERROR,
  isGoogleOAuthClientId,
} from "@/lib/google-oauth";
import {
  assertMentionIdentityLimit,
  cleanBoundedMentionValues,
  MAX_MENTION_CONTEXT_VALUES,
  MAX_MENTION_IDENTITIES,
  MAX_MENTION_PROFILES,
  MAX_MENTION_VALUE_LENGTH,
  SPEJ_MENTION_PROFILES,
  flattenMentionProfiles,
  migrateMentionProfiles,
} from "@/lib/mention-work";
import { isValidPublicProfileUrl } from "@/lib/public-metrics";
import { AI_KEY_PROVIDERS, DEFAULT_LOCAL_AI_URLS, aiEnvironmentKey, cleanAiModelOverride, isAiExecutionProvider, isAiKeyProvider, isLocalAiProvider, isValidAiModelId, localAiBaseUrl } from "@/lib/ai-providers";
import { getCustomBackgroundAiStatus } from "@/lib/server/custom-background-ai";
import { defaultBriefSections, normalizeBriefSections } from "@/lib/daily-brief-snapshot";
import { spejIndustryDescription, spejIndustryKeywords, spejIndustrySources } from "@/lib/spej-preset";

type StoredAudienceAccount = Omit<
  AudienceAccountInput,
  "credentialSet" | "clearCredential"
> & {
  credential: string;
};

export type StoredSettings = {
  general: { workspaceName: string };
  industry: PublicSettings["industry"];
  mentions: PublicSettings["mentions"];
  newsletters: {
    googleClientId: string;
    googleClientSecret: string;
    connectedEmail: string;
    refreshToken: string;
    accessToken: string;
    accessTokenExpiresAt: number;
    gmailQuery: string;
  };
  audience: { accounts: StoredAudienceAccount[] };
  ai: {
    provider: PublicSettings["ai"]["provider"];
    model: string;
    apiKeys: Record<AiKeyProvider, string>;
    localBaseUrls: Record<LocalAiProvider, string>;
  };
  dailyBrief: PublicSettings["dailyBrief"];
};

const defaultMentionProfiles = SPEJ_MENTION_PROFILES.map((profile) => structuredClone(profile));
const defaultMentionFlat = flattenMentionProfiles(defaultMentionProfiles);

const defaults: StoredSettings = {
  general: { workspaceName: "Spej" },
  industry: {
    sources: spejIndustrySources,
    keywords: spejIndustryKeywords,
    description: spejIndustryDescription,
    excludedTerms: [],
    dailyLimit: 30,
  },
  mentions: {
    profiles: defaultMentionProfiles,
    ...defaultMentionFlat,
    negativeTerms: [],
    strictMode: true,
    excludeOwnedSites: true,
  },
  newsletters: {
    googleClientId: "",
    googleClientSecret: "",
    connectedEmail: "",
    refreshToken: "",
    accessToken: "",
    accessTokenExpiresAt: 0,
    gmailQuery: "newer_than:30d (category:updates OR category:promotions)",
  },
  audience: { accounts: [] },
  ai: {
    provider: "none",
    model: "",
    apiKeys: { openai: "", anthropic: "", gemini: "", xai: "", lmstudio: "", ollama: "" },
    localBaseUrls: { ...DEFAULT_LOCAL_AI_URLS },
  },
  dailyBrief: { sourceLabels: [], lookbackDays: 7, sections: defaultBriefSections },
};

let settingsWriteQueue = Promise.resolve();

function serializeSettingsWrite<T>(operation: () => Promise<T>) {
  const result = settingsWriteQueue.then(operation, operation);
  settingsWriteQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export function defaultDataDirectory() {
  if (process.platform === "darwin")
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Spej Control Center",
    );
  if (process.platform === "win32")
    return path.join(
      process.env.LOCALAPPDATA || process.env.APPDATA || os.homedir(),
      "Spej Control Center",
    );
  return path.join(
    process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"),
    "spej-control-center",
  );
}

export function dataDirectory() {
  const configured = process.env.CONTROL_CENTER_DATA_DIR?.trim();
  if (configured) {
    if (!path.isAbsolute(configured))
      throw new Error("CONTROL_CENTER_DATA_DIR must be an absolute path.");
    return configured;
  }
  const legacy = path.join(process.cwd(), ".spej-control-center");
  return existsSync(legacy) ? legacy : defaultDataDirectory();
}

export function legacyBrowserImportAllowed() {
  const legacy = path.join(process.cwd(), ".spej-control-center");
  return existsSync(legacy) && path.resolve(dataDirectory()) === path.resolve(legacy);
}

export function settingsPath() {
  return path.join(dataDirectory(), "settings.json");
}

export function snapshotsPath() {
  return path.join(dataDirectory(), "snapshots.json");
}

export function industrySnapshotsPath() {
  return path.join(dataDirectory(), "industry-snapshots.json");
}

export async function readSettings(): Promise<StoredSettings> {
  try {
    const parsed = JSON.parse(
      await readFile(settingsPath(), "utf8"),
    ) as Partial<StoredSettings>;
    const legacyMentions = { ...defaults.mentions, ...parsed.mentions };
    const mentionProfiles = migrateMentionProfiles({
      ...legacyMentions,
      profiles: parsed.mentions?.profiles,
    });
    return {
      general: { ...defaults.general, ...parsed.general },
      industry: { ...defaults.industry, ...parsed.industry },
      mentions: {
        ...legacyMentions,
        ...flattenMentionProfiles(mentionProfiles),
        profiles: mentionProfiles,
      },
      newsletters: { ...defaults.newsletters, ...parsed.newsletters },
      audience: {
        accounts: (parsed.audience?.accounts ?? []).map((account) => ({
          ...account,
          profileUrl: account.profileUrl ?? "",
        })),
      },
      ai: {
        provider: isAiExecutionProvider(parsed.ai?.provider) ? parsed.ai.provider : "none",
        // Older browser autofill could persist an email in the free-text model
        // field. Present Default without rewriting the user's file on read.
        model: isValidAiModelId(parsed.ai?.model) && parsed.ai.model !== "default" ? parsed.ai.model : "",
        // Do not carry unknown/custom credentials or readiness flags from disk.
        apiKeys: Object.fromEntries(AI_KEY_PROVIDERS.map((provider) => [
          provider,
          typeof parsed.ai?.apiKeys?.[provider] === "string" ? parsed.ai.apiKeys[provider] : "",
        ])) as Record<AiKeyProvider, string>,
        localBaseUrls: {
          lmstudio: typeof parsed.ai?.localBaseUrls?.lmstudio === "string" ? parsed.ai.localBaseUrls.lmstudio : DEFAULT_LOCAL_AI_URLS.lmstudio,
          ollama: typeof parsed.ai?.localBaseUrls?.ollama === "string" ? parsed.ai.localBaseUrls.ollama : DEFAULT_LOCAL_AI_URLS.ollama,
        },
      },
      dailyBrief: { ...defaults.dailyBrief, ...parsed.dailyBrief, sections: normalizeBriefSections(parsed.dailyBrief?.sections) },
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return structuredClone(defaults);
  }
}

async function writeSettingsUnlocked(settings: StoredSettings) {
  const directory = dataDirectory();
  const target = settingsPath();
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    await writeFile(temporary, `${JSON.stringify(settings, null, 2)}\n`, {
      mode: 0o600,
    });
    await rename(temporary, target);
    await chmod(target, 0o600);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function writeSettings(settings: StoredSettings) {
  return serializeSettingsWrite(() => writeSettingsUnlocked(settings));
}

export function toPublicSettings(settings: StoredSettings): PublicSettings {
  const aiKeySource = (provider: AiKeyProvider) =>
    settings.ai.apiKeys[provider]?.trim()
      ? "settings" as const
      : environmentAiApiKey(provider)
        ? "environment" as const
        : "none" as const;
  return {
    general: settings.general,
    industry: settings.industry,
    mentions: settings.mentions,
    newsletters: {
      googleClientId: settings.newsletters.googleClientId,
      googleClientSecretSet: Boolean(settings.newsletters.googleClientSecret),
      connected: Boolean(
        settings.newsletters.refreshToken &&
          settings.newsletters.connectedEmail,
      ),
      connectedEmail: settings.newsletters.connectedEmail,
      gmailQuery: settings.newsletters.gmailQuery,
    },
    audience: {
      accounts: settings.audience.accounts.map(
        ({ credential, ...account }) => ({
          ...account,
          profileUrl:
            account.profileUrl &&
            isValidPublicProfileUrl(account.platform, account.profileUrl)
              ? account.profileUrl
              : "",
          credentialSet: Boolean(credential),
        }),
      ),
    },
    ai: {
      provider: settings.ai.provider,
      model: settings.ai.model,
      customProvider: getCustomBackgroundAiStatus(),
      localBaseUrls: {
        lmstudio: settings.ai.localBaseUrls.lmstudio ?? DEFAULT_LOCAL_AI_URLS.lmstudio,
        ollama: settings.ai.localBaseUrls.ollama ?? DEFAULT_LOCAL_AI_URLS.ollama,
      },
      keySet: {
        openai: Boolean(configuredAiApiKey(settings, "openai")),
        anthropic: Boolean(configuredAiApiKey(settings, "anthropic")),
        gemini: Boolean(configuredAiApiKey(settings, "gemini")),
        xai: Boolean(configuredAiApiKey(settings, "xai")),
        lmstudio: Boolean(configuredAiApiKey(settings, "lmstudio")),
        ollama: Boolean(configuredAiApiKey(settings, "ollama")),
      },
      keySource: {
        openai: aiKeySource("openai"),
        anthropic: aiKeySource("anthropic"),
        gemini: aiKeySource("gemini"),
        xai: aiKeySource("xai"),
        lmstudio: aiKeySource("lmstudio"),
        ollama: aiKeySource("ollama"),
      },
    },
    dailyBrief: settings.dailyBrief,
  };
}

export function configuredAiApiKey(
  settings: StoredSettings,
  provider: AiKeyProvider,
) {
  return settings.ai.apiKeys[provider]?.trim() || environmentAiApiKey(provider);
}

export function configuredAiReady(settings: StoredSettings) {
  const provider = settings.ai.provider;
  if (provider === "custom") return getCustomBackgroundAiStatus().available;
  return provider !== "none" && (isLocalAiProvider(provider) || Boolean(configuredAiApiKey(settings, provider)));
}

function environmentAiApiKey(provider: AiKeyProvider) {
  // OLLAMA_API_KEY is intentionally not an alias: it belongs to Ollama Cloud.
  return aiEnvironmentKey(provider, process.env);
}

function cleanList(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function cleanIndustrySources(sources: SettingsUpdate["industry"]["sources"]) {
  const cleaned = sources.flatMap((source) => {
    const value = source.url.trim();
    if (!value) return [];
    let url: URL;
    try {
      url = new URL(value.includes("://") ? value : `https://${value}`);
    } catch {
      throw new Error(
        `${source.name.trim() || value}: enter a valid website, RSS, or Atom URL.`,
      );
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      throw new Error(
        `${source.name.trim() || value}: only public HTTP or HTTPS URLs without embedded credentials are supported.`,
      );
    }
    return [
      {
        id: source.id.trim() || randomUUID(),
        name: source.name.trim() || url.hostname.replace(/^www\./, ""),
        url: url.toString(),
      },
    ];
  });
  return [...new Map(cleaned.map((source) => [source.url, source])).values()];
}

function cleanMentionProfileUrls(values: string[], label: string) {
  return cleanBoundedMentionValues(values, label, MAX_MENTION_IDENTITIES).map((value) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`${label}: enter a complete public HTTPS profile URL.`);
    }
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error(`${label}: only public HTTPS profile URLs without embedded credentials are supported.`);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  });
}

export async function updateSettings(update: SettingsUpdate) {
  return serializeSettingsWrite(async () => {
    const current = await readSettings();
    const currentAccounts = new Map(
      current.audience.accounts.map((account) => [account.id, account]),
    );
    const nextAiKeys = { ...current.ai.apiKeys };
    for (const provider of update.ai?.clearKeys ?? []) {
      if (isAiKeyProvider(provider))
        nextAiKeys[provider] = "";
    }
    for (const provider of AI_KEY_PROVIDERS) {
      const incoming = update.ai?.apiKeys?.[provider]?.trim();
      if (incoming) {
        if (incoming.length > 2_000 || /[\r\n]/.test(incoming))
          throw new Error("The provider key is not valid. Paste only the API key or local server token.");
        nextAiKeys[provider] = incoming;
      }
    }
    const cleanedAccounts = update.audience.accounts.map((account) => {
      const profileUrl = account.profileUrl?.trim() || "";
      if (
        profileUrl &&
        !isValidPublicProfileUrl(account.platform, profileUrl)
      ) {
        throw new Error(
          `${account.label.trim() || account.platform}: enter a valid ${account.platform} profile URL, or leave the URL blank and use the handle.`,
        );
      }
      if (
        !account.username.trim() &&
        !profileUrl &&
        !account.accountId.trim()
      ) {
        throw new Error(
          `${account.label.trim() || account.platform}: add a username, public profile URL, or official account ID.`,
        );
      }
      return {
        id: account.id.trim() || randomUUID(),
        platform: account.platform,
        label: account.label.trim() || account.platform,
        username: account.username.trim().replace(/^@/, ""),
        accountId: account.accountId.trim(),
        profileUrl,
        credential: account.clearCredential
          ? ""
          : account.credential?.trim() ||
            currentAccounts.get(account.id)?.credential ||
            "",
      };
    });
    const accountKeys = new Set<string>();
    for (const account of cleanedAccounts) {
      const identity = (
        account.profileUrl ||
        account.username ||
        account.accountId
      )
        .toLowerCase()
        .replace(/\/$/, "");
      const key = `${account.platform}:${identity}`;
      if (accountKeys.has(key)) {
        throw new Error(
          `${account.label}: this ${account.platform} profile is already in Audience settings.`,
        );
      }
      accountKeys.add(key);
    }
    const incomingMentionProfiles = migrateMentionProfiles(update.mentions);
    if (incomingMentionProfiles.length > MAX_MENTION_PROFILES)
      throw new Error(`Mentions supports up to ${MAX_MENTION_PROFILES} identity profiles.`);
    const mentionProfileIds = new Set<string>();
    const mentionProfiles = incomingMentionProfiles.map((profile, index) => {
      const label = profile.label.trim().slice(0, MAX_MENTION_VALUE_LENGTH) || `Identity ${index + 1}`;
      const terms = cleanBoundedMentionValues(
        profile.terms,
        `${label} names and handles`,
        MAX_MENTION_IDENTITIES,
      );
      const websites = cleanBoundedMentionValues(
        profile.websites,
        `${label} official websites`,
        MAX_MENTION_IDENTITIES,
      );
      assertMentionIdentityLimit(terms, websites);
      const id = profile.id.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `identity-${index + 1}`;
      if (mentionProfileIds.has(id)) throw new Error(`Mention identity profile IDs must be unique (${id}).`);
      mentionProfileIds.add(id);
      return {
        id,
        label,
        type: profile.type,
        enabled: profile.enabled !== false,
        terms,
        standaloneCompanyTerms: profile.type === "company"
          ? cleanBoundedMentionValues(profile.standaloneCompanyTerms ?? [], `${label} standalone company aliases`, MAX_MENTION_IDENTITIES)
          : [],
        websites,
        officialProfileUrls: cleanMentionProfileUrls(profile.officialProfileUrls, `${label} official profiles`),
        identityAnchors: cleanBoundedMentionValues(
          profile.identityAnchors,
          `${label} identity anchors`,
          MAX_MENTION_CONTEXT_VALUES,
        ),
        negativeTerms: cleanBoundedMentionValues(
          profile.negativeTerms,
          `${label} excluded contexts`,
          MAX_MENTION_CONTEXT_VALUES,
        ),
      };
    });
    const mentionFlat = flattenMentionProfiles(mentionProfiles);
    const mentionNegativeTerms = cleanBoundedMentionValues(
      update.mentions.negativeTerms ?? [],
      "Mention excluded contexts",
      MAX_MENTION_CONTEXT_VALUES,
    );
    const googleClientId = update.newsletters.googleClientId.trim();
    if (googleClientId && !isGoogleOAuthClientId(googleClientId))
      throw new Error(GOOGLE_OAUTH_CLIENT_ID_ERROR);
    const next: StoredSettings = {
      general: {
        workspaceName:
          update.general.workspaceName.trim() || defaults.general.workspaceName,
      },
      industry: {
        sources: cleanIndustrySources(update.industry.sources),
        keywords: cleanList(update.industry.keywords),
        description: (update.industry.description ?? "").trim().slice(0, 1_000),
        excludedTerms: cleanList(update.industry.excludedTerms ?? []),
        dailyLimit: Math.min(
          50,
          Math.max(
            10,
            Math.round(Number(update.industry.dailyLimit) || defaults.industry.dailyLimit),
          ),
        ),
      },
      mentions: {
        profiles: mentionProfiles,
        ...mentionFlat,
        negativeTerms: mentionNegativeTerms,
        strictMode: update.mentions.strictMode !== false,
        excludeOwnedSites: update.mentions.excludeOwnedSites !== false,
      },
      newsletters: {
        ...current.newsletters,
        googleClientId,
        googleClientSecret:
          update.newsletters.googleClientSecret?.trim() ||
          current.newsletters.googleClientSecret,
        gmailQuery:
          update.newsletters.gmailQuery?.trim().slice(0, 500) ||
          defaults.newsletters.gmailQuery,
      },
      audience: {
        accounts: cleanedAccounts,
      },
      ai: {
        provider: update.ai === undefined
          ? current.ai.provider
          : isAiExecutionProvider(update.ai.provider)
            ? update.ai.provider
            : "none",
        model: update.ai === undefined
          ? current.ai.model
          : cleanAiModelOverride(update.ai.model),
        apiKeys: nextAiKeys,
        localBaseUrls: {
          lmstudio: localAiBaseUrl("lmstudio", update.ai?.localBaseUrls?.lmstudio ?? current.ai.localBaseUrls.lmstudio),
          ollama: localAiBaseUrl("ollama", update.ai?.localBaseUrls?.ollama ?? current.ai.localBaseUrls.ollama),
        },
      },
      dailyBrief: {
        sections: normalizeBriefSections(update.dailyBrief?.sections ?? current.dailyBrief.sections),
        sourceLabels: cleanList(update.dailyBrief?.sourceLabels ?? []),
        lookbackDays: Math.min(
          30,
          Math.max(
            1,
            Math.round(
              Number(update.dailyBrief?.lookbackDays) ||
                defaults.dailyBrief.lookbackDays,
            ),
          ),
        ),
      },
    };
    await writeSettingsUnlocked(next);
    return toPublicSettings(next);
  });
}

export async function saveGmailTokens(tokens: {
  email: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}) {
  return serializeSettingsWrite(async () => {
    const settings = await readSettings();
    settings.newsletters.connectedEmail = tokens.email;
    settings.newsletters.accessToken = tokens.accessToken;
    settings.newsletters.accessTokenExpiresAt = tokens.expiresAt;
    if (tokens.refreshToken)
      settings.newsletters.refreshToken = tokens.refreshToken;
    await writeSettingsUnlocked(settings);
  });
}

export async function disconnectGmail() {
  return serializeSettingsWrite(async () => {
    const settings = await readSettings();
    settings.newsletters.connectedEmail = "";
    settings.newsletters.refreshToken = "";
    settings.newsletters.accessToken = "";
    settings.newsletters.accessTokenExpiresAt = 0;
    await writeSettingsUnlocked(settings);
  });
}
