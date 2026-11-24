import React, { useMemo } from "react";
import { X } from "lucide-react";
import { C } from "../theme.js";
import { peso } from "../data/geoData.js";
import StatusPill from "./StatusPill.jsx";
import OffenseBadge from "./OffenseBadge.jsx";
import { useTrafficData } from "../context/TrafficDataContext.jsx";
import { computeOffenses, historyFor, ordinal } from "../utils/offenses.js";

const PAID = new Set(["Paid", "Settled", "Voided"]);

function Stat({ label, value }) {
  return (
    <div style={{ background: C.surfaceSunk, borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: C.inkSoft }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}

export default function MotoristProfileDrawer({ citation, onClose }) {
  const { citations = [] } = useTrafficData();
  const offenses = useMemo(() => computeOffenses(citations), [citations]);
  const history = useMemo(() => (citation ? historyFor(citation, citations) : []), [citation, citations]);
  if (!citation) return null;

  const maxLevel = history.reduce((m, c) => Math.max(m, offenses.get(c.id)?.level || 1), 1);
  const unpaid = history.filter((c) => !PAID.has(c.status)).reduce((s, c) => s + Number(c.amount ?? c.fine ?? 0), 0);

  return (
    <div className="et-drawer" style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: "min(440px, 100vw)", background: C.surface,
      borderLeft: `1px solid ${C.line}`, boxShadow: "-8px 0 24px rgba(20,30,25,0.08)", zIndex: 40, overflowY: "auto",
    }}>
      <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: C.inkFaint, marginBottom: 4 }}>MOTORIST PROFILE</div>
          <div className="et-display" style={{ fontSize: 19, fontWeight: 600 }}>{citation.motorist || "Unknown Motorist"}</div>
          <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 4 }}>
            {citation.license ? `License ${citation.license}` : "No license on record"}
            {(citation.plateNumber || citation.vehicle?.plate) ? ` | Plate ${citation.plateNumber || citation.vehicle?.plate}` : ""}
          </div>
          <div style={{ marginTop: 8 }}><OffenseBadge level={maxLevel} quiet /></div>
        </div>
        <button className="et-btn" onClick={onClose} aria-label="Close" style={{ background: "transparent", padding: 6, borderRadius: 6, color: C.inkSoft, alignSelf: "flex-start" }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Stat label="Total citations" value={history.length} />
          <Stat label="Highest offense level" value={ordinal(maxLevel)} />
          <Stat label="Unpaid amount" value={peso(unpaid)} />
          <Stat label="Next violation would be" value={`${ordinal(maxLevel + 1)} offense`} />
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Offense history</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {history.map((c, i) => {
              const info = offenses.get(c.id);
              const last = i === history.length - 1;
              const when = String(c.issuedAt || c.date || "").slice(0, 10);
              return (
                <div key={c.id} style={{ display: "flex", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: 11, height: 11, borderRadius: 999, marginTop: 5, background: (info?.level || 1) > 1 ? "#D99A00" : C.success }} />
                    {!last && <div style={{ width: 2, flexGrow: 1, background: C.line }} />}
                  </div>
                  <div style={{ paddingBottom: last ? 0 : 16, flexGrow: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{c.violation || "Violation"}</span>
                      <StatusPill status={c.status || "Pending"} />
                    </div>
                    <div style={{ marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {info
                        ? info.items.map((it) => <OffenseBadge key={it.key} level={it.level} quiet={false} />)
                        : <span style={{ fontSize: 11.5, color: C.inkFaint }}>Not counted (voided)</span>}
                    </div>
                    <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 4 }}>
                      {c.ticket || c.id} | {when || "no date"} | {c.barangay?.name || c.zone || "Libmanan"} | {peso(c.amount ?? c.fine)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 11.5, color: C.inkFaint, lineHeight: 1.5, marginTop: 14 }}>
            Offense numbers count earlier citations of the same violation for this motorist or plate number. Voided citations are not counted.
          </p>
        </div>
      </div>
    </div>
  );
}
