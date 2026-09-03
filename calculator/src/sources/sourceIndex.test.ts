import { describe, expect, it } from "vitest";

import { SOURCE_INDEX, sourceLinkLabel } from "./sourceIndex";

describe("source links", () => {
  it("routes rule passages to the self-hosted rule page with a stable paragraph anchor", () => {
    const rulePassages = Object.values(SOURCE_INDEX).filter((reference) =>
      reference.url.startsWith("/rules/duration-of-status/")
    );

    expect(rulePassages.length).toBeGreaterThan(0);
    rulePassages.forEach((reference) => {
      expect(reference.url).toMatch(/^\/rules\/duration-of-status\/\?src=[A-Z0-9-]+#p-\d+$/);
      expect(reference.url).not.toContain(":~:text=");
      expect(reference.officialUrl).toMatch(/federalregister\.gov.*#p-\d+$/);
      expect(reference.quote, `${reference.id} should carry a verbatim quote`).toBeTruthy();
      expect(sourceLinkLabel(reference)).toBe("Open the highlighted rule passage");
    });
  });

  it("does not promise a highlight for general or non-rule sources", () => {
    expect(sourceLinkLabel(SOURCE_INDEX["FR-2026-FINAL-RULE"])).toBe("Open the official rule");
    expect(sourceLinkLabel(SOURCE_INDEX["USCIS-OPT-STEM"])).toBe("Open the cited source");
  });
});
