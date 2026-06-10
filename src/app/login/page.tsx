import { AuthPanel } from "@/components/auth/AuthPanel";
import { getSafeRedirectPath } from "@/lib/auth/validation";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";
  const next = getSafeRedirectPath(
    typeof params.next === "string" ? params.next : null,
  );

  return <AuthPanel initialEmail={email} mode="login" next={next} />;
}
