import type { z } from "zod";

/**
 * Shared conditional-logic engine.
 *
 * The same rule format is used by form builders, custom fields and workflow
 * conditions, and is evaluated with the same code on the client (visibility)
 * and the server (enforcement).
 */
export type Condition = { field: string; operator: string; value: string | null };

export const OPERATORS = [
  { value: "EQUALS", label: "equals" },
  { value: "NOT_EQUALS", label: "does not equal" },
  { value: "CONTAINS", label: "contains" },
  { value: "GREATER_THAN", label: "is greater than" },
  { value: "LESS_THAN", label: "is less than" },
  { value: "EXISTS", label: "is filled in" },
  { value: "IN", label: "is one of" },
] as const;

function resolvePath(values: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, values);
}

export function evaluateCondition(operator: string, left: unknown, right: string | null | undefined): boolean {
  const target = right ?? "";
  switch (operator) {
    case "EQUALS":
      if (typeof left === "boolean") return left === (target === "true" || target === "1");
      return String(left ?? "") === target;
    case "NOT_EQUALS":
      if (typeof left === "boolean") return left !== (target === "true" || target === "1");
      return String(left ?? "") !== target;
    case "CONTAINS":
      return String(left ?? "").toLowerCase().includes(target.toLowerCase());
    case "GREATER_THAN":
      return Number(left) > Number(target);
    case "LESS_THAN":
      return Number(left) < Number(target);
    case "EXISTS":
      return left !== undefined && left !== null && left !== "";
    case "IN":
      return target
        .split(",")
        .map((value) => value.trim())
        .includes(String(left ?? ""));
    default:
      return true;
  }
}

/** Conditions are ANDed: every rule must pass for the field to apply. */
export function conditionsMet(conditions: Condition[] | null | undefined, values: Record<string, unknown>): boolean {
  if (!conditions?.length) return true;
  return conditions.every((condition) => evaluateCondition(condition.operator, resolvePath(values, condition.field), condition.value));
}

export type { z };
