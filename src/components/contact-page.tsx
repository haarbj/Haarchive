import Link from "next/link";

import { ContactForm } from "@/components/contact-form";
import { socialLinks } from "@/lib/social-links";

const linkClass =
  "font-semibold text-zinc-900 underline decoration-black/20 underline-offset-2 transition hover:decoration-black/60 dark:text-white dark:decoration-white/30 dark:hover:decoration-white/70";

// The Contact section's ToolComponent (see sectionTools in [slug]/page.tsx)
// -- a form and reader-facing links aren't expressible as ContentBlock[], so
// this replaces the generic ArticleLayout renderer entirely for this one
// section, the same way the calculators do.
export function ContactPage() {
  return (
    <>
      <div className="max-w-article-prose space-y-6 text-lg leading-8 text-zinc-600 dark:text-zinc-300">
        <p>
          I&rsquo;ve coached Run22 members one-on-one since I first built that community during COVID
          lockdowns, and this archive is where I write down everything I&rsquo;d otherwise have to re-derive
          every time. If you&rsquo;re looking for a second opinion on a plan you&rsquo;re already running, or
          just want to talk through where your training has stalled, I&rsquo;d like to hear from you.
        </p>

        <h2 className="border-t border-black/5 pt-8 text-2xl font-semibold tracking-tight text-zinc-900 first:border-t-0 first:pt-0 dark:border-white/10 dark:text-white">
          What to Reach Out About
        </h2>
        <ul className="space-y-3">
          <li>
            • Coaching inquiries — one-on-one coaching, a race buildup, or a review of a plan you&rsquo;re
            already running.
          </li>
          <li>
            • Contributing —{" "}
            <Link href="/contribute-apply" className={linkClass}>
              apply to write articles, answer reader questions, or help review submissions
            </Link>
            . Every contributor is approved by hand, so tell me a bit about yourself first.
          </li>
          <li>
            • Collaborations — guest writing, research discussions, or joint projects with other coaches
            and physiologists.
          </li>
          <li>• Speaking — talks or workshops on training philosophy, aerobic development, or coaching methodology.</li>
        </ul>
      </div>

      <div className="mt-10 max-w-article-prose">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">Get in Touch</h2>
        <p className="mt-4 text-lg leading-8 text-zinc-600 dark:text-zinc-300">
          The fastest way to reach me is email, at{" "}
          <a href="mailto:hello@brodyhaar.com" className={linkClass}>
            hello@brodyhaar.com
          </a>
          {socialLinks.length > 0 ? ", or find me on:" : "."}
        </p>

        {socialLinks.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            {socialLinks.map((social) => (
              <a key={social.href} href={social.href} target="_blank" rel="noreferrer" className={linkClass}>
                {social.label}
              </a>
            ))}
          </div>
        ) : null}

        <div className="mt-8 max-w-lg">
          <ContactForm />
        </div>
      </div>
    </>
  );
}
