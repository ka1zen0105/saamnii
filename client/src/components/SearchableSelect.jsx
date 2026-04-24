import { useEffect, useId, useMemo, useRef, useState } from "react";

function normalize(v) {
  return String(v ?? "").toLowerCase().trim();
}

function optionHaystack(o) {
  const extra =
    o?.searchText != null && String(o.searchText).trim() !== ""
      ? String(o.searchText)
      : "";
  return normalize(`${o?.label ?? ""} ${o?.value ?? ""} ${extra}`);
}

export function SearchableSelect({
  value,
  onChange,
  options,
  disabled = false,
  placeholder = "Select",
  searchPlaceholder = "Type to filter…",
  emptyMessage = "No options found",
  maxVisible = 18,
}) {
  const inputId = useId();
  const wrapRef = useRef(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const list = Array.isArray(options) ? options : [];
  const selectedOption = list.find((o) => String(o?.value ?? "") === String(value ?? ""));

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return list;
    return list.filter((o) => optionHaystack(o).includes(q));
  }, [list, query]);
  const shown = query ? filtered : list;
  const visibleSuggestions = shown.slice(0, Math.max(4, Number(maxVisible) || 18));

  useEffect(() => {
    function onDocClick(event) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(event.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={wrapRef} className="searchable-select">
      <div className="searchable-select-input-wrap">
        <input
          id={inputId}
          className="searchable-select-input"
          type="text"
          value={open ? query : selectedOption?.label || ""}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={open ? searchPlaceholder : placeholder}
          disabled={disabled}
          autoComplete="off"
          aria-label={searchPlaceholder}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${inputId}-listbox`}
        />
        {query ? (
          <button
            type="button"
            className="searchable-select-clear"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            disabled={disabled}
          >
            x
          </button>
        ) : (
          <button
            type="button"
            className="searchable-select-clear"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close options" : "Open options"}
            disabled={disabled}
          >
            v
          </button>
        )}
      </div>
      {open ? (
        <div
          id={`${inputId}-listbox`}
          className="searchable-select-suggestions"
          role="listbox"
          aria-label="Search results"
        >
          <button
            type="button"
            className={value === "" ? "searchable-select-suggestion is-selected" : "searchable-select-suggestion"}
            onClick={() => {
              onChange("");
              setOpen(false);
              setQuery("");
            }}
          >
            {placeholder}
          </button>
          {visibleSuggestions.length === 0 ? (
            <div className="searchable-select-suggestion-empty">{emptyMessage}</div>
          ) : (
            visibleSuggestions.map((o) => {
              const isSelected = String(o?.value ?? "") === String(value ?? "");
              return (
                <button
                  key={`suggestion-${o.value}-${o.label}`}
                  type="button"
                  className={
                    isSelected
                      ? "searchable-select-suggestion is-selected"
                      : "searchable-select-suggestion"
                  }
                  onClick={() => {
                    onChange(String(o.value ?? ""));
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  {o.label}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

