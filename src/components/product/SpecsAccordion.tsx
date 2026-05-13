"use client";
import { Product } from "@/lib/mock/product";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export function SpecsAccordion({ product }: { product: Product }) {
  const { dimensions, weight, materials, finish, leadTime, files } = product;
  return (
    <div className="rounded-2xl border border-folio-border-subtle bg-white">
      <Accordion type="multiple" className="px-3">
        <AccordionItem value="specs">
          <AccordionTrigger>Specifications</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <Spec label="Materials" value={materials.join(", ")} />
              <Spec label="Finish" value={finish} />
              <Spec label="Dimensions" value={`${dimensions.w}×${dimensions.d}×${dimensions.h} ${dimensions.units}`} />
              {weight && <Spec label="Weight" value={`${weight.value} ${weight.units}`} />}
              {leadTime && <Spec label="Lead Time" value={leadTime} />}
              <Spec label="SKU" value={product.sku} />
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="files">
          <AccordionTrigger>Files & Downloads</AccordionTrigger>
          <AccordionContent>
            <FileList title="Spec Sheets" items={files.specSheets} />
            <FileList title="3D Files" items={files._3d} />
            {files.others && <FileList title="Additional" items={files.others} />}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-folio-text-secondary">{label}</div>
      <div className="text-[var(--type-meta)] text-folio-text-primary">{value}</div>
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





