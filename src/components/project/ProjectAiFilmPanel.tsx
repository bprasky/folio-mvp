"use client";

/**
 * ProjectAiFilmPanel
 * - Dedicated slot for the future AI-compiled "Project Film".
 * - Present behavior:
 *   • If a LONG_VIDEO ProjectModule exists (optionally isAiCompiled = true),
 *     render the player here.
 *   • If not, show a subtle CTA explaining that Folio will compile a project film
 *     from short-form stories, and that designers can upload a placeholder film
 *     from the Media tab in the meantime.
 */

type FilmProps = {
  module?: any | null;
  project?: any;
};

export function ProjectAiFilmPanel({ module, project }: FilmProps) {
  if (!module) {
    return (
      <section className="rounded-2xl border border-white/60 bg-white/40 px-4 py-3 md:px-5 md:py-4 text-[12px] text-neutral-700 space-y-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Project Film (AI-Compiled)
        </div>
        <p>
          This is where the <span className="font-medium">AI-compiled project film</span> for{" "}
          <span className="font-medium">{project?.title}</span> will appear — a cinematic edit
          generated from the designer's short-form stories and clips throughout the project.
        </p>
        <p className="text-[11px] text-neutral-500">
          Until the AI editor is live, you can upload a long-form reveal or walkthrough from the{" "}
          <span className="font-medium">Media</span> tab on the project dashboard (saved as a{" "}
          <code className="rounded bg-neutral-100 px-1">LONG_VIDEO</code> module) and it will
          render here.
        </p>
      </section>
    );
  }

  const media = Array.isArray(module.media) ? module.media[0] : module.media;
  if (!media?.url) return null;

  const label = module.title || project?.title || "Project Film";

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-[0.18em] uppercase text-neutral-500">
          Project Film {module.isAiCompiled ? "(AI-Compiled)" : ""}
        </h3>
        <span className="text-[11px] text-neutral-400">
          Long-form video • {label}
        </span>
      </div>
      <div className="overflow-hidden rounded-2xl bg-black/90 ring-1 ring-black/40">
        <div className="relative pb-[56.25%]">
          <video
            src={media.url}
            controls
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      </div>
      {module.description && (
        <p className="text-[12px] text-neutral-600">
          {module.description}
        </p>
      )}
    </section>
  );
}

