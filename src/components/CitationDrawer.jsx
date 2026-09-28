import React from "react";
import { X, QrCode } from "lucide-react";
import { C } from "../theme.js";
import { peso, fmtDate, fmtTime, statusColors } from "../data/geoData.js";
import StatusPill from "./StatusPill.jsx";
import SyncBadge from "./SyncBadge.jsx";

function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>{children}</div>
    </div>
  );
}

function Row({ k, v, mono, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
      <span style={{ color: C.inkSoft }}>{k}</span>
      <span className={mono ? "et-mono" : ""} style={{ color: C.ink, fontWeight: bold ? 700 : 500, textAlign: "right" }}>{v}</span>
    </div>
  );
}

export default function CitationDrawer({ citation, onClose }) {
  if (!citation) return null;
  const sc = statusColors(citation.status);
  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: 400, background: C.surface,
      borderLeft: `1px solid ${C.line}`, boxShadow: "-8px 0 24px rgba(20,30,25,0.08)",
      zIndex: 40, overflowY: "auto",
    }} className="et-drawer">
      <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div className="et-mono" style={{ fontSize: 11, color: C.inkFaint, marginBottom: 4 }}>{citation.id}</div>
          <div className="et-display" style={{ fontSize: 19, fontWeight: 600 }}>{citation.ticket || citation.id}</div>
        </div>
        <button className="et-btn" onClick={onClose} style={{ background: "transparent", padding: 6, borderRadius: 6, color: C.inkSoft }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <StatusPill status={citation.status} />
          <SyncBadge synced={citation.synced !== false} />
        </div>

        <Section title="Motorist & vehicle">
          <Row k="Motorist" v={citation.motorist} />
          <Row k="Driver's license" v={citation.license || "—"} />
          <Row k="Vehicle" v={citation.vehicle?.type || "—"} />
          <Row k="Plate no." v={citation.vehicle?.plate || citation.plateNumber || "—"} mono />
        </Section>

        <Section title="Violation">
          <Row k="Ordinance" v={citation.ordinance?.code || "—"} mono />
          <Row k="Description" v={citation.ordinance?.desc || citation.violation || "—"} />
          <Row k="Category" v={citation.ordinance?.category || "Traffic"} />
          <Row k="Fine" v={peso(citation.amount)} bold />
        </Section>

        <Section title="Location">
          <Row k="Barangay" v={citation.barangay?.name || citation.zone || "—"} />
        </Section>

        <Section title="Enforcement">
          <Row k="Issued by" v={citation.enforcer ? `${citation.enforcer.name || citation.officer || "—"}${citation.enforcer.badge ? ` (${citation.enforcer.badge})` : ""}` : (citation.officer || "—")} />
          <Row k="Issued at" v={(() => { const d = citation.issuedAt instanceof Date ? citation.issuedAt : new Date(citation.issuedAt || `${citation.date || ""}T${citation.time || "00:00"}`); return Number.isNaN(d.getTime()) ? `${citation.date || "—"} ${citation.time || ""}` : `${fmtDate(d)}, ${fmtTime(d)}`; })()} />
        </Section>

        {citation.payment && (
          <Section title="Payment">
            <Row k="Reference no." v={citation.payment.ref} mono />
            <Row k="Method" v={citation.payment.method} />
            <Row k="Verified by" v={citation.payment.verifiedBy} />
            <Row k="Settled" v={fmtDate(citation.payment.settledAt)} />
          </Section>
        )}

        <div style={{
          border: `1px dashed ${C.lineStrong}`, borderRadius: 10, padding: 14,
          display: "flex", alignItems: "center", gap: 12, background: C.surfaceSunk,
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: C.surface, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <QrCode size={22} color={C.inkSoft} />
          </div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>QR citation portal</div>
            <div style={{ fontSize: 11.5, color: C.inkFaint }}>Motorist-facing tracking link (Objective 3)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
