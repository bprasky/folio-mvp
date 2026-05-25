import { redirect } from 'next/navigation';

// The professionals join flow now lives at /auth/org-setup. This route is
// preserved for inbound links (profile CTAs, ProfessionalUpgradeModal, search
// engines) and just forwards the user with whatever intent they brought.
export const dynamic = 'force-dynamic';

const VALID_TYPES = new Set(['designer', 'architect', 'builder', 'vendor', 'photographer']);

// Photographer doesn't have a first-class intent in the new flow yet; map it
// to designer so the user still lands somewhere sensible.
const ALIAS: Record<string, string> = {
  photographer: 'designer',
};

export default function ProfessionalsJoinRedirect({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const rawType = (searchParams.type || '').toLowerCase();
  const normalized = VALID_TYPES.has(rawType) ? ALIAS[rawType] ?? rawType : null;
  redirect(normalized ? `/auth/org-setup?type=${normalized}` : '/auth/org-setup');
}
