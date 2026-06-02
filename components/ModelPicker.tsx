"use client";

import { MODEL_OPTIONS, type ModelKey } from "@/lib/model-options";

interface Props {
  selected: ModelKey;
  onSelect: (key: ModelKey) => void;
}

export default function ModelPicker({ selected, onSelect }: Props) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium text-gray-500">Image model (via OpenRouter)</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {MODEL_OPTIONS.map((m) => {
          const active = selected === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => onSelect(m.key)}
              className={`rounded-lg border px-3 py-2 text-left transition ${
                active
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-black/10 bg-white text-gray-700 hover:border-black/30"
              }`}
            >
              <span className="block text-sm font-semibold">{m.label}</span>
              <span className={`block text-[11px] ${active ? "text-gray-300" : "text-gray-400"}`}>
                {m.sub}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
