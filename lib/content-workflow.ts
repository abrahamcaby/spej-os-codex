import type { ContentStage } from "./types";
import { metricDay, validMetricDate } from "./gtm-metrics";

export function contentPublicationIssue(stage: ContentStage, date: string, today = metricDay()) {
  if (stage === "Published" && (!validMetricDate(date) || date > today)) return "Add the actual publication date (today or earlier) before marking this piece Published.";
  if (stage === "Scheduled" && !validMetricDate(date)) return "Add the planned publication date before marking this piece Scheduled.";
  return "";
}
