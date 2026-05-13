"use client";

import { NodeSlide } from "./nodeSlides";
import type { NodeId } from "./timeline";
import { EDGES } from "./timeline";
import { EDGE_META } from "./edgeMeta";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

interface NodeSlidePanelProps {
  slide: NodeSlide;
  nodeId: NodeId;
  faqs?: FAQItem[];
}

export function NodeSlidePanel({ slide, nodeId, faqs }: NodeSlidePanelProps) {
  // Find related edges for this node
  const relatedEdges = EDGES.filter(
    (e) => e.from === nodeId || e.to === nodeId
  );

  return (
    <div className="flex flex-col text-xs text-slate-100 h-full">
      <div className="border-b border-slate-800 px-4 py-3 flex-shrink-0">
        <div className="text-[var(--type-eyebrow)] uppercase tracking-[0.14em] text-slate-400 mb-1"> /* folio-design-system: off-scale */
          {slide.role === "designer"
            ? "Designer Node"
            : slide.role === "vendor"
            ? "Vendor Node"
            : "Platform Node"}
        </div>
        <h2 className="text-sm font-semibold text-slate-50">
          {slide.title}
        </h2>
        {slide.subtitle && (
          <p className="text-[var(--type-eyebrow)] text-slate-400 mt-1">{slide.subtitle}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <p className="text-[var(--type-eyebrow)] text-slate-200 leading-relaxed">
          {slide.description}
        </p>

        <SlideList title="Inputs" items={slide.inputs} />
        <SlideList title="Outputs" items={slide.outputs} />

        {slide.valueForDesigners && (
          <SlideList
            title="Value for designers"
            items={[slide.valueForDesigners]}
          />
        )}
        {slide.valueForVendors && (
          <SlideList
            title="Value for vendors"
            items={[slide.valueForVendors]}
          />
        )}
        {slide.valueForFolio && (
          <SlideList
            title="Value for Folio"
            items={[slide.valueForFolio]}
          />
        )}

        {slide.metricsExamples && (
          <SlideList
            title="Example KPIs"
            items={slide.metricsExamples}
          />
        )}

        {slide.futureState && (
          <SlideList title="Future state" items={[slide.futureState]} />
        )}

        {relatedEdges.length > 0 && (
          <div className="mt-3 border-t border-slate-800 pt-3">
            <h3 className="text-[var(--type-eyebrow)] font-semibold text-slate-300 uppercase tracking-[var(--ls-wide)] mb-1">
              Key relationships
            </h3>
            <ul className="space-y-1.5">
              {relatedEdges.map((edge) => {
                const meta = EDGE_META[edge.id];
                if (!meta) return null;
                const otherNode = edge.from === nodeId ? edge.to : edge.from;

                return (
                  <li
                    key={edge.id}
                    className="text-[var(--type-eyebrow)] text-slate-400 leading-snug"
                  >
                    <span className="font-medium text-slate-200">
                      {meta.label}
                    </span>
                    <span className="text-slate-500"> → {otherNode}</span>
                    <div className="text-slate-400 mt-0.5">
                      {meta.description}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {faqs && faqs.length > 0 && (
          <div className="mt-3 border-t border-slate-800 pt-3">
            <h3 className="text-[var(--type-eyebrow)] font-semibold text-slate-300 uppercase tracking-[var(--ls-wide)] mb-1">
              FAQs from investors
            </h3>
            <ul className="space-y-1.5">
              {faqs.map((f) => (
                <li key={f.id} className="text-[var(--type-eyebrow)] text-slate-400">
                  <div className="font-medium text-slate-200">
                    Q: {f.question}
                  </div>
                  <div className="text-slate-400">
                    A: {f.answer}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function SlideList({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <h3 className="text-[var(--type-eyebrow)] font-semibold text-slate-300 uppercase tracking-[var(--ls-wide)] mb-1">
        {title}
      </h3>
      <ul className="space-y-0.5">
        {items.map((item, idx) => (
          <li
            key={idx}
            className="text-[var(--type-eyebrow)] text-slate-400 leading-snug"
          >
            • {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

