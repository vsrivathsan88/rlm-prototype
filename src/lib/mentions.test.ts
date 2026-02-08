import { describe, expect, it } from "vitest";
import {
  buildMentionKeys,
  normalizeMentionToken,
  parseMentionTokens,
  stripMentionTokens,
} from "./mentions";

describe("mentions utils", () => {
  it("normalizes mention tokens", () => {
    expect(normalizeMentionToken(" Clarity & Structure Reviewer ")).toBe(
      "clarity_structure_reviewer"
    );
  });

  it("parses token and display-name mentions", () => {
    const input = "Run evidence pass with @fact_integrity_reviewer and @{Clarity & Structure Reviewer}";
    expect(parseMentionTokens(input)).toEqual([
      "fact_integrity_reviewer",
      "Clarity & Structure Reviewer",
    ]);
  });

  it("strips mentions from prompts", () => {
    const input = "Draft this with @mission_planner then @{Fact Integrity Reviewer}";
    expect(stripMentionTokens(input)).toBe("Draft this with then");
  });

  it("builds stable id + name keys", () => {
    expect(buildMentionKeys("fact_integrity_reviewer", "Fact Integrity Reviewer")).toEqual([
      "fact_integrity_reviewer",
    ]);
  });
});
