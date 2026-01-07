interface FingerprintProps {
  tags: string[];
  projectCount: number;
  lastUpdated: Date | null;
  projectViews: number;
}

function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

export default function Fingerprint({ tags, projectCount, lastUpdated, projectViews }: FingerprintProps) {
  const formatDate = (date: Date | null) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <section className="max-w-4xl mx-auto">
      <div className="border-t border-b border-stone-200 py-12">
        <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 mb-6">
          {tags.map((tag, index) => (
            <span
              key={index}
              className="px-4 py-2 text-sm md:text-base text-stone-700 font-light border border-stone-300 rounded-full bg-white/50"
            >
              {tag}
            </span>
          ))}
        </div>
        
        <div className="text-center text-sm text-stone-500 font-light mb-4">
          <span>Distilled from {projectCount} {projectCount === 1 ? 'project' : 'projects'}</span>
          {lastUpdated && (
            <>
              <span className="mx-2">·</span>
              <span>Last updated {formatDate(lastUpdated)}</span>
            </>
          )}
        </div>

        {/* Project Views Metric */}
        <div className="text-center text-[13px] leading-tight" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#6d6256', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span className="text-[#b89a72] font-normal not-italic" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            {formatNumber(projectViews)}
          </span>
          <span className="ml-1">Project Views</span>
        </div>
      </div>
    </section>
  );
}
