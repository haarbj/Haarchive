import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How The Haarchive collects, uses, and protects your information.",
};

const backLinkClass =
  "mb-6 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-zinc-500 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white";
const headingClass =
  "scroll-mt-24 pt-6 text-2xl font-semibold tracking-tight text-zinc-900 first:pt-0 dark:text-white";
const proseClass = "mt-10 max-w-[66ch] space-y-6 text-lg leading-8 text-zinc-600 dark:text-zinc-300";

export default function PrivacyPolicyPage() {
  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-16 animate-fade-in">
      <Link href="/" className={backLinkClass}>
        <span aria-hidden="true">←</span> Back to home
      </Link>
      <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
        Privacy Policy
      </h1>
      <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        Last updated July 8, 2026. This page explains what The Haarchive
        collects, why, and how it&rsquo;s protected. The Haarchive is
        operated by Brody Haar as an individual project, not a company —
        this is written to be genuinely clear and accurate, not a substitute
        for formal legal advice.
      </p>

      <div className={proseClass}>
        <h2 className={headingClass}>Using the calculators as a guest</h2>
        <p>
          The Pace &amp; Heart Rate Calculator, the Heat Tracker, and any
          other tool that doesn&rsquo;t require an account run entirely in
          your browser. Nothing you type into them is sent to a server.
          Anything you see saved (like a remembered finish time) is stored
          only in your browser&rsquo;s local storage, on your own device.
          Clearing your browser data, or using a different device or
          browser, removes it completely — we never have a copy.
        </p>

        <h2 className={headingClass}>Information we collect with an account</h2>
        <p>If you create an account, we collect:</p>
        <ul className="space-y-3">
          <li>
            • <strong>Account information:</strong> your email address and
            password, or — if you sign in with Google — the name, email
            address, and profile photo your Google account shares with us.
            We never see or store your Google password.
          </li>
          <li>
            • <strong>Training information you provide:</strong> your
            display name, goals, race results, injury history, weekly
            check-ins, workout logs, and any calculator results you choose
            to save.
          </li>
          <li>
            • <strong>Connected third-party accounts:</strong> if you
            connect Strava, we store an encrypted access token that lets us
            read data from your Strava account on your behalf. We never see
            or store your Strava password.
          </li>
        </ul>

        <h2 className={headingClass}>How we use it</h2>
        <p>
          We use this information to operate the account features you use —
          your dashboard, your saved goals and results, your saved
          calculations — and to personalize the training tools on the site
          for you. We don&rsquo;t sell your information, and we don&rsquo;t
          use it for advertising.
        </p>

        <h2 className={headingClass}>Third-party services we use</h2>
        <ul className="space-y-3">
          <li>
            • <strong>Supabase</strong> hosts our database and handles
            authentication — your account data lives on Supabase&rsquo;s
            infrastructure.
          </li>
          <li>
            • <strong>Vercel</strong> hosts the website itself and may log
            standard technical request data, as any web host does.
          </li>
          <li>
            • <strong>Google</strong> processes authentication if you choose
            to sign in with Google, under Google&rsquo;s own privacy policy.
          </li>
          <li>
            • <strong>Strava</strong> processes authorization if you choose
            to connect your account, under Strava&rsquo;s own privacy
            policy.
          </li>
        </ul>

        <h2 className={headingClass}>How your data is protected</h2>
        <ul className="space-y-3">
          <li>
            • Database access is restricted with row-level security, so your
            data is only ever readable by you — enforced at the database
            itself, not just in application code.
          </li>
          <li>
            • Connected third-party tokens (like a linked Strava account)
            are encrypted before being stored.
          </li>
          <li>• All traffic to the site is encrypted (HTTPS).</li>
          <li>
            • Passwords are handled entirely by Supabase Auth and are never
            visible to us in plain text.
          </li>
        </ul>

        <h2 className={headingClass}>Your choices</h2>
        <p>
          You can disconnect a connected third-party account (like Strava)
          at any time from your dashboard. To request a copy of your data,
          or to delete your account and its associated data, email{" "}
          <a
            href="mailto:privacy@brodyhaar.com"
            className="font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70"
          >
            privacy@brodyhaar.com
          </a>
          . These requests are currently handled manually — a self-serve
          export and deletion option is planned for the future.
        </p>

        <h2 className={headingClass}>Children&rsquo;s privacy</h2>
        <p>
          The Haarchive&rsquo;s educational content and guest-mode
          calculators are meant for a general audience. Creating an account
          involves providing personal information, though, so account
          creation is not directed to children under 13, and we do not
          knowingly collect personal information from children under 13. If
          you believe a child under 13 has created an account, please
          contact us and we&rsquo;ll delete it.
        </p>

        <h2 className={headingClass}>Changes to this policy</h2>
        <p>
          We may update this policy as the site&rsquo;s features change.
          We&rsquo;ll update the date at the top whenever we do.
        </p>

        <h2 className={headingClass}>Contact</h2>
        <p>
          Questions about this policy or your data can go to{" "}
          <a
            href="mailto:privacy@brodyhaar.com"
            className="font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70"
          >
            privacy@brodyhaar.com
          </a>
          .
        </p>
      </div>
    </section>
  );
}
