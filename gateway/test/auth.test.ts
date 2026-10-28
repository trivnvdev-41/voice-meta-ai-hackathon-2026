import { describe, expect, it } from "vitest";
import {
  clearSessionCookieHeader,
  hashPassword,
  sessionCookieHeader,
  sessionFromHeader,
  signSession,
  verifyPassword,
  verifySession,
} from "../src/auth.js";

describe("password hashing", () => {
  it("verifies correct password", () => {
    const stored = hashPassword("rahasia123");
    expect(verifyPassword("rahasia123", stored)).toBe(true);
  });

  it("rejects wrong password", () => {
    const stored = hashPassword("rahasia123");
    expect(verifyPassword("salah", stored)).toBe(false);
  });

  it("rejects malformed stored hash", () => {
    expect(verifyPassword("x", "no-colon")).toBe(false);
  });

  it("uses random salt", () => {
    expect(hashPassword("sama")).not.toBe(hashPassword("sama"));
  });
});

describe("session signing", () => {
  const secret = "s3cret";

  it("round-trips user id", () => {
    const cookie = signSession("user-1", secret);
    expect(verifySession(cookie, secret)).toBe("user-1");
  });

  it("rejects tampered user id", () => {
    const cookie = signSession("user-1", secret).replace("user-1", "user-2");
    expect(verifySession(cookie, secret)).toBeNull();
  });

  it("rejects wrong secret", () => {
    const cookie = signSession("user-1", secret);
    expect(verifySession(cookie, "lain")).toBeNull();
  });

  it("rejects missing value", () => {
    expect(verifySession(undefined, secret)).toBeNull();
  });
});

describe("cookie helpers", () => {
  it("round-trips through header", () => {
    const header = sessionCookieHeader(signSession("u", "s")) + "; Other=x";
    expect(sessionFromHeader(`Other=x; ${header.split(";")[0]}`)).toContain("u.");
  });

  it("extracts session from cookie header", () => {
    expect(sessionFromHeader("a=1; grv_session=abc.def; b=2")).toBe("abc.def");
  });

  it("clears session", () => {
    expect(clearSessionCookieHeader()).toContain("Max-Age=0");
  });
});
