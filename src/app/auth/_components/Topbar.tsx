import { EditorialMasthead } from '@/components/navigation/EditorialMasthead';

type TopbarProps = {
  rightCta?: { label: string; href: string };
};

export function Topbar({ rightCta }: TopbarProps) {
  return <EditorialMasthead signedOutHref={rightCta?.href} />;
}
