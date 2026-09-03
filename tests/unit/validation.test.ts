import { describe, expect, it } from "vitest";

import { personUpsertSchema, vehicleUpsertSchema } from "@/lib/validation/people";
import { incidentUpsertSchema } from "@/lib/validation/operations";
import { reportUpsertSchema, taskUpsertSchema } from "@/lib/validation/records";

describe("record validation schemas", () => {
  it("requires a person to have a first and last name", () => {
    const result = personUpsertSchema.safeParse({ firstName: "", lastName: "" });
    expect(result.success).toBe(false);
  });

  it("applies defaults for optional person sub-collections", () => {
    const parsed = personUpsertSchema.parse({ firstName: "Ada", lastName: "Byron" });
    expect(parsed.status).toBe("ACTIVE");
    expect(parsed.identifiers).toEqual([]);
  });

  it("rejects a vehicle without a registration", () => {
    expect(vehicleUpsertSchema.safeParse({ registration: "" }).success).toBe(false);
  });

  it("coerces vehicle year to a number", () => {
    const parsed = vehicleUpsertSchema.parse({ registration: "NG12 ABC", year: "2019" });
    expect(parsed.year).toBe(2019);
  });

  it("requires an incident title of at least three characters", () => {
    expect(incidentUpsertSchema.safeParse({ title: "ab" }).success).toBe(false);
    const parsed = incidentUpsertSchema.parse({ title: "Collision on Harbour Road" });
    expect(parsed.status).toBe("NEW");
    expect(parsed.priority).toBe("MEDIUM");
  });

  it("defaults reports to draft and tasks to open", () => {
    expect(reportUpsertSchema.parse({ title: "Initial report" }).status).toBe("DRAFT");
    expect(taskUpsertSchema.parse({ title: "Follow up" }).status).toBe("OPEN");
  });

  it("accepts custom field payloads", () => {
    const parsed = incidentUpsertSchema.parse({ title: "Incident", customFields: { approval_ref: "SUP-1" } });
    expect(parsed.customFields?.approval_ref).toBe("SUP-1");
  });
});
