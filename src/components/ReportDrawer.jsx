import React, { useState } from "react";
import { X, ShieldAlert } from "lucide-react";
import { C } from "../theme.js";
import { peso, fmtDate, fmtTime } from "../data/geoData.js";
import { useTrafficData } from "../context/TrafficDataContext.jsx";

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

export const REPORT_STATUS_TONE = {
  pending: { bg: C.accentSoft, fg: C.accentDark },
  under_review: { bg: C.infoSoft, fg: C.infoDark },
  resolved: { bg: C.successSoft, fg: C.successDark },
  dismissed: { bg: C.dangerSoft, fg: C.dangerDark },
};

export default function ReportDrawer({ report, adminName, onClose }) {
  const { updateReport } = useTrafficData();
  const [notes, setNotes] = useState(report?.adminNotes || "");
  const [saving, setSaving] = useState(null);

  if (!report) return null;
  const tone = REPORT_STATUS_TONE[report.status] || REPORT_STATUS_TONE.pending;

  const setStatus = async (status) => {
    setSaving(status);
    await updateReport(report.id, { status, adminNotes: notes, reviewedBy: adminName });
    setSaving(null);
  };

  const saveNotesOnly = async () => {
    setSaving("notes");
    await updateReport(report.id, { adminNotes: notes });
    setSaving(null);
  };

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: 420, background: C.surface,
      borderLeft: `1px solid ${C.line}`, boxShadow: "-8px 0 24px rgba(20,30,25,0.08)",
      zIndex: 40, overflowY: "auto",
    }} className="et-drawer">
      <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div className="et-mono" style={{ fontSize: 11, color: C.inkFaint, marginBottom: 4 }}>{report.id}</div>
          <div className="et-display" style={{ fontSize: 19, fontWeight: 600 }}>{report.category}</div>
        </div>
        <button className="et-btn" onClick={onClose} style={{ background: "transparent", padding: 6, borderRadius: 6, color: C.inkSoft }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start",
          padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700,
          background: tone.bg, color: tone.fg,
        }}>
          <ShieldAlert size={13} /> {report.statusLabel}
        </span>

        <Section title="Report">
          <Row k="Category" v={report.category} />
          <Row k="Submitted" v={`${fmtDate(new Date(report.createdAt))}, ${fmtTime(new Date(report.createdAt))}`} />
          {report.contactInfo && <Row k="Contact" v={report.contactInfo} />}
        </Section>

        <Section title="Description">
          <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{report.description}</div>
        </Section>

        <Section title="Related citation">
          <Row k="Ticket no." v={report.ticket} mono />
          <Row k="Motorist" v={report.motorist} />
          {report.citationStatus && <Row k="Citation status" v={report.citationStatus} />}
          {report.citationFine != null && <Row k="Fine amount" v={peso(report.citationFine)} bold />}
        </Section>

        <Section title="Enforcer">
          <Row k="Name" v={report.enforcer?.name || "—"} />
          <Row k="Badge no." v={report.enforcer?.badge || "—"} mono />
        </Section>

        {report.reviewedBy && (
          <Section title="Review history">
            <Row k="Reviewed by" v={report.reviewedBy} />
            <Row k="Reviewed at" v={report.reviewedAt ? `${fmtDate(new Date(report.reviewedAt))}, ${fmtTime(new Date(report.reviewedAt))}` : "—"} />
          </Section>
        )}

        <Section title="Admin notes">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Internal notes about this report (not visible to the motorist)."
            rows={4}
            style={{
              width: "100%", padding: "10px 11px", border: `1px solid ${C.line}`, borderRadius: 8,
              fontSize: 12.5, color: C.ink, fontFamily: "inherit", resize: "vertical",
            }}
          />
          <button
            className="et-btn" onClick={saveNotesOnly} disabled={saving === "notes"}
            style={{ alignSelf: "flex-start", padding: "7px 12px", borderRadius: 7, border: `1px solid ${C.line}`, background: C.surface, color: C.inkSoft, fontSize: 12, fontWeight: 600 }}
          >
            {saving === "notes" ? "Saving..." : "Save notes"}
          </button>
        </Section>

        <Section title="Actions">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              className="et-btn" disabled={saving === "under_review"} onClick={() => setStatus("under_review")}
              style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: C.infoSoft, color: C.infoDark, fontWeight: 700, fontSize: 12.5 }}
            >
              Mark Under Review
            </button>
            <button
              className="et-btn" disabled={saving === "resolved"} onClick={() => setStatus("resolved")}
              style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: C.successSoft, color: C.successDark, fontWeight: 700, fontSize: 12.5 }}
            >
              Mark Resolved
            </button>
            <button
              className="et-btn" disabled={saving === "dismissed"} onClick={() => setStatus("dismissed")}
              style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: C.dangerSoft, color: C.danger, fontWeight: 700, fontSize: 12.5 }}
            >
              Dismiss
            </button>
          </div>
          <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 4 }}>
            Marking a status does not apply disciplinary action automatically - it only records this report's review outcome.
          </div>
        </Section>
      </div>
    </div>
  );
}