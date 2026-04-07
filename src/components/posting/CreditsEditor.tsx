"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Plus, Pencil, Trash2, Check, X, Lock } from "lucide-react";
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-folio-text-primary uppercase tracking-wider">
          Credits
        </h3>
        {saving && (
          <span className="text-xs text-folio-text-secondary">Saving...</span>
        )}
      </div>

      {/* Credit list */}
      <div className="space-y-2">
        {credits.map((credit, idx) => {
          const locked = isDesigner(credit);
          const isEditing = editingIndex === idx;

          if (isEditing) {
            return (
              <CreditForm
                key={idx}
                form={form}
                onChange={setForm}
                onSave={handleSave}
                onCancel={handleCancel}
                canSave={canSaveForm}
              />
            );
          }

          return (
            <div
              key={idx}
              className="flex items-center justify-between gap-3 rounded-lg border border-folio-border-subtle px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-folio-text-primary shrink-0">
                  {credit.role}:
                </span>
                <span className="text-folio-text-secondary truncate">
                  {credit.name}
                </span>
                {credit.url && (
                  <a
                    href={credit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] text-xs hover:underline shrink-0"
                  >
                    link
                  </a>
                )}
                {credit.instagram && (
                  <span className="text-folio-text-tertiary text-xs shrink-0">
                    @{credit.instagram.replace(/^@/, "")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {locked ? (
                  <Lock className="w-3.5 h-3.5 text-folio-text-tertiary" />
                ) : (
                  <>
                    <button
                      onClick={() => handleEdit(idx)}
                      className="p-1 rounded hover:bg-surface-ground text-folio-text-secondary hover:text-folio-text-primary transition-colors"
                      title="Edit credit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleRemove(idx)}
                      className="p-1 rounded hover:bg-red-50 text-folio-text-secondary hover:text-red-600 transition-colors"
                      title="Remove credit"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add form */}
      {adding && (
        <CreditForm
          form={form}
          onChange={setForm}
          onSave={handleSave}
          onCancel={handleCancel}
          canSave={canSaveForm}
        />
      )}

      {/* Add button */}
      {!adding && editingIndex === null && (
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Credit
        </button>
      )}
    </div>
  );
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

  return (
    <div className="rounded-lg border border-[var(--accent)]/30 bg-surface-ground p-3 space-y-2">
      <div className="flex gap-2">
        <select
          value={form.role}
          onChange={(e) => onChange({ ...form, role: e.target.value, customRole: "", instagram: "", userId: undefined })}
          className="flex-1 rounded-md border border-folio-border-subtle bg-surface-canvas px-2 py-1.5 text-sm text-folio-text-primary focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        >
          <option value="">Select role...</option>
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        {form.role === "Other" && (
          <input
            type="text"
            value={form.customRole}
            onChange={(e) => onChange({ ...form, customRole: e.target.value })}
            placeholder="Custom role..."
            className="flex-1 rounded-md border border-folio-border-subtle bg-surface-canvas px-2 py-1.5 text-sm text-folio-text-primary placeholder:text-folio-text-tertiary focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            maxLength={60}
          />
        )}
      </div>

      {/* Name field with typeahead for photographers */}
      <div className="relative" ref={suggestionsRef}>
        <input
          type="text"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value, userId: undefined })}
          placeholder={showPhotographerFields ? "Search photographer or enter name..." : "Name..."}
          className="w-full rounded-md border border-folio-border-subtle bg-surface-canvas px-2 py-1.5 text-sm text-folio-text-primary placeholder:text-folio-text-tertiary focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          maxLength={100}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        />
        {form.userId && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-green-600 font-medium">
            Linked
          </span>
        )}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-md border border-folio-border-subtle bg-surface-canvas shadow-lg max-h-40 overflow-y-auto">
            {suggestions.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelectSuggestion(user)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-ground transition-colors flex items-center gap-2"
              >
                {user.profileImage && (
                  <img src={user.profileImage} alt="" className="w-5 h-5 rounded-full object-cover" />
                )}
                <span className="text-folio-text-primary">{user.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <input
        type="url"
        value={form.url}
        onChange={(e) => onChange({ ...form, url: e.target.value })}
        placeholder="Website URL (optional)"
        className="w-full rounded-md border border-folio-border-subtle bg-surface-canvas px-2 py-1.5 text-sm text-folio-text-primary placeholder:text-folio-text-tertiary focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
      />

      {/* Instagram field — shown for Photographer role */}
      {showPhotographerFields && (
        <input
          type="text"
          value={form.instagram}
          onChange={(e) => onChange({ ...form, instagram: e.target.value })}
          placeholder="Instagram handle (optional)"
          className="w-full rounded-md border border-folio-border-subtle bg-surface-canvas px-2 py-1.5 text-sm text-folio-text-primary placeholder:text-folio-text-tertiary focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          maxLength={100}
        />
      )}

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-2 py-1 text-xs text-folio-text-secondary hover:text-folio-text-primary transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={!canSave}
          className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-[var(--accent)] rounded-md hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
          Save
        </button>
      </div>
    </div>
  );
}
