import { describe, expect, it } from "vitest";
import { premiumReviewPack, validatePremiumReviewPack } from "./premium-content.js";

describe("protected premium review content", () => {
  it("contains four-choice questions with valid keys and dated sources", () => {
    expect(validatePremiumReviewPack(premiumReviewPack)).toBe(true);
  });
});
