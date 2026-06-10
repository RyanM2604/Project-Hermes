"use client";

import { useSearchParams } from "next/navigation";
import { User } from "@supabase/supabase-js";

type Props = {
  user?: User | null;
};

export default function EmailPassword({ user }: Props) {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  return (
    <div className="min-h-screen bg-[#050505] px-5 pb-12 pt-32 text-white sm:px-8 sm:pt-36">
      <h1>Email Password</h1>
      <p>{user?.email ?? email}</p>
    </div>
  );
}
