'use client';

import './auth.css';

type PhotoPanelProps = {
  imageSrc: string;
  imageAlt: string;
  eyebrow: string;
  description: string;
  counter: string;
};

export function PhotoPanel({ imageSrc, imageAlt, eyebrow, description, counter }: PhotoPanelProps) {
  return (
    <section className="auth-photo-panel" aria-label="Featured project">
      <figure className="auth-photo">
        {/* Plain <img> with onError to mirror the reference HTML's graceful gradient fallback. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={imageAlt}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      </figure>
      <figcaption className="auth-photo-caption">
        <div>
          <span className="auth-photo-caption__eyebrow">{eyebrow}</span>
          <div className="auth-photo-caption__desc">{description}</div>
        </div>
        <span className="auth-photo-caption__counter">{counter}</span>
      </figcaption>
    </section>
  );
}
