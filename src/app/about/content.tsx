"use client";

import Image from '@/components/FolioImage';
import Link from "next/link";
import { useState, type MouseEvent } from "react";
import { useSession } from "next-auth/react";
import { ArrowRight, FileText, Lightbulb, PanelsTopLeft } from "lucide-react";
import { projectEntryHref } from "@/lib/onboarding/professional-entry";
import styles from "./about.module.css";

const steps = [
  { title: "Bring in one project.", description: "Start with photographs of a completed project. Organize the rooms and identify the products and collaborators that belong in the story." },
  { title: "Talk about the thinking.", description: "Folio reviews what you’ve shared before an interview tailored to the project. The conversation develops with your answers, drawing out the brief, decisions and details a photograph can’t explain." },
  { title: "Make the story yours.", description: "Review the illustrated draft, refine the language and check the quotations and credits. You decide what’s ready to publish." },
  { title: "Keep the work in circulation.", description: "Publish your project, then use Publishing Studio to prepare further stories and social content from the work and perspective you’ve already shared." },
];

export function AboutPageContent() {
  const { data: session, status } = useSession();
  const [imageFailed, setImageFailed] = useState(false);
  const startHref = status === "authenticated"
    ? projectEntryHref(session?.user)
    : "/auth/signup?type=designer&next=project";
  const startProps = {
    href: startHref,
    className: styles.primary,
    "aria-disabled": status === "loading",
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      if (status === "loading") event.preventDefault();
    },
  };

  return (
    <article className={styles.page}>
      <section className={[styles.container, styles.hero].join(" ")} aria-labelledby="about-title">
        <div>
          <p className={styles.eyebrow}>About Folio</p>
          <h1 id="about-title" className={styles.headline}>Good design deserves<br />to be published.</h1>
          <p className={styles.lead}>
            Your projects show what you create. The stories behind them reveal how you think.
            Folio brings both together in a publication of your own.
          </p>
          <p className={styles.body}>
            Full editorial features. Fresh story ideas. A studio for managing your social
            content. Built from your work and perspective, with you in control of what’s published.
          </p>
          <div className={styles.actions}>
            <Link {...startProps}>Start with a project <ArrowRight size={18} aria-hidden="true" /></Link>
            <a href="#how-it-works" className={styles.textLink}>See how it works</a>
          </div>
          <p className={styles.caption}>For design studios of every size.</p>
        </div>
        <div className={styles.cover}>
          {!imageFailed && <Image
            src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=85&w=1600&auto=format&fit=crop"
            alt="" fill priority
            sizes="(max-width: 767px) calc(100vw - 48px), (max-width: 1280px) 42vw, 480px"
            className={styles.photograph}
            onError={() => setImageFailed(true)}
          />}
          <div className={styles.coverShade} aria-hidden="true" />
          <p className={styles.coverMasthead}>Folio</p>
          <div className={styles.coverCopy}>
            <p className={styles.coverEyebrow}>A publication of your own</p>
            <p className={styles.coverTitle}>The work.<br />The thinking.<br />Your point of view.</p>
          </div>
          <p className={styles.coverFooter}>Projects · Perspectives · Details</p>
        </div>
      </section>

      <section className={[styles.container, styles.deliverables].join(" ")} aria-labelledby="what-you-get">
        <p className={styles.eyebrow}>What Folio gives you</p>
        <h2 id="what-you-get" className={styles.sectionTitle}>A growing publication,<br />built around your studio.</h2>
        <div className={styles.deliverableGrid}>
          <div className={styles.deliverable}>
            <FileText size={28} strokeWidth={1.25} aria-hidden="true" />
            <h3 className={styles.stepTitle}>Full editorial features.</h3>
            <p>Illustrated, long-form articles that bring your photography, design decisions and own words together. An editorial story to review and publish, with quotations and credits.</p>
            <p className={styles.deliverableDetail}>Project features · Room stories · Your perspective</p>
          </div>
          <div className={styles.deliverable}>
            <Lightbulb size={28} strokeWidth={1.25} aria-hidden="true" />
            <h3 className={styles.stepTitle}>Your next story idea.</h3>
            <p>Folio finds new angles in the work and expertise you’ve already shared. Explore materials, recurring ideas and how you design, without needing a new completed project for every story.</p>
            <p className={styles.deliverableDetail}>Design thinking · Studio expertise · Fresh angles</p>
          </div>
          <div className={styles.deliverable}>
            <PanelsTopLeft size={28} strokeWidth={1.25} aria-hidden="true" />
            <h3 className={styles.stepTitle}>Your Publishing Studio.</h3>
            <p>A workspace to develop ideas, review drafts and prepare how your content is shared on social. Shape captions, carousels and campaign assets around the stories you want people to see.</p>
            <p className={styles.deliverableDetail}>Content ideas · Social assets · Sharing workflow</p>
          </div>
        </div>
      </section>

      <section className={[styles.container, styles.mission].join(" ")} aria-labelledby="why-folio">
        <div>
          <p className={styles.eyebrow}>Why we’re here</p>
          <h2 id="why-folio" className={styles.sectionTitle}>A publication shouldn’t depend on a media budget.</h2>
        </div>
        <div className={styles.prose}>
          <p>
            Behind every finished space are choices worth understanding. Bringing those
            choices to an audience takes interviewing, writing, editing and production—work
            that asks for time and resources beyond running a design practice.
          </p>
          <p>
            Folio makes that process part of your practice. Whether you work independently
            or with a team, your studio can build a body of published work that explains
            its ideas, credits its contributors and gives people more to discover.
          </p>
        </div>
      </section>

      <section id="how-it-works" className={styles.process} aria-labelledby="process-title">
        <div className={[styles.container, styles.processGrid].join(" ")}>
          <div>
            <p className={styles.eyebrow}>From archive to publication</p>
            <h2 id="process-title" className={styles.sectionTitle}>You bring the work.<br />We help tell its story.</h2>
            <p className={styles.body}>Start with one completed project. You don’t need to arrive with a finished story.</p>
          </div>
          <ol className={styles.steps}>
            {steps.map((step, index) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.stepNumber} aria-hidden="true">0{index + 1}</span>
                <div><h3 className={styles.stepTitle}>{step.title}</h3><p>{step.description}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={[styles.container, styles.ownership].join(" ")} aria-labelledby="your-perspective">
        <p className={styles.eyebrow}>Your perspective. Your publication.</p>
        <h2 id="your-perspective" className={styles.sectionTitle}>The expertise is yours.<br />The final word is, too.</h2>
        <p className={styles.body}>
          Folio uses AI to help interview, draft and organize. Your project material and
          answers give the story its substance. You review the words, choose the images
          and decide when to publish.
        </p>
      </section>

      <section className={styles.print} aria-labelledby="print-title">
        <div className={[styles.container, styles.printGrid].join(" ")}>
          <div className={styles.printPreview} aria-hidden="true">
            <div className={styles.printSheet}>
              <p className={styles.coverMasthead}>Folio</p>
              <div><p className={styles.coverEyebrow}>Your studio, in print</p><p className={styles.coverTitle}>Work worth<br />keeping.</p></div>
              <p className={styles.printContents}>The projects.<br />The people.<br />The way you design.</p>
            </div>
          </div>
          <div>
            <p className={styles.comingSoon}>Coming soon · Print editions</p>
            <h2 id="print-title" className={styles.sectionTitle}>Your studio’s magazine.<br />In someone’s hands.</h2>
            <p className={styles.body}>We’re working on turning your Folio posts into a printed magazine of your studio: project features alongside articles about you, your team and how you design.</p>
            <p className={styles.body}>Keep copies at your office, share them as a portfolio or distribute them to introduce your practice. A publication people can take away, return to and pass on.</p>
          </div>
        </div>
      </section>

      <section className={styles.begin} aria-labelledby="begin-title">
        <div className={[styles.container, styles.beginInner].join(" ")}>
          <div>
            <p className={styles.eyebrow}>Your first issue starts here</p>
            <h2 id="begin-title" className={styles.sectionTitle}>Begin with one project.</h2>
            <p className={styles.body}>
              Create your personal account, join or create your firm, then upload your
              project photographs. We’ll guide you from there.
            </p>
            <p className={styles.caption}>Joining an existing firm may require approval from its administrator.</p>
          </div>
          <div className={styles.beginActions}>
            <Link {...startProps}>Start your first project <ArrowRight size={18} aria-hidden="true" /></Link>
            {status === "unauthenticated" && (
              <Link href={projectEntryHref(null)} className={styles.textLink}>Already have an account? Sign in</Link>
            )}
            <Link href="/" className={styles.textLink}>Explore Folio first</Link>
          </div>
        </div>
      </section>
    </article>
  );
}
