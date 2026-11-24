import React from "react";
import { ordinal } from "../utils/offenses.js";

/** small pill: amber for repeat offenses, quiet grey for a first offense */
export default function OffenseBadge({ level, quiet = false }) {
  if (!level) return <span style={{ color: "#94A3B8" }}>-</span>;
  const repeat = level > 1;
  if (!repeat && quiet) return <span style={{ fontSize: 11.5, color: "#64748B" }}>1st</span>;
  return (
    <span style={{
      display: "inline-block", fontSize: 11.5, fontWeight: 700, padding: "2px 9px", borderRadius: 999, whiteSpace: "nowrap",
      background: repeat ? (level >= 3 ? "#F8E2DE" : "#FDF1D6") : "#EEF2F7",
      color: repeat ? (level >= 3 ? "#7A271E" : "#7A4B00") : "#475569",
    }}>
      {ordinal(level)} offense
    </span>
  );
}
