import { describe, expect, it, vi } from "vitest";

import { logout } from "../logout";

describe("logout", () => {
  it("signs out then redirects and refreshes", async () => {
    const signOut = vi.fn(async () => ({ error: null }));
    const push = vi.fn();
    const refresh = vi.fn();

    await expect(logout({ signOut, push, refresh })).resolves.toEqual({
      ok: true,
    });

    expect(signOut).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith("/");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("returns a constrained error without navigating when sign out fails", async () => {
    const signOut = vi.fn(async () => ({
      error: new Error("private provider details"),
    }));
    const push = vi.fn();
    const refresh = vi.fn();

    await expect(logout({ signOut, push, refresh })).resolves.toEqual({
      error: "Unable to log out. Please try again.",
      ok: false,
    });

    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
