import { describe, expect, it } from "vitest";
import { instagramAccounts } from "../sources/instagram-accounts";

describe("instagramAccounts", () => {
  it("includes the supplied campus and regional accounts without dropping Cheese Club", () => {
    expect(instagramAccounts.map((account) => account.instagramHandle)).toEqual(expect.arrayContaining(["yourwusa", "uwcsclub", "uwcheeseclub", "curatedkw", "locuslaurier"]));
  });
  it("uses unique handles and matching public Instagram profile URLs", () => {
    const handles = instagramAccounts.map((account) => account.instagramHandle.toLowerCase());
    expect(new Set(handles).size).toBe(handles.length);
    for (const account of instagramAccounts) {
      expect(account.clubName.trim()).not.toBe("");
      expect(account.instagramHandle).toMatch(/^[a-zA-Z0-9_.]{1,30}$/);
      expect(new URL(account.profileUrl).origin).toBe("https://www.instagram.com");
      expect(new URL(account.profileUrl).pathname).toBe(`/${account.instagramHandle}/`);
      expect(typeof account.active).toBe("boolean");
      if (account.priority !== undefined) expect(account.priority).toBeGreaterThanOrEqual(0);
    }
  });
});
