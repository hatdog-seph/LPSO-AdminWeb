import React from "react";
import { statusColors } from "../data/geoData.js";

export default function StatusPill({ status }) {
  const sc = statusColors(status);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
      color: sc.fg, background: sc.bg, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: sc.dot }} />
      {status}
    </span>
  );
}
