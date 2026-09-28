import React from "react";
import { C } from "../theme.js";

export default function TicketStat({ icon: Icon, label, value, sub, tone = "accent" }) {
  const tones = {
    accent: { bg: C.accentSoft, fg: C.accentDark },
    success: { bg: C.successSoft, fg: C.successDark },
    danger: { bg: C.dangerSoft, fg: C.dangerDark },
    info: { bg: C.infoSoft, fg: C.infoDark },
  }[tone];
  return (
    <div style={{
      position: "relative", background: C.surface, border: `1px solid ${C.line}`,
      borderRadius: 10, padding: "16px 18px", flex: 1, minWidth: 190,
      backgroundImage: `radial-gradient(circle at 0 50%, ${C.bg} 5px, transparent 5.5px), radial-gradient(circle at 100% 50%, ${C.bg} 5px, transparent 5.5px)`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: C.inkSoft, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: tones.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={14} color={tones.fg} />
        </div>
      </div>
      <div className="et-display" style={{ fontSize: 26, fontWeight: 600, color: C.ink, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.inkFaint, marginTop: 6 }}>{sub}</div>}
      <div style={{
        position: "absolute", left: 14, right: 14, bottom: 0, height: 0,
        borderTop: `1.5px dashed ${C.line}`,
      }} />
    </div>
  );
}
