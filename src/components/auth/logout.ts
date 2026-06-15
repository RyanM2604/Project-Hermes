interface LogoutDependencies {
  push(path: string): void;
  refresh(): void;
  signOut(): Promise<{ error: unknown | null }>;
}

export type LogoutResult =
  | { ok: true }
  | { error: "Unable to log out. Please try again."; ok: false };

export async function logout({
  push,
  refresh,
  signOut,
}: LogoutDependencies): Promise<LogoutResult> {
  const { error } = await signOut();

  if (error) {
    return {
      error: "Unable to log out. Please try again.",
      ok: false,
    };
  }

  push("/");
  refresh();

  return { ok: true };
}
