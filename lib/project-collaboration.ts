import { metricDay, validMetricDate } from "./gtm-metrics";
import type { ProjectItem } from "./types";

const text = (value: unknown, limit = 2000) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
function timestamp(value: unknown) {
  const candidate = text(value, 50);
  if (!validMetricDate(candidate.slice(0, 10)) || !Number.isFinite(Date.parse(candidate)) || Date.parse(candidate) > Date.now()) return "";
  return new Date(candidate).toISOString();
}
export function projectResourceUrl(value: unknown) {
  const candidate = text(value, 2000);
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || url.username || url.password) return "";
    // Reject known credential parameters in queries and OAuth-style fragments.
    const sensitive = /^(access_token|id_token|refresh_token|token|api[_-]?key|password|signature|sig|x-amz-.+|x-goog-.+)$/i;
    const fragment = new URLSearchParams(url.hash.slice(1));
    if ([...url.searchParams.keys(), ...fragment.keys()].some((key) => sensitive.test(key))) return "";
    return url.href;
  } catch { return ""; }
}
function bounded<T>(value: unknown, clean: (item: Record<string, unknown>) => T | undefined): T[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, 200).flatMap((raw) => {
    const item = record(raw); if (!item) return [];
    const id = text(item.id, 100); if (!id || seen.has(id)) return [];
    seen.add(id); const cleaned = clean({ ...item, id }); return cleaned ? [cleaned] : [];
  });
}
export function cleanProjectCollaboration(item: Record<string, unknown>): Pick<ProjectItem, "progressUpdates" | "resources"> {
  return {
    progressUpdates: bounded(item.progressUpdates, (value) => {
      const summary = text(value.summary), author = text(value.author, 120), occurredOn = text(value.occurredOn, 10);
      if (!summary || !author || !validMetricDate(occurredOn) || occurredOn > metricDay()) return undefined;
      return { id: text(value.id, 100), summary, author, occurredOn, recordedAt: timestamp(value.recordedAt), nextStep: text(value.nextStep) };
    }),
    resources: bounded(item.resources, (value) => {
      const title = text(value.title, 200), url = projectResourceUrl(value.url);
      if (!title || !url) return undefined;
      return { id: text(value.id, 100), title, url, addedAt: timestamp(value.addedAt), addedBy: text(value.addedBy, 120) };
    }),
  };
}
