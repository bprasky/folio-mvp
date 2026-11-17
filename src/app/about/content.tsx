"use client";

import Image from "@/components/FolioImage";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowUpRight } from "lucide-react";
import type { MouseEvent } from "react";
import { projectEntryHref } from "@/lib/onboarding/professional-entry";
import styles from "./about.module.css";

const steps = [
  { title: "Share your work.", description: "Bring your photos, project materials, and existing features." },
  { title: "Talk us through it.", description: "A guided interview builds on what you’ve already shared." },
  { title: "Review. Publish. Share.", description: "Approve your stories and put your Folio to work." },
];

function ProfileIllustration() {
  return (
    <figure className={styles.profileFigure}>
      <div className={styles.profileCard} role="img" aria-label="Sample Studio Vale profile, showing The Courtyard House in Coral Gables, a story about natural materials, and a press feature about light.">
        <div className={styles.profileIdentity}>
          <div>
            <p className={styles.studioName}>Studio Vale</p>
            <p>Interior design · Miami</p>
          </div>
          <span className={styles.sampleShare}>Share profile ↗</span>
        </div>
        <div className={styles.sampleTabs} aria-hidden="true">
          <span>Work</span><span>Stories</span><span>Press</span><span>About</span>
        </div>
        <div className={styles.profileMosaic}>
          <div className={styles.featuredProject}>
            <Image src="/about/courtyard.webp" alt="" width={254} height={273} sizes="(max-width: 700px) 50vw, 31vw" />
            <div className={styles.projectCaption}><p>The Courtyard House</p><small>Coral Gables</small></div>
          </div>
          <div className={styles.storyList}>
            <div className={styles.story}>
              <Image src="/about/travertine-detail.webp" alt="" width={108} height={138} sizes="(max-width: 700px) 18vw, 14vw" />
              <div><small>In their words</small><p>Why we start with natural materials</p></div>
            </div>
            <div className={styles.story}>
              <Image src="/about/afternoon-light.webp" alt="" width={108} height={151} sizes="(max-width: 700px) 18vw, 14vw" />
              <div><small>In the press</small><p>A home shaped by light</p><span className={styles.sampleRead}>Read the feature ↗</span></div>
            </div>
          </div>
        </div>
      </div>
      <figcaption>Illustrative designer profile</figcaption>
    </figure>
  );
}

export function AboutPageContent() {
  const { data: session, status } = useSession();
  const entryProps = {
    href: status === "authenticated"
      ? projectEntryHref(session?.user)
      : "/auth/signup?type=designer&next=project",
    "aria-disabled": status === "loading",
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      if (status === "loading") event.preventDefault();
    },
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.wordmark} data-folio-brand-target aria-label="Folio home">Folio</Link>
        <nav aria-label="Primary">
          <Link href="/">Explore</Link>
          <Link href="/about" aria-current="page" className={styles.current}>About</Link>
          <Link {...entryProps} className={styles.join}>
            {status === "authenticated" ? "Your workspace" : "Join Folio"} <ArrowUpRight aria-hidden="true" />
          </Link>
        </nav>
      </header>
      <main>
        <article>
          <section className={styles.hero} aria-labelledby="about-title">
            <div className={styles.heroText}>
              <p className={styles.kicker}>Your publishing team</p>
              <h1 id="about-title">Put your past <br />projects <br />to work.</h1>
              <p className={styles.lead}>Turn your work and the thinking behind it into a beautiful, shareable profile—built to help future clients discover you through search and AI.</p>
              <Link {...entryProps} className={styles.primary}>Create your Folio <ArrowUpRight aria-hidden="true" /></Link>
            </div>
            <figure className={styles.heroPhoto}>
              <Image src="/about/travertine-living-room.webp" alt="Afternoon light falls across a travertine fireplace and low stone table beside an arched window." fill priority sizes="(max-width: 700px) 100vw, 55vw" />
              <figcaption>The work is already yours. Let it go further.</figcaption>
            </figure>
          </section>

          <section className={styles.profileSection} aria-labelledby="profile-title">
            <div className={styles.profileCopy}>
              <p className={styles.kicker}>One link. The full picture.</p>
              <h2 id="profile-title">A profile worth sharing.</h2>
              <p>Your projects, published stories, press features, and expertise. Together in one place, with the depth to show what makes you the right designer.</p>
              <p>Ready for the introduction.<br />Built for the discovery.</p>
            </div>
            <ProfileIllustration />
          </section>

          <section className={styles.discovery} aria-labelledby="discovery-title">
            <div className={styles.discoveryCopy}>
              <p className={styles.kicker}>Made for how people find designers now</p>
              <h2 id="discovery-title">Let your <br />expertise <br />be found.</h2>
              <p>The materials you choose. The problems you solve. The spaces you know best. Folio gives that expertise a public home that search engines and AI can understand.</p>
            </div>
            <figure className={styles.diningPhoto}>
              <Image src="/about/courtyard-dining-room.webp" alt="A wood dining table and olive branches beside the courtyard window." width={230} height={247} sizes="(max-width: 700px) 55vw, 29vw" />
              <figcaption>The Courtyard House</figcaption>
            </figure>
            <div className={styles.perspective}>
              <p className={styles.kicker}>The thinking behind the work</p>
              <blockquote>“Every room borrows light from the courtyard.”</blockquote>
              <p className={styles.topics}>Projects · People · Materials · Ideas</p>
            </div>
          </section>

          <section id="how-it-works" className={styles.process} aria-labelledby="process-title">
            <h2 id="process-title">You tell the story.<br />We do the publishing.</h2>
            <ol>
              {steps.map(({ title, description }, index) => (
                <li key={title}>
                  <span aria-hidden="true" className={styles.stepNumber}>0{index + 1}</span>
                  <div><h3>{title}</h3><p>{description}</p></div>
                </li>
              ))}
            </ol>
            <p>Each project adds another chapter to your professional presence.</p>
          </section>

          <section className={styles.close} aria-labelledby="close-title">
            <h2 id="close-title">Show the work you want to be hired for.</h2>
            <Link {...entryProps} className={styles.primary}>Create your Folio <ArrowUpRight aria-hidden="true" /></Link>
          </section>
        </article>
      </main>
      <footer className={styles.footer}>
        <div className={styles.colophon}>
          <Link className={styles.wordmark} href="/" aria-label="Folio home">Folio</Link>
          <p>Your work. Your story. Your Folio.</p>
        </div>
        <nav aria-label="Footer">
          {status === "unauthenticated" && <Link href={projectEntryHref(null)}>Already have an account? Sign in</Link>}
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
          <Link href="/cookies">Cookie Policy</Link>
          <a href="https://instagram.com/folioad">Instagram</a>
        </nav>
      </footer>
    </div>
  );
}
