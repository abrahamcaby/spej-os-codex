import type { CampaignItem } from "./types";

const statuses = ["Planning", "Active", "Paused", "Complete"] as const;
const channels = ["Multi-channel", "LinkedIn", "Email", "YouTube", "Website", "Event", "Partner", "Other"] as const;

function text(value: unknown, fallback = "", limit = 2_000) {
  return (typeof value === "string" ? value : fallback).trim().slice(0, limit);
}

function date(value: unknown) {
  const clean = text(value, "", 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : "";
}

function timestamp(value: unknown) {
  const clean = text(value, "", 40);
  return Number.isFinite(Date.parse(clean)) ? clean : new Date().toISOString();
}

function choice<T extends string>(value: unknown, allowed: readonly T[], fallback: T) {
  return allowed.includes(value as T) ? value as T : fallback;
}

export function cleanCampaigns(value: unknown): CampaignItem[] {
  if (!Array.isArray(value)) throw new Error("Campaigns must be a list.");
  if (value.length > 10_000) throw new Error("The campaign list is too large.");
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const name = text(candidate.name, "", 300);
    if (!name) return [];
    const archivedAt = text(candidate.archivedAt, "", 40);
    return [{
      id: text(candidate.id, crypto.randomUUID(), 100),
      name,
      status: choice(candidate.status, statuses, "Planning"),
      objective: text(candidate.objective),
      audience: text(candidate.audience, "", 500),
      owner: text(candidate.owner, "Unassigned", 120),
      ownerProfileId: text(candidate.ownerProfileId, "", 200) || undefined,
      primaryChannel: choice(candidate.primaryChannel, channels, "Multi-channel"),
      startDate: date(candidate.startDate),
      endDate: date(candidate.endDate),
      successMeasure: text(candidate.successMeasure, "", 500),
      notes: text(candidate.notes),
      createdAt: timestamp(candidate.createdAt),
      archivedAt: Number.isFinite(Date.parse(archivedAt)) ? archivedAt : undefined,
    }];
  });
}

export const CAMPAIGN_STATUSES = statuses;
export const CAMPAIGN_CHANNELS = channels;
