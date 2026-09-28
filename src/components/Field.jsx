import React from "react";
import { C } from "../theme.js";

export default function Field({ label, value, onChange, placeholder, grow, width }) {
  return (
    <div style={{ flex: grow ? "1 1 220px" : "0 0 auto" }}>
      <div style={{ fontSize: 11, color: C.inkFaint, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <input
        value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: width || "100%", padding: "8px 10px", borderRadius: 7, border: `1px solid ${C.line}`, fontSize: 13 }}
      />
    </div>
  );
}
