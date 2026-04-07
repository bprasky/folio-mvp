"use client";
import { Product } from "@/lib/mock/product";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export function SpecsAccordion({ product }: { product: Product }) {
  const { dimensions, weight, materials, finish, leadTime, files } = product;
  const hasDimensions = dimensions.w > 0 || dimensions.d > 0 || dimensions.h > 0;
  const hasSpecs = hasDimensions || weight || materials.length > 0 || finish || leadTime || product.sku;
  const hasFiles = files.specSheets.length > 0 || files._3d.length > 0 || (files.others?.length ?? 0) > 0;

  if (!hasSpecs && !hasFiles) return null;

  return (
    <div className="rounded-2xl border border-folio-border-subtle bg-white">
      <Accordion type="multiple" className="px-3">
        {hasSpecs && (
        <AccordionItem value="specs">
          <AccordionTrigger>Specifications</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              {materials.length > 0 && <Spec label="Materials" value={materials.join(", ")} />}
              {finish && <Spec label="Finish" value={finish} />}
              {hasDimensions && <Spec label="Dimensions" value={`${dimensions.w}×${dimensions.d}×${dimensions.h} ${dimensions.units}`} />}
              {weight && <Spec label="Weight" value={`${weight.value} ${weight.units}`} />}
              {leadTime && <Spec label="Lead Time" value={leadTime} />}
              {product.sku && <Spec label="SKU" value={product.sku} />}
            </div>
          </AccordionContent>
        </AccordionItem>
        )}
        {hasFiles && (
        <AccordionItem value="files">
          <AccordionTrigger>Files & Downloads</AccordionTrigger>
          <AccordionContent>
            {files.specSheets.length > 0 && <FileList title="Spec Sheets" items={files.specSheets} />}
            {files._3d.length > 0 && <FileList title="3D Files" items={files._3d} />}
            {files.others && files.others.length > 0 && <FileList title="Additional" items={files.others} />}
          </AccordionContent>
        </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-folio-text-secondary">{label}</div>
      <div className="text-[13px] text-folio-text-primary">{value}</div>
    </div>
  );
}

function FileList({ title, items }: { title: string; items: { label: string; href: string }[] }) {
  return (
    <div className="mt-3">
      <div className="text-sm font-medium text-folio-text-primary">{title}</div>
      <div className="mt-2 flex flex-col gap-2">
        {items.map((f, i) => (
          <a key={i} href={f.href} className="text-sm text-[var(--folio-gold)] hover:underline">{f.label}</a>
        ))}
      </div>
    </div>
  );
}





