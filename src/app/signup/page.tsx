import { AuthPanel } from "@/components/auth/AuthPanel";
import { getSafeRedirectPath } from "@/lib/auth/validation";

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";
  const next = getSafeRedirectPath(
    typeof params.next === "string" ? params.next : null,
  );

  return <AuthPanel initialEmail={email} mode="signup" next={next} />;
}
