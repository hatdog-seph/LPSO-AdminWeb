import React from "react";
import { ArrowUpRight } from "lucide-react";
import { C } from "../theme.js";

export default function Panel({ title, action, children }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h3 className="et-display" style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{title}</h3>
        {action && (
          <button className="et-btn" onClick={action.onClick} style={{ background: "transparent", color: C.accentDark, fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            {action.label} <ArrowUpRight size={13} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
