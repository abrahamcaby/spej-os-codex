import assert from "node:assert/strict";
import test from "node:test";

import { buildDailyIntelligenceDigest } from "../lib/intelligence-digest";
import type { LiveFeedResponse, LiveStory, NewsletterFeedResponse, NewsletterTopic } from "../lib/types";

const now = Date.parse("2026-08-27T15:00:00Z");

function industry(overrides: Partial<LiveStory> = {}): LiveStory {
  return {
    id: "industry-one",
    title: "OpenAI releases a new enterprise agent platform",
    summary: "OpenAI released a new platform for enterprise agent workflows.",
    url: "https://publisher.example/openai-agents?utm_source=rss",
    source: "Publisher",
    publishedAt: "2026-08-27T12:00:00Z",
    importanceScore: 72,
    ...overrides,
  };
}

function newsletter(overrides: Partial<NewsletterTopic> = {}): NewsletterTopic {
  return {
    id: "newsletter-one",
    kind: "newsletter-topic",
    title: "OpenAI releases new enterprise agent platform",
    summary: "The launch gives enterprise teams new controls for building agent workflows.",
    url: "https://publisher.example/openai-agents",
    gmailUrl: "https://mail.google.com/mail/u/0/#inbox/example",
    receivedAt: "2026-08-27T13:00:00Z",
    importanceScore: 76,
    coverageCount: 1,
    newsletterCount: 1,
    newsletterSources: ["AI Brief"],
    sourceLinks: [{
      url: "https://publisher.example/openai-agents?ref=newsletter",
      title: "OpenAI releases a new enterprise agent platform",
      publisher: "Publisher",
    }],
    collectionScope: "test",
    ...overrides,
  };
}

function feeds(items: LiveStory[], topics: NewsletterTopic[]) {
  const industryFeed: LiveFeedResponse = {
    configured: true,
    checkedAt: "2026-08-27T14:45:00Z",
    errors: [],
    freshnessHours: 24,
    items,
  };
  const newsletterFeed: NewsletterFeedResponse = {
    configured: true,
    connected: true,
    checkedAt: "2026-08-27T14:50:00Z",
    archiveCount: 0,
    archivedItems: [],
    errors: [],
    freshnessHours: 36,
    items: topics,
  };
  return { industry: industryFeed, newsletters: newsletterFeed };
}

test("daily intelligence collapses the same canonical story across public web and inbox", () => {
  const result = buildDailyIntelligenceDigest(
    { industry: 5, mentions: 5, newsletters: 5 },
    feeds([industry()], [newsletter()]),
    now,
  );
  assert.equal(result.items.length, 1);
  assert.equal(result.duplicatesCollapsed, 1);
  assert.deepEqual(result.items[0].channels, ["industry", "newsletters"]);
  assert.deepEqual(result.items[0].sources, ["Publisher", "AI Brief"]);
  assert.equal(result.items[0].coverageCount, 2);
});

test("daily intelligence merges similar cross-channel headlines but keeps unrelated events separate", () => {
  const related = newsletter({
    url: "https://newsletter.example/openai-launch",
    sourceLinks: [{
      url: "https://different.example/openai-launch",
      title: "OpenAI releases new enterprise agent platform",
      publisher: "Different Publisher",
    }],
  });
  const unrelated = newsletter({
    id: "newsletter-two",
    title: "Anthropic publishes a model safety evaluation",
    summary: "A separate model-safety report was published.",
    url: "https://newsletter.example/anthropic-safety",
    sourceLinks: [],
  });
  const result = buildDailyIntelligenceDigest(
    { industry: 5, mentions: 0, newsletters: 5 },
    feeds([industry()], [related, unrelated]),
    now,
  );
  assert.equal(result.items.length, 2);
  assert.equal(result.duplicatesCollapsed, 1);
});

test("daily intelligence merges differently worded public headlines about one event", () => {
  const result = buildDailyIntelligenceDigest(
    { industry: 5, mentions: 0, newsletters: 0 },
    feeds([
      industry({
        id: "hardware-one",
        title: "Anthropic's new hardware standard lets AI agents control the physical world",
        url: "https://source-one.example/anthropic-hardware",
        source: "Source One",
      }),
      industry({
        id: "hardware-two",
        title: "Anthropic unveils new framework allowing AI agents to operate physical devices",
        url: "https://source-two.example/anthropic-devices",
        source: "Source Two",
      }),
      industry({
        id: "science-support",
        title: "Anthropic expands support for scientists",
        url: "https://anthropic.com/news/expanding-support-for-scientists",
        source: "Anthropic",
      }),
    ], []),
    now,
  );
  assert.equal(result.items.length, 2);
  assert.equal(result.duplicatesCollapsed, 1);
  const merged = result.items.find((item) => item.coverageCount === 2);
  assert.ok(merged);
  assert.deepEqual(merged.sources, ["Source One", "Source Two"]);
});

test("daily intelligence ignores publisher suffixes while clustering public reports", () => {
  const result = buildDailyIntelligenceDigest(
    { industry: 5, mentions: 0, newsletters: 0 },
    feeds([
      industry({
        id: "hack-one",
        title: "OpenAI report says its network was hacked by its own rogue AI agents - ET Enterprise AI",
        url: "https://enterprise.example/openai-hack",
        source: "ET Enterprise AI",
      }),
      industry({
        id: "hack-two",
        title: "OpenAI Official Report Reveals Swarm of 700 AI Agents Hacked Hugging Face - Android Headlines",
        url: "https://android.example/openai-hack",
        source: "Android Headlines",
      }),
    ], []),
    now,
  );
  assert.equal(result.items.length, 1);
  assert.equal(result.duplicatesCollapsed, 1);
  assert.equal(result.items[0].coverageCount, 2);
});

test("daily intelligence excludes archived, expired, and future evidence", () => {
  const result = buildDailyIntelligenceDigest(
    { industry: 5, mentions: 0, newsletters: 5 },
    feeds([
      industry({ id: "archived", workflow: { archiveReason: "user", restoreEligible: true } }),
      industry({ id: "expired", publishedAt: "2026-08-20T12:00:00Z" }),
      industry({ id: "future", publishedAt: "2026-09-20T12:00:00Z" }),
    ], [newsletter({ workflow: { archiveReason: "user", restoreEligible: true } })]),
    now,
  );
  assert.equal(result.items.length, 0);
  assert.equal(result.duplicatesCollapsed, 0);
});

test("corroborated coverage receives a small deterministic ranking boost", () => {
  const corroboratedIndustry = industry({ importanceScore: 70 });
  const corroboratedNewsletter = newsletter({ importanceScore: 70 });
  const solo = industry({
    id: "solo",
    title: "A distinct high-priority AI policy update",
    summary: "A distinct policy update with no newsletter corroboration.",
    url: "https://publisher.example/policy",
    importanceScore: 74,
  });
  const result = buildDailyIntelligenceDigest(
    { industry: 5, mentions: 0, newsletters: 5 },
    feeds([solo, corroboratedIndustry], [corroboratedNewsletter]),
    now,
  );
  assert.match(result.items[0].title, /OpenAI/i);
  assert.equal(result.items[0].importanceScore, 76);
});
