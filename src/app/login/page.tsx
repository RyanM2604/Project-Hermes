import { LoginButton } from "@/components/auth/LoginButton";
import { getSafeRedirectPath } from "@/lib/auth/validation";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";
  const next = getSafeRedirectPath(
    typeof params.next === "string" ? params.next : null,
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050505] px-5 pb-12 pt-32 text-white sm:px-8 sm:pt-36">
      <section className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_30px_90px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:p-9">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">
          Student access
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          Login to Hermes
        </h1>
        <p className="mt-4 leading-7 text-zinc-400">
          Login with your @uwaterloo.ca email to save events and RSVP.
        </p>

        <div className="mt-8">
          <LoginButton initialEmail={email} next={next} />
        </div>

        <p className="mt-6 text-center text-xs leading-5 text-zinc-600">
          No password required. Your secure login link expires automatically.
        </p>
      </section>
    </main>
  );
}
