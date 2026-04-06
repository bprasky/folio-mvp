import Link from "next/link";
import SafeImage from "@/components/SafeImage";

type Props = {
  designer: {
    id: string;
    name: string;
    title?: string | null;
    profileImage?: string | null;
    location?: string | null;
  };
  isOwner: boolean;
};

export default function EmptyProfileState({ designer, isOwner }: Props) {
  if (!isOwner) {
    // Public view of empty profile
    return (
      <div className="min-h-screen bg-surface-canvas flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-surface-ground flex items-center justify-center overflow-hidden">
            {designer.profileImage ? (
              <SafeImage
                src={designer.profileImage}
                alt={designer.name}
                width={80}
                height={80}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-3xl text-folio-text-tertiary">
                {designer.name.charAt(0)}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-semibold text-folio-text-primary">{designer.name}</h1>
          {designer.title && (
            <p className="mt-2 text-folio-text-secondary">{designer.title}</p>
          )}
          {designer.location && (
            <p className="mt-1 text-folio-text-secondary">{designer.location}</p>
          )}
          <p className="mt-6 text-folio-text-tertiary">
            This designer is setting up their portfolio. Check back soon.
          </p>
        </div>
      </div>
    );
  }

  // Owner view - prompt to get started
  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--bg-base)] to-[var(--bg-base)]">
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <h1 className="text-3xl font-semibold text-folio-text-primary">
          Welcome to Folio, {designer.name.split(' ')[0]}
        </h1>
        <p className="mt-4 text-lg text-folio-text-secondary">
          Let's build your profile. You can start with either:
        </p>

        <div className="mt-12 grid sm:grid-cols-2 gap-6">
          {/* Upload Projects Card */}
          <Link
            href="/designer/projects/new"
            className="group p-8 bg-surface-canvas rounded-2xl border border-folio-border-subtle hover:border-folio-border-subtle hover:shadow-lg transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-[var(--text-primary)] text-white flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-folio-text-primary">
              Upload Projects
            </h3>
            <p className="mt-2 text-sm text-folio-text-secondary">
              Add 2-3 completed projects and we'll generate your profile automatically.
            </p>
            <p className="mt-4 text-sm font-medium text-folio-text-primary group-hover:underline">
              Start uploading →
            </p>
          </Link>

          {/* Brand Assets Card */}
          <Link
            href="/designer/brand"
            className="group p-8 bg-surface-canvas rounded-2xl border border-folio-border-subtle hover:border-folio-border-subtle hover:shadow-lg transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-surface-canvas border-2 border-[var(--text-primary)] text-folio-text-primary flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-folio-text-primary">
              Add Brand Assets
            </h3>
            <p className="mt-2 text-sm text-folio-text-secondary">
              Upload your logo, colors, and mood images to shape your profile's look.
            </p>
            <p className="mt-4 text-sm font-medium text-folio-text-primary group-hover:underline">
              Set up brand →
            </p>
          </Link>
        </div>

        <p className="mt-12 text-sm text-folio-text-secondary">
          The more you add, the better we can represent your aesthetic.
        </p>
      </div>
    </div>
  );
}


