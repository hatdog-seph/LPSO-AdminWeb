import React from "react";
import { ChevronDown } from "lucide-react";
import { C } from "../theme.js";

export default function Select({ value, onChange, options, labels }) {
  return (
    <div style={{ position: "relative" }}>
      <select
        value={value} onChange={e => onChange(e.target.value)}
        style={{
          appearance: "none", padding: "8px 30px 8px 12px", borderRadius: 8, border: `1px solid ${C.line}`,
          fontSize: 13, background: C.surface, color: C.ink, cursor: "pointer",
        }}
      >
        {options.map(o => <option key={o} value={o}>{labels?.[o] || o}</option>)}
      </select>
      <ChevronDown size={13} color={C.inkFaint} style={{ position: "absolute", right: 10, top: 10, pointerEvents: "none" }} />
    </div>
  );
}
