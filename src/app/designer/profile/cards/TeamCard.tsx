import SafeImage from '@/components/SafeImage';

interface TeamCardProps {
  member: {
    id: string;
    name: string;
    role: string;
    headshotUrl?: string | null;
    profileImage?: string | null;
  };
}

export default function TeamCard({ member }: TeamCardProps) {
  const imageUrl = member.headshotUrl || member.profileImage;
  const initials = member.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="team-card rounded-xl p-4 flex gap-3 items-center">
      <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0">
        {imageUrl ? (
          <SafeImage
            src={imageUrl}
            alt={member.name}
            width={44}
            height={44}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="team-avatar w-full h-full flex items-center justify-center text-sm font-semibold">
            {initials}
          </div>
        )}
      </div>
      <div>
        <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          {member.name}
        </div>
        <div className="folio-meta">{member.role}</div>
      </div>
      <style jsx>{`
        .team-card {
          background: var(--surface-canvas);
          border: 1px solid var(--border);
          min-height: 80px;
        }
        .team-avatar {
          background: linear-gradient(135deg, var(--shadow-dark) 0%, var(--text-tertiary) 100%);
          color: var(--surface-canvas);
          letter-spacing: 0.05em;
        }
      `}</style>
    </div>
  );
}
