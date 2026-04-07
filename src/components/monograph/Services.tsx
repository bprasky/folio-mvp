import Link from 'next/link';

interface ServicesProps {
  designerName: string;
}

export default function Services({ designerName }: ServicesProps) {
  return (
    <section>
      <div className="mb-8">
        <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-folio-text-primary font-light mb-4">
          Services
        </h2>
      </div>

      <div className="grid md:grid-cols-2 gap-6 md:gap-8">
        {/* Full-Service Card */}
        <div className="glass-surface p-8 md:p-10">
          <h3 className="font-serif text-2xl md:text-3xl text-folio-text-primary font-light mb-4">
            Full-Service Design
          </h3>
          <p className="text-folio-text-secondary text-base md:text-lg font-light leading-relaxed mb-6">
            Complete interior design services from concept to installation. 
            Transform your space with {designerName}'s signature approach to 
            residential and commercial interiors.
          </p>
          <Link
            href="/contact"
            className="inline-block px-6 py-3 bg-stone-900 text-white rounded-full text-sm md:text-base font-light hover:bg-stone-800 transition-colors"
          >
            Inquire
          </Link>
        </div>

        {/* Folio Atelier AI Card */}
        <div className="glass-surface p-8 md:p-10 relative overflow-hidden">
          {/* Surge Indicator */}
          <div className="absolute top-4 right-4">
            <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full border border-amber-200">
              Surge Active
            </span>
          </div>

          <h3 className="font-serif text-2xl md:text-3xl text-folio-text-primary font-light mb-4">
            Folio Atelier AI
          </h3>
          <p className="text-folio-text-secondary text-base md:text-lg font-light leading-relaxed mb-4">
            AI-powered design consultation and space planning. 
            Get expert design direction powered by {designerName}'s aesthetic 
            and Folio's advanced design intelligence.
          </p>
          <div className="mb-6">
            <span className="text-2xl md:text-3xl font-serif text-folio-text-primary font-light">
              Starting at $1,200
            </span>
            <span className="text-folio-text-secondary text-sm ml-2">per room</span>
          </div>
          <Link
            href="/atelier"
            className="inline-block px-6 py-3 bg-stone-900 text-white rounded-full text-sm md:text-base font-light hover:bg-stone-800 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </div>
    </section>
  );
}
