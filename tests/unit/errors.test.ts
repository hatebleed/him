import { describe, expect, it } from "vitest";

import { AppError, ERROR_CODES, toApiError } from "@/lib/errors";
import { QueryValidationError } from "@/lib/validation/common";

describe("error architecture", () => {
  it("maps application errors to a stable envelope", () => {
    const { body, status } = toApiError(AppError.badRequest("Invalid input", { title: "Required" }), "req-1");
    expect(status).toBe(400);
    expect(body.error.code).toBe(ERROR_CODES.VALIDATION);
    expect(body.error.requestId).toBe("req-1");
    expect(body.error.details).toEqual({ title: "Required" });
  });

  it("hides unexpected errors behind a generic message", () => {
    const { body, status } = toApiError(new Error("connection string leaked: postgres://user:pass@host"), "req-2");
    expect(status).toBe(500);
    expect(body.error.code).toBe(ERROR_CODES.INTERNAL);
    expect(body.error.message).not.toContain("postgres://");
  });

  it("honours structured errors raised outside the error module", () => {
    const { body, status } = toApiError(new QueryValidationError({ page: ["Invalid"] }), "req-3");
    expect(status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
