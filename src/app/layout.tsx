import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import Script from "next/script";
import { SiteNavbar } from "@/components/layout/SiteNavbar";
import { LoginMorphProvider } from "@/components/motion/LoginMorph";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import "./globals.css";
import "./hermes.css";

const dmSans = DM_Sans({
  variable: "--font-hermes-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-hermes-display",
  subsets: ["latin"],
});

const themeInit = `(function(){var dark=window.matchMedia('(prefers-color-scheme: dark)').matches;try{var saved=localStorage.getItem('hermes-theme');if(saved==='dark'||saved==='light')dark=saved==='dark'}catch{}document.documentElement.classList.toggle('dark',dark);document.documentElement.style.colorScheme=dark?'dark':'light'})()`;

export const metadata: Metadata = {
  title: "Hermes",
  description: "One feed for Waterloo events, free food, and club nights. See what's on tonight.",
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${dmSans.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script id="hermes-theme" strategy="beforeInteractive">{themeInit}</Script>
        <LoginMorphProvider>
          <SiteNavbar isAuthenticated={Boolean(user)} />
          {children}
        </LoginMorphProvider>
      </body>
    </html>
  );
}
