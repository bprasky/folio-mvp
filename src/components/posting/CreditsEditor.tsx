"use client";

import { useState, useCallback } from "react";
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
 * --- Future: Super Articles (see docs/15_SUPER_ARTICLES.md) ---
 * - Each credited party may eventually contribute their own interview answers
 *   via CreditEntry.userId linking to their InterviewSession.
 * - A Folio user search field will replace the free-text name input for linked users.
 * - contributionStatus tracking (invited / contributed / declined) will be added.
 */

interface CreditsEditorProps {
  credits: CreditEntry[];
  onChange: (credits: CreditEntry[]) => void;
  designerName?: string;
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
};

const emptyForm: EditingCredit = { role: "", customRole: "", name: "", url: "" };

export function CreditsEditor({ credits, onChange, designerName, saving }: CreditsEditorProps) {
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
        <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">
          Credits
        </h3>
        {saving && (
          <span className="text-xs text-[var(--text-secondary)]">Saving...</span>
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
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--ridge-outer)] px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-[var(--text-primary)] shrink-0">
                  {credit.role}:
                </span>
                <span className="text-[var(--text-secondary)] truncate">
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
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {locked ? (
                  <Lock className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                ) : (
                  <>
                    <button
                      onClick={() => handleEdit(idx)}
                      className="p-1 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                      title="Edit credit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleRemove(idx)}
                      className="p-1 rounded hover:bg-red-50 text-[var(--text-secondary)] hover:text-red-600 transition-colors"
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
  return (
    <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--bg-elevated)] p-3 space-y-2">
      <div className="flex gap-2">
        <select
          value={form.role}
          onChange={(e) => onChange({ ...form, role: e.target.value, customRole: "" })}
          className="flex-1 rounded-md border border-[var(--ridge-outer)] bg-white px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
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
            className="flex-1 rounded-md border border-[var(--ridge-outer)] bg-white px-2 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            maxLength={60}
          />
        )}
      </div>
      <input
        type="text"
        value={form.name}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
        placeholder="Name..."
        className="w-full rounded-md border border-[var(--ridge-outer)] bg-white px-2 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        maxLength={100}
      />
      <input
        type="url"
        value={form.url}
        onChange={(e) => onChange({ ...form, url: e.target.value })}
        placeholder="Website URL (optional)"
        className="w-full rounded-md border border-[var(--ridge-outer)] bg-white px-2 py-1.5 text-sm text-[var(--text-tertiary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
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
