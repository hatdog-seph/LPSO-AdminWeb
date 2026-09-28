import React from "react";
import { Radio } from "lucide-react";
import { C } from "../theme.js";

export default function PageHeader({ title, subtitle, live, actions }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
      <div>
        <h1 className="et-display" style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>{title}</h1>
        <p style={{ fontSize: 13, color: C.inkSoft, margin: "4px 0 0" }}>{subtitle}</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {actions}
        {live && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.successDark, fontWeight: 600 }}>
            <Radio size={13} className="et-scan-line" />
            Live monitoring
          </div>
        )}
      </div>
    </div>
  );
}