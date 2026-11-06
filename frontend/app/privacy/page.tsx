import Link from "next/link";
import { BRAND } from "../../lib/brand";
import { DottedBackground, Logo } from "../../components/brand/BrandUI";

export default function PrivacyPage() {
  return <main className="marketing-theme relative isolate min-h-screen overflow-hidden bg-[var(--bg)] px-6 py-10 text-ink sm:px-10">
    <DottedBackground />
    <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between border-b border-[var(--border)] pb-5">
      <Link href="/"><Logo /></Link><Link href="/" className="text-sm font-semibold text-[var(--accent-strong)] hover:underline">Home</Link>
    </header>
    <article className="relative z-10 mx-auto max-w-3xl py-16 sm:py-24">
      <p className="mb-4 text-sm font-semibold text-[var(--accent-strong)]">Privacy</p>
      <h1 className="font-display text-4xl sm:text-5xl">{BRAND.name} Privacy</h1>
      <p className="mt-8 text-base leading-8 text-muted">{BRAND.name} stores your Google name, email address and profile photo to provide your account. Videos you upload and the captions generated from them are stored so you can edit and export your projects. Video files are normally retained for up to 7 days (the retention setting may change); project captions may remain available after media is removed.</p>
      <p className="mt-5 text-base leading-8 text-muted">To request deletion of your account, videos or captions, contact <a className="font-semibold text-[var(--accent-strong)] underline underline-offset-4" href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a> with the email address on your account. This draft should be reviewed and completed before public launch.</p>
      <p className="mt-8 text-sm font-medium text-[var(--accent-strong)]">Draft, review before launch</p>
    </article>
    <footer className="relative z-10 mx-auto max-w-5xl border-t border-[var(--border)] py-5 text-sm text-muted">© 2026 {BRAND.name}</footer>
  </main>;
}
