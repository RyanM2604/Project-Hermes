import { describe, expect, it } from "vitest";

import { toAbsoluteHttpUrl } from "../sources/utils";

describe("toAbsoluteHttpUrl", () => {
  it("resolves relative HTTP URLs", () => {
    expect(toAbsoluteHttpUrl("/event/test", "https://wusa.ca/events/")).toBe(
      "https://wusa.ca/event/test",
    );
  });

  it("does not turn blank or unsafe values into valid source URLs", () => {
    expect(toAbsoluteHttpUrl(" \n\t", "https://wusa.ca/events/")).toBeNull();
    expect(
      toAbsoluteHttpUrl("javascript:alert(1)", "https://wusa.ca/events/"),
    ).toBeNull();
  });
});
