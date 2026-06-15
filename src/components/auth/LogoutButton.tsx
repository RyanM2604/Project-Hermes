"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { logout } from "./logout";

interface LogoutButtonProps {
  className?: string;
  onLoggedOut?: () => void;
}

export function LogoutButton({ className, onLoggedOut }: LogoutButtonProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  async function handleLogout() {
    setErrorMessage(undefined);
    setIsLoggingOut(true);

    const supabase = createSupabaseBrowserClient();
    const result = await logout({
      signOut: () => supabase.auth.signOut(),
      push: router.push,
      refresh: router.refresh,
    });

    if (!result.ok) {
      setErrorMessage(result.error);
      setIsLoggingOut(false);
      return;
    }

    onLoggedOut?.();
  }

  return (
    <div>
      <button
        type="button"
        disabled={isLoggingOut}
        onClick={handleLogout}
        className={className}
      >
        <LogOut size={17} />
        {isLoggingOut ? "Logging out..." : "Log out"}
      </button>
      {errorMessage && (
        <p role="alert" className="mt-2 px-2 text-xs font-medium text-red-300">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
