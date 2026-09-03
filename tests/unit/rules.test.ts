import { describe, expect, it } from "vitest";

import { conditionsMet, evaluateCondition } from "@/lib/rules";

describe("conditional logic", () => {
  it("evaluates equality against string and boolean values", () => {
    expect(evaluateCondition("EQUALS", "HIGH", "HIGH")).toBe(true);
    expect(evaluateCondition("EQUALS", true, "true")).toBe(true);
    expect(evaluateCondition("EQUALS", false, "true")).toBe(false);
  });

  it("supports contains, numeric, exists and in operators", () => {
    expect(evaluateCondition("CONTAINS", "Northgate Road", "north")).toBe(true);
    expect(evaluateCondition("GREATER_THAN", 10, "5")).toBe(true);
    expect(evaluateCondition("LESS_THAN", 2, "5")).toBe(true);
    expect(evaluateCondition("EXISTS", "", null)).toBe(false);
    expect(evaluateCondition("EXISTS", "value", null)).toBe(true);
    expect(evaluateCondition("IN", "MEDIUM", "LOW,MEDIUM,HIGH")).toBe(true);
  });

  it("requires every condition in a group to pass", () => {
    const conditions = [
      { field: "priority", operator: "EQUALS", value: "HIGH" },
      { field: "status", operator: "NOT_EQUALS", value: "CLOSED" },
    ];
    expect(conditionsMet(conditions, { priority: "HIGH", status: "NEW" })).toBe(true);
    expect(conditionsMet(conditions, { priority: "HIGH", status: "CLOSED" })).toBe(false);
  });

  it("treats missing conditions as satisfied", () => {
    expect(conditionsMet(null, {})).toBe(true);
    expect(conditionsMet([], {})).toBe(true);
  });

  it("resolves nested field paths", () => {
    expect(conditionsMet([{ field: "record.priority", operator: "EQUALS", value: "HIGH" }], { record: { priority: "HIGH" } })).toBe(true);
  });
});
