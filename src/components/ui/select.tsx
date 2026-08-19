// src/components/ui/select.tsx
"use client";

import * as React from "react";
import { createPortal } from "react-dom";

type SelectContextType = {
  open: boolean;
  setOpen: (b: boolean) => void;
  value: string;
  setValue: (v: string) => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
  registerContent: (el: HTMLDivElement | null) => void;
  items: Array<{ value: string; label: React.ReactNode }>;
  setItems: React.Dispatch<
    React.SetStateAction<Array<{ value: string; label: React.ReactNode }>>
  >;
};

const SelectCtx = React.createContext<SelectContextType | null>(null);
const useSelect = () => {
  const ctx = React.useContext(SelectCtx);
  if (!ctx) throw new Error("Select components must be used inside <Select>");
  return ctx;
};

/** Public props (unchanged externally) */
export function Select({
  value,
  onValueChange,
  children,
}: {
  value: string;
  onValueChange: (v: string) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const [items, setItems] = React.useState<
    Array<{ value: string; label: React.ReactNode }>
  >([]);

  // Close on outside click / escape
  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (
        !contentRef.current?.contains(t) &&
        !triggerRef.current?.contains(t as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const ctx: SelectContextType = {
    open,
    setOpen,
    value,
    setValue: onValueChange,
    triggerRef,
    registerContent: (el) => (contentRef.current = el),
    items,
    setItems,
  };

  // Build the item registry by scanning children of <SelectContent>
  // Consumers keep writing <SelectItem value="v">Label</SelectItem>
  // but <SelectItem> renders null; we collect data in <SelectContent>.
  return <SelectCtx.Provider value={ctx}>{children}</SelectCtx.Provider>;
}

export function SelectTrigger({
  className = "",
  children,
  ...props
}: React.ComponentProps<"button">) {
  const { open, setOpen, triggerRef } = useSelect();
  return (
    <button
      type="button"
      aria-haspopup="listbox"
      aria-expanded={open}
      ref={triggerRef}
      onClick={() => setOpen(!open)}
      className={[
        "w-full h-10 rounded-xl px-3 text-left",
        "bg-white/10 text-white ring-1 ring-white/20 border-0",
        "hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/40",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}

export function SelectValue({
  placeholder,
  children,
}: {
  placeholder?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const { value, items } = useSelect();
  const current = items.find((i) => i.value === value)?.label;
  return (
    <span className={current ? "" : "text-white/50"}>
      {current ?? placeholder ?? children ?? "Select"}
    </span>
  );
}

/** Data-only; renders nothing. */
export function SelectItem({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  // Intentionally empty. Real rendering happens in <SelectContent>.
  // This component is only a descriptor the parent collects.
  return null as unknown as JSX.Element;
}

/**
 * useLayoutEffect logs a warning when it runs during SSR. Selecting useEffect on
 * the server keeps the hook COUNT identical on both renders — which is what the
 * rules-of-hooks contract cares about — while avoiding that warning.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

/** Scans its children for <SelectItem> and renders the menu once (portal). */
export function SelectContent({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { open, registerContent, items, setItems, setValue, setOpen, triggerRef, value } =
    useSelect();

  // Parse children and populate items registry
  React.useEffect(() => {
    const parsed: Array<{ value: string; label: React.ReactNode }> = [];
    React.Children.forEach(children, (child: any) => {
      if (React.isValidElement(child) && child.type === SelectItem) {
        const props = child.props as { value: string; children: React.ReactNode };
        parsed.push({ value: props.value, label: props.children });
      }
    });
    setItems(parsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children]);

  // Positioning relative to trigger (simple popper)
  const [pos, setPos] = React.useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });
  // useLayoutEffect, not useEffect: this must not run during SSR, where there is
  // no layout to measure. React warns if it does, so it is selected at module
  // level rather than guarded by an early return inside the component.
  useIsomorphicLayoutEffect(() => {
    const trig = triggerRef.current;
    if (!trig) return;
    const rect = trig.getBoundingClientRect();
    setPos({ top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX, width: rect.width });
  }, [open, triggerRef]);

  // Every early return lives BELOW every hook, deliberately. The document check
  // used to sit above useState/useLayoutEffect, which meant the server render
  // (no document) called two fewer hooks than the client render did — the exact
  // shape of "Rendered more hooks than during the previous render". It did not
  // fail loudly because the component also returns null when closed, so the
  // mismatch only surfaced when a select was open on first paint.
  if (typeof document === "undefined") return null;
  if (!open) return null;

  const menu = (
    <div
      ref={registerContent}
      role="listbox"
      aria-activedescendant={value || undefined}
      tabIndex={-1}
      style={{ top: pos.top, left: pos.left, width: pos.width, position: "absolute" }}
      className={[
        "z-[95] rounded-xl overflow-hidden",
        "bg-surface-ground text-folio-text-primary backdrop-blur-xl",
        "ring-1 ring-[var(--ridge-outer)] shadow-2xl",
        className,
      ].join(" ")}
    >
      {items.length === 0 ? (
        <div className="px-3 py-2 text-sm text-white/60">No options</div>
      ) : (
        items.map((it) => (
          <div
            key={it.value}
            role="option"
            aria-selected={value === it.value}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setValue(it.value);
              setOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setValue(it.value);
                setOpen(false);
              }
            }}
            className={[
              "px-3 py-2 text-sm cursor-pointer",
              "hover:bg-white/10",
              value === it.value ? "bg-white/10" : "",
            ].join(" ")}
          >
            {it.label}
          </div>
        ))
      )}
    </div>
  );

  return createPortal(menu, document.body);
}