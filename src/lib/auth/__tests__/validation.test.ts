import { describe, expect, it } from "vitest";

import {
  getSafeRedirectPath,
  isUWaterlooEmail,
  isValidPassword,
} from "../validation";

describe("auth validation", () => {
  it("accepts Waterloo email addresses", () => {
    expect(isUWaterlooEmail("student@uwaterloo.ca")).toBe(true);
    expect(isUWaterlooEmail(" Student@UWATERLOO.CA ")).toBe(true);
  });

  it("rejects non-Waterloo and malformed email addresses", () => {
    expect(isUWaterlooEmail("student@gmail.com")).toBe(false);
    expect(isUWaterlooEmail("@uwaterloo.ca")).toBe(false);
    expect(isUWaterlooEmail("student@uwaterloo.ca.example.com")).toBe(false);
  });

  it("requires passwords to be at least eight characters", () => {
    expect(isValidPassword("12345678")).toBe(true);
    expect(isValidPassword("short")).toBe(false);
  });

  it("allows local redirect paths", () => {
    expect(getSafeRedirectPath("/events/event-123")).toBe("/events/event-123");
  });

  it("rejects external and missing redirect paths", () => {
    expect(getSafeRedirectPath("https://example.com")).toBe("/events");
    expect(getSafeRedirectPath("//example.com")).toBe("/events");
    expect(getSafeRedirectPath("/\\example.com")).toBe("/events");
    expect(getSafeRedirectPath(null)).toBe("/events");
  });
});
