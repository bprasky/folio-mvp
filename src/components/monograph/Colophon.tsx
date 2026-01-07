interface ColophonProps {
  name: string;
  editorialsFeatured: number;
}

function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

export default function Colophon({ name, editorialsFeatured }: ColophonProps) {
  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <footer className="border-t border-stone-200 mt-24 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between text-sm text-stone-500 font-light">
          <div className="text-center flex-1">
            <p className="mb-2">
              Folio Monograph · {currentDate}
            </p>
            <p className="text-stone-400">
              {name} on Folio
            </p>
          </div>
          <div className="text-right text-[13px] leading-tight" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#6d6256', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span>Featured in </span>
            <span className="text-[#b89a72] font-normal not-italic" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              {formatNumber(editorialsFeatured)}
            </span>
            <span className="ml-1">Folio Editorials</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
