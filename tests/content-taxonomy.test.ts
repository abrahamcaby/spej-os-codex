import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTHORITY_CONTENT_CATEGORIES,
  PERSONAL_CONTENT_PILLARS,
  contentCategoriesForStream,
  normalizeContentCategory,
} from "../lib/content-taxonomy";

test("personal LinkedIn and Spej authority content use separate taxonomies", () => {
  assert.deepEqual(contentCategoriesForStream("Personal LinkedIns"), PERSONAL_CONTENT_PILLARS);
  assert.deepEqual(contentCategoriesForStream("Spej Authority-building content"), AUTHORITY_CONTENT_CATEGORIES);
  assert.equal(AUTHORITY_CONTENT_CATEGORIES.includes("Moments That Matter" as never), false);
  assert.equal(AUTHORITY_CONTENT_CATEGORIES.includes("Hero-Making Expertise" as never), false);
});

test("content categories are normalized against the selected content stream", () => {
  assert.equal(normalizeContentCategory("Personal LinkedIns", "Moments That Matter"), "Moments That Matter");
  assert.equal(normalizeContentCategory("Spej Authority-building content", "Workflow Discovery & Redesign"), "Workflow Discovery & Redesign");
  assert.equal(normalizeContentCategory("Spej Authority-building content", "Moments That Matter"), "Unassigned");
  assert.equal(normalizeContentCategory("Personal LinkedIns", "Research Translation & Trend Interpretation"), "Unassigned");
});

test("existing authority ideas recover their calendar category from imported library notes", () => {
  const angle = "Explain the operating implication.\n\nCategory: AI Strategy & Business Alignment\nSuggested use: YouTube essay";
  assert.equal(
    normalizeContentCategory("Spej Authority-building content", "Hero-Making Expertise", angle),
    "AI Strategy & Business Alignment",
  );
});
