import { useMemo, useState } from "react";

interface Props {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

export function MultiSelect({ label, options, selected, onChange, placeholder }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
    return base.slice(0, 60);
  }, [options, query]);

  function toggle(option: string) {
    onChange(selected.includes(option) ? selected.filter((s) => s !== option) : [...selected, option]);
  }

  return (
    <div className="field">
      <div className="field-label-row">
        <label className="field-label">{label}</label>
        {selected.length > 0 && (
          <button type="button" className="link-btn" onClick={() => onChange([])}>
            clear ({selected.length})
          </button>
        )}
      </div>
      <input
        type="text"
        className="text-input"
        placeholder={placeholder ?? "Search…"}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {selected.length > 0 && (
        <div className="chips">
          {selected.map((s) => (
            <span className="chip" key={s} onClick={() => toggle(s)} title="Remove">
              {s} ×
            </span>
          ))}
        </div>
      )}
      <div className="option-list">
        {filtered.map((o) => (
          <label className="option-row" key={o}>
            <input type="checkbox" checked={selected.includes(o)} onChange={() => toggle(o)} />
            <span>{o}</span>
          </label>
        ))}
        {filtered.length === 0 && <div className="option-empty">No matches</div>}
      </div>
    </div>
  );
}
