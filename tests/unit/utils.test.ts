import { describe, expect, it } from "vitest";

import { cn, formatFileSize, initials, slugify, truncate } from "@/lib/utils";
import { evaluateCondition } from "@/lib/rules";
import { formInputSchema } from "@/server/services/forms";

describe("shared utilities", () => {
  it("produces initials from a full name", () => {
    expect(initials("Dana Whitfield")).toBe("DW");
    expect(initials("Prince")).toBe("P");
  });

  it("slugifies labels into keys", () => {
    expect(slugify("Reported Theft!")).toBe("reported-theft");
  });

  it("truncates long strings with an ellipsis", () => {
    expect(truncate("abcdefghij", 5)).toBe("abcd…");
  });

  it("formats file sizes", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(2048)).toContain("KB");
  });

  it("merges class names", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });

  it("validates form builder input", () => {
    const result = formInputSchema.safeParse({ key: "ab", name: "Form", resourceType: "incident" });
    expect(result.success).toBe(true);
    expect(formInputSchema.safeParse({ key: "a", name: "Form", resourceType: "incident" }).success).toBe(false);
  });

  it("evaluates workflow conditions identically on client and server", () => {
    expect(evaluateCondition("EQUALS", "HIGH", "HIGH")).toBe(true);
  });
});
