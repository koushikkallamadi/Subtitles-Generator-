"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { backendUrl } from "../../lib/projects";
import { useAuth } from "../../components/AuthProvider";
import { Button, DottedBackground, Logo } from "../../components/brand/BrandUI";
import { BRAND } from "../../lib/brand";

function LoginContent() {
  const params = useSearchParams();
  const { user, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const requestedNext = params.get("next") || "/";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") && !requestedNext.includes("\\") ? requestedNext : "/";
  const errorCode = params.get("error");
  const errorMessages: Record<string, string> = {
    cancelled: "Sign-in was cancelled. You can continue whenever you’re ready.",
    invalid_state: "Your sign-in session expired. Please try again.",
    missing_code: "Google didn’t return a sign-in code. Please try again.",
    oauth_config: "Google rejected the OAuth client. Check the client ID, secret, and callback URL in Google Cloud.",
    oauth_code: "Google couldn’t exchange the sign-in code. Please try again; if it persists, check the OAuth client settings.",
    oauth_unavailable: "We couldn’t reach Google to finish sign-in. Please try again.",
    identity_check: "Google couldn’t verify this account. Make sure the account has a verified email, then try again.",
    oauth_failed: "We couldn’t finish sign-in. Please try again.",
  };
  const errorMessage = errorCode ? errorMessages[errorCode] || "We couldn’t sign you in. Please try again." : "";

  useEffect(() => {
    if (!loading && user) window.location.replace("/");
  }, [loading, user]);

  const beginLogin = () => {
    setSubmitting(true);
    window.location.assign(`${backendUrl}/auth/google/login?${new URLSearchParams({ next })}`);
  };

  return <main className="marketing-theme relative isolate min-h-screen overflow-hidden bg-[var(--bg)] text-ink min-[900px]:grid min-[900px]:grid-cols-2">
    <DottedBackground />
    <section className="relative flex min-h-[360px] flex-col justify-between overflow-hidden bg-[linear-gradient(145deg,#fff_0%,#FDEBDD_100%)] p-7 sm:p-10 min-[900px]:min-h-screen xl:p-16">
      <div className="relative z-10 flex items-center gap-3"><Logo /></div>

      <div className="relative z-10 mx-auto my-8 w-full max-w-[650px] rounded-[28px] border border-[var(--border)] bg-white p-4 shadow-[0_24px_70px_rgba(17,17,17,.12)] sm:p-5">
        <div className="mb-4 flex items-center justify-between text-[11px] text-gray-300"><span className="flex items-center gap-2 font-mono font-bold uppercase tracking-[.18em]"><i className="h-2 w-2 rounded-full bg-[#e27359]" /> Hinglish preview</span><span>Hinglish + native scripts</span></div>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#f4f2f0]">
          <div className="flex h-7 items-center gap-1.5 bg-[#26272b] px-3"><i className="h-1.5 w-1.5 rounded-full bg-[#f16a5b]"/><i className="h-1.5 w-1.5 rounded-full bg-[#d9ae56]"/><i className="h-1.5 w-1.5 rounded-full bg-[#6bb782]"/><div className="ml-4 h-3 w-36 rounded-full bg-white/10"/></div>
          <div className="grid min-h-[230px] grid-cols-[1fr_135px] gap-3 p-3 sm:grid-cols-[1fr_170px]">
            <div className="relative flex min-h-[230px] items-end justify-center overflow-hidden rounded-xl bg-[radial-gradient(ellipse_at_48%_24%,#f4c78e_0%,#ba7351_42%,#252832_100%)] p-4">
              <div className="absolute bottom-12 h-36 w-24 rounded-t-[45%] bg-[#222b3b] shadow-xl"/><div className="absolute bottom-10 h-24 w-24 rounded-full bg-[#bd8467] shadow-md"/>
              <div className="relative z-10 rounded-xl bg-black/80 px-4 py-2 text-center text-sm font-extrabold leading-5 text-white shadow-lg">Reels ke liye<br/><span className="text-[#f3c85d]">perfect captions</span></div>
            </div>
            <div className="space-y-2 rounded-xl bg-white p-3 text-gray-700">
              <div className="text-[9px] font-bold uppercase tracking-widest text-[#d66c54]">Caption cues</div>
              <div className="rounded-md border border-[#e4e4e7] p-2"><div className="mb-1 h-1.5 w-12 rounded bg-gray-300"/><div className="h-2 w-full rounded bg-gray-200"/><div className="mt-1 h-2 w-3/4 rounded bg-gray-200"/></div>
              <div className="rounded-md border border-[#e4e4e7] p-2"><div className="mb-1 h-1.5 w-12 rounded bg-gray-300"/><div className="h-2 w-4/5 rounded bg-gray-200"/></div>
              <div className="mt-3 rounded-md bg-[#dc735c] py-2 text-center text-[9px] font-bold text-white">Style & export</div>
            </div>
          </div>
          <div className="h-9 border-t border-gray-300 bg-[#242630] px-3 py-2"><div className="h-4 rounded bg-[#385168]"/></div>
        </div>
      </div>

      <div className="relative z-10 max-w-xl font-display text-[clamp(2rem,4vw,3.2rem)] text-ink">Audio in.<br/><span className="text-[var(--accent-strong)]">{BRAND.tagline}</span></div>
    </section>

    <section className="relative z-10 flex min-h-screen flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-24">
      <div className="mx-auto w-full max-w-[640px]">
        <p className="mb-5 text-sm font-semibold text-[var(--accent-strong)]">{BRAND.name}</p>
        <h1 className="font-display text-3xl sm:text-[2.5rem]">Sign in to your account.</h1>
        <p className="mt-4 text-lg text-muted">Get started for free.</p>
        {errorMessage && <p role="alert" className="mt-8 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</p>}
        <p className="mt-12 text-lg font-medium text-ink">Sign in to create captions in the words you speak.</p>
        <Button type="button" onClick={beginLogin} disabled={submitting} className="mt-5 w-full py-4 text-lg disabled:cursor-wait disabled:opacity-70">
          <svg aria-hidden="true" viewBox="0 0 48 48" className="h-6 w-6"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3A12 12 0 1 1 32 15.1l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.3-.4-3.5Z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8A12 12 0 0 1 32 15.1l5.7-5.7A20 20 0 0 0 6.3 14.7Z"/><path fill="#4CAF50" d="M24 44a20 20 0 0 0 13.5-5.2l-6.2-5.2A12 12 0 0 1 12.8 28l-6.5 5A20 20 0 0 0 24 44Z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12.1 12.1 0 0 1-4 5.6l6.2 5.2A20 20 0 0 0 44 24c0-1.2-.1-2.3-.4-3.5Z"/></svg>
          {submitting ? "Redirecting to Google…" : "Continue with Google"}
        </Button>
      </div>
      <footer className="mx-auto mt-auto flex w-full max-w-[640px] items-center justify-center gap-3 pt-20 text-sm text-muted sm:justify-end">
        <span>© 2026 {BRAND.name}</span><span>·</span><a className="hover:text-[var(--accent-strong)]" href="/privacy">Privacy</a><span>·</span><a className="hover:text-[var(--accent-strong)]" href="/terms">Terms</a>
      </footer>
    </section>
  </main>;
}

export default function LoginPage() {
  return <Suspense fallback={<div className="marketing-theme grid min-h-screen place-items-center bg-[var(--bg)] text-sm text-muted">Loading…</div>}><LoginContent /></Suspense>;
}
