"use client";

import { useState, useCallback, useEffect, useRef, useId } from "react";
import { Plus, Pencil, Trash2, Check, X, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import styles from "@/components/ui/WorkflowForms.module.css";
import { CREDIT_ROLE_OPTIONS, type CreditEntry } from "@/lib/posting/creditsSchema";

/**
 * CreditsEditor — Add/edit/remove credits on a project post.
 *
 * Used both before article generation (so the AI can reference collaborators)
 * and after generation (so designers can add people they forgot).
 *
 * The Designer credit is auto-populated from the project owner and cannot be removed.
 *
 * When role is "Photographer", shows additional fields (instagram) and
 * typeahead search for existing photographer users on Folio.
 */

interface CreditsEditorProps {
  credits: CreditEntry[];
  onChange: (credits: CreditEntry[]) => void;
  saving?: boolean;
}

const ROLE_OPTIONS = [
  ...CREDIT_ROLE_OPTIONS,
  "Other",
] as const;

type EditingCredit = {
  role: string;
  customRole: string;
  name: string;
  url: string;
  instagram: string;
  userId?: string;
};

const emptyForm: EditingCredit = { role: "", customRole: "", name: "", url: "", instagram: "" };

function isPhotographerRole(role: string): boolean {
  return role.toLowerCase() === "photographer";
}

export function CreditsEditor({ credits, onChange, saving }: CreditsEditorProps) {
  const [adding, setAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form, setForm] = useState<EditingCredit>({ ...emptyForm });

  const isDesigner = (credit: CreditEntry) =>
    credit.role.toLowerCase() === "designer";

  const handleAdd = useCallback(() => {
    setForm({ ...emptyForm });
    setAdding(true);
    setEditingIndex(null);
  }, []);

  const handleEdit = useCallback((index: number) => {
    const credit = credits[index];
    if (isDesigner(credit)) return;
    const matchesPreset = (CREDIT_ROLE_OPTIONS as readonly string[]).includes(credit.role);
    setForm({
      role: matchesPreset ? credit.role : "Other",
      customRole: matchesPreset ? "" : credit.role,
      name: credit.name,
      url: credit.url || "",
      instagram: credit.instagram || "",
      userId: credit.userId,
    });
    setEditingIndex(index);
    setAdding(false);
  }, [credits]);

  const handleRemove = useCallback((index: number) => {
    if (isDesigner(credits[index])) return;
    onChange(credits.filter((_, i) => i !== index));
  }, [credits, onChange]);

  const handleCancel = useCallback(() => {
    setAdding(false);
    setEditingIndex(null);
    setForm({ ...emptyForm });
  }, []);

  const handleSave = useCallback(() => {
    const role = form.role === "Other" ? form.customRole.trim() : form.role;
    const name = form.name.trim();
    if (!role || !name) return;

    const entry: CreditEntry = {
      role,
      name,
      ...(form.url.trim() ? { url: form.url.trim() } : {}),
      ...(form.instagram.trim() ? { instagram: form.instagram.trim() } : {}),
      ...(form.userId ? { userId: form.userId } : {}),
    };

    if (editingIndex !== null) {
      const updated = [...credits];
      updated[editingIndex] = entry;
      onChange(updated);
    } else {
      onChange([...credits, entry]);
    }

    setAdding(false);
    setEditingIndex(null);
    setForm({ ...emptyForm });
  }, [form, editingIndex, credits, onChange]);

  const canSaveForm = (() => {
    const role = form.role === "Other" ? form.customRole.trim() : form.role;
    return role.length > 0 && form.name.trim().length > 0;
  })();

  return <div className={styles.stack}>
    <div className="flex items-center justify-between gap-3">
      <h3 className={styles.sectionTitle}>Credits</h3>
      {saving && <span role="status" className={styles.help}>Saving...</span>}
    </div>
    <div>
      {credits.map((credit, idx) => <div key={idx} className={styles.creditRow}>
        <div className={styles.creditIdentity}>
          <span className={styles.help}>{credit.role}</span>
          <span className="folio-body text-folio-text-primary">{credit.name}</span>
          {credit.url && <a href={credit.url} target="_blank" rel="noopener noreferrer" className={`${styles.help} underline underline-offset-4`}>Website</a>}
          {credit.instagram && <span className={styles.help}>@{credit.instagram.replace(/^@/, "")}</span>}
        </div>
        <div className={styles.creditTools}>
          {isDesigner(credit) ? <Lock size={16} aria-label="Project designer" className="text-folio-text-secondary" /> : <>
            <button type="button" onClick={() => handleEdit(idx)} disabled={saving} className={styles.close} aria-label={`Edit credit for ${credit.name}`} title="Edit credit"><Pencil size={16} /></button>
            <button type="button" onClick={() => handleRemove(idx)} disabled={saving} className={styles.close} aria-label={`Remove credit for ${credit.name}`} title="Remove credit"><Trash2 size={16} /></button>
          </>}
        </div>
      </div>)}
    </div>
    <div><button type="button" disabled={saving} onClick={handleAdd} className={styles.secondary}><Plus size={16} aria-hidden />Add Credit</button></div>
    <Dialog open={adding || editingIndex !== null} onOpenChange={open => { if (!open) handleCancel(); }} placement="right" backdropClassName="bg-black/40">
      <DialogContent placement="right" className={styles.sheet}>
        <div className={styles.sheetHeader}>
          <div><p className={styles.eyebrow}>The people behind the project</p><DialogTitle className={styles.sheetTitle}>{editingIndex !== null ? 'Edit credit' : 'Add a collaborator'}</DialogTitle><DialogDescription className={`${styles.help} mt-3`}>Give the people who brought this project to life a place alongside the work.</DialogDescription></div>
          <button type="button" onClick={handleCancel} className={styles.close} aria-label="Close credits"><X size={18} /></button>
        </div>
        {(adding || editingIndex !== null) && <CreditForm form={form} onChange={setForm} onSave={handleSave} onCancel={handleCancel} canSave={canSaveForm && !saving} />}
      </DialogContent>
    </Dialog>
  </div>;
}

/** Typeahead suggestion from user search */
interface UserSuggestion {
  id: string;
  name: string;
  profileImage?: string;
}

function CreditForm({
  form,
  onChange,
  onSave,
  onCancel,
  canSave,
}: {
  form: EditingCredit;
  onChange: (f: EditingCredit) => void;
  onSave: () => void;
  onCancel: () => void;
  canSave: boolean;
}) {
  const id = useId();
  const showPhotographerFields = isPhotographerRole(form.role);
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Typeahead search for photographer users
  useEffect(() => {
    if (!showPhotographerFields || form.name.trim().length < 2 || form.userId) {
      setSuggestions([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(form.name.trim())}&role=PHOTOGRAPHER&limit=5`
        );
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.users || []);
          setShowSuggestions(true);
        }
      } catch {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [form.name, showPhotographerFields, form.userId]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectSuggestion = (user: UserSuggestion) => {
    onChange({ ...form, name: user.name, userId: user.id });
    setShowSuggestions(false);
    setSuggestions([]);
  };

  return <form className="flex min-h-0 flex-1 flex-col" onSubmit={event => { event.preventDefault(); if (canSave) onSave(); }}>
    <div className={`${styles.sheetBody} ${styles.stack}`}>
      <label className={styles.label}>Their role
        <select value={form.role} required onChange={e => onChange({ ...form, role: e.target.value, customRole: "", instagram: "", userId: undefined })} className={styles.field}>
          <option value="">Select role...</option>{ROLE_OPTIONS.map(role => <option key={role} value={role}>{role}</option>)}
        </select>
      </label>
      {form.role === "Other" && <label className={styles.label}>Role<input type="text" required value={form.customRole} onChange={e => onChange({ ...form, customRole: e.target.value })} className={styles.field} maxLength={60} /></label>}
      <div className="relative" ref={suggestionsRef}>
        <label className={styles.label} htmlFor={`${id}-name`}>{showPhotographerFields ? 'Photographer' : 'Person or company name'}</label>
        <input id={`${id}-name`} type="text" required value={form.name} onChange={e => onChange({ ...form, name: e.target.value, userId: undefined })} placeholder={showPhotographerFields ? "Search photographer or enter name..." : "Name..."} className={`${styles.field} mt-2`} maxLength={100} onFocus={() => suggestions.length > 0 && setShowSuggestions(true)} />
        {form.userId && <p className={`${styles.help} mt-2`}>Linked to their Folio profile</p>}
        {showSuggestions && suggestions.length > 0 && <div className="absolute z-10 mt-1 w-full rounded-lg border border-folio-border-subtle bg-surface-canvas shadow-lg max-h-40 overflow-y-auto" aria-label="Matching photographers">
          {suggestions.map(user => <button key={user.id} type="button" onClick={() => handleSelectSuggestion(user)} className="w-full min-h-11 text-left px-4 py-3 folio-ui hover:bg-surface-ground focus-visible:ring-2 focus-visible:ring-folio-gold flex items-center gap-2">
            {user.profileImage && <img src={user.profileImage} alt="" className="w-6 h-6 rounded-full object-cover" />}<span>{user.name}</span>
          </button>)}
        </div>}
      </div>
      <label className={styles.label}>Website <span className={styles.help}>Optional</span><input type="url" value={form.url} onChange={e => onChange({ ...form, url: e.target.value })} placeholder="https://…" className={styles.field} /></label>
      {showPhotographerFields && <label className={styles.label}>Instagram <span className={styles.help}>Optional</span><input type="text" value={form.instagram} onChange={e => onChange({ ...form, instagram: e.target.value })} placeholder="@name" className={styles.field} maxLength={100} /></label>}
    </div>
    <div className={styles.sheetFooter}>
      <button type="button" onClick={onCancel} className={styles.secondary}>Cancel</button>
      <button type="submit" disabled={!canSave} className={styles.primary}><Check size={16} aria-hidden />Save credit</button>
    </div>
  </form>;
}
