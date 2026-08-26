"use client";

import { useEntity } from "@/lib/context/EntityContext";
import { cn } from "@/lib/format";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, type ReactNode } from "react";

export type FieldKind = "text" | "number" | "date" | "select";

export type FieldSpec = {
  key: string;
  label: string;
  kind?: FieldKind;
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  step?: string;
  /** Shown under the input to explain a non-obvious field. */
  hint?: string;
};

type Values = Record<string, string | number | boolean>;

const inputClass =
  "w-full rounded-xl border border-wl-border bg-wl-surface-2 px-3 py-2.5 text-sm text-wl-text outline-none focus:border-wl-primary/50";

function Form({
  fields,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  fields: FieldSpec[];
  initial?: Values;
  submitLabel: string;
  onSubmit: (values: Values) => Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Values>(() => {
    const seed: Values = {};
    for (const f of fields) {
      const existing = initial?.[f.key];
      seed[f.key] =
        existing !== undefined && existing !== null
          ? f.kind === "date"
            ? String(existing).slice(0, 10)
            : (existing as string | number)
          : f.kind === "select"
            ? (f.options?.[0]?.value ?? "")
            : "";
    }
    return seed;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handle} className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => (
        <label key={f.key} className="block space-y-1.5 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-wl-muted">{f.label}</span>
          {f.kind === "select" ? (
            <select
              value={String(values[f.key] ?? "")}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className={inputClass}
            >
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={f.kind === "number" ? "number" : f.kind === "date" ? "date" : "text"}
              step={f.step ?? (f.kind === "number" ? "0.01" : undefined)}
              required={f.required ?? true}
              placeholder={f.placeholder}
              value={String(values[f.key] ?? "")}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className={inputClass}
            />
          )}
          {f.hint && <span className="block text-[11px] text-wl-muted">{f.hint}</span>}
        </label>
      ))}

      {error && <p className="text-sm text-wl-danger sm:col-span-2">{error}</p>}

      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-gradient-to-r from-wl-primary to-wl-secondary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-wl-border px-5 py-2.5 text-sm font-semibold text-wl-muted hover:text-wl-text"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * Wraps a list surface with add / edit / delete against the resource API,
 * refreshing the shared snapshot so every other page follows the change.
 */
export function RecordManager<T extends { id: string }>({
  title,
  addLabel,
  fields,
  items,
  api,
  toValues,
  toPayload,
  renderItem,
  emptyMessage,
}: {
  title: string;
  addLabel: string;
  fields: FieldSpec[];
  items: T[];
  api: {
    create: (entityId: string, body: never) => Promise<unknown>;
    update: (entityId: string, id: string, body: never) => Promise<unknown>;
    remove: (entityId: string, id: string) => Promise<unknown>;
  };
  toValues: (item: T) => Values;
  toPayload: (values: Values) => unknown;
  renderItem: (item: T, controls: ReactNode) => ReactNode;
  emptyMessage: string;
}) {
  const { entityId, refresh } = useEntity();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onDelete(id: string) {
    setError(null);
    try {
      await api.remove(entityId, id);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setPendingDelete(null);
    }
  }

  const controlsFor = (item: T) => (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        aria-label={`Edit ${title}`}
        onClick={() => {
          setEditingId(item.id === editingId ? null : item.id);
          setAdding(false);
        }}
        className="rounded-lg border border-wl-border p-1.5 text-wl-muted hover:text-wl-text"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      {pendingDelete === item.id ? (
        <>
          <button
            type="button"
            onClick={() => void onDelete(item.id)}
            className="rounded-lg bg-wl-danger/15 px-2 py-1.5 text-[11px] font-semibold text-wl-danger"
          >
            Confirm
          </button>
          <button
            type="button"
            aria-label="Cancel delete"
            onClick={() => setPendingDelete(null)}
            className="rounded-lg border border-wl-border p-1.5 text-wl-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <button
          type="button"
          aria-label={`Delete ${title}`}
          onClick={() => setPendingDelete(item.id)}
          className="rounded-lg border border-wl-border p-1.5 text-wl-muted hover:text-wl-danger"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <button
          type="button"
          onClick={() => {
            setAdding((v) => !v);
            setEditingId(null);
          }}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-colors",
            adding
              ? "border-wl-border text-wl-muted"
              : "border-wl-primary/40 text-wl-text hover:bg-wl-primary/10",
          )}
        >
          {adding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {adding ? "Cancel" : addLabel}
        </button>
      </div>

      {error && <p className="text-sm text-wl-danger">{error}</p>}

      {adding && (
        <section className="wl-card p-5">
          <Form
            fields={fields}
            submitLabel="Add"
            onCancel={() => setAdding(false)}
            onSubmit={async (values) => {
              await api.create(entityId, toPayload(values) as never);
              setAdding(false);
              refresh();
            }}
          />
        </section>
      )}

      {items.length === 0 && !adding && (
        <p className="rounded-xl border border-dashed border-wl-border px-4 py-10 text-center text-sm text-wl-muted">
          {emptyMessage}
        </p>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id}>
            {renderItem(item, controlsFor(item))}
            {editingId === item.id && (
              <section className="wl-card mt-2 p-5">
                <Form
                  fields={fields}
                  initial={toValues(item)}
                  submitLabel="Save changes"
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (values) => {
                    await api.update(entityId, item.id, toPayload(values) as never);
                    setEditingId(null);
                    refresh();
                  }}
                />
              </section>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
