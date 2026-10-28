import { describe, expect, it } from "vitest";
import { createRateLimiter } from "../src/ratelimit.js";

describe("createRateLimiter", () => {
  it("allows up to the limit, then blocks that key only", () => {
    const allow = createRateLimiter({ limit: 2, windowMs: 60_000 });
    expect(allow("ip-1")).toBe(true);
    expect(allow("ip-1")).toBe(true);
    expect(allow("ip-1")).toBe(false);
    expect(allow("ip-2")).toBe(true);
  });
});
