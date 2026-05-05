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
    <div>
      <h1>Email Password</h1>
      <p>{email}</p>
    </div>
  );
}