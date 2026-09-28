import React, { useMemo, useState } from "react";
import { Search, Eye, FileWarning, Clock3, Eye as EyeIcon, CheckCircle2, XCircle } from "lucide-react";
import { C, cellStyle } from "../theme.js";
import { fmtDate } from "../data/geoData.js";
import PageHeader from "../components/PageHeader.jsx";
import Panel from "../components/Panel.jsx";
import TicketStat from "../components/TicketStat.jsx";
import { useTrafficData } from "../context/TrafficDataContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import ReportDrawer, { REPORT_STATUS_TONE } from "../components/ReportDrawer.jsx";

const CATEGORIES = [
  "Unprofessional behavior",
  "Incorrect citation information",
  "Request for clarification",
  "Suspected improper conduct",
  "Other",
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "under_review", label: "Under Review" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

const input = {
  width: "100%", height: 36, padding: "0 10px",
  border: `1px solid ${C.line}`, borderRadius: 8,
  fontSize: 12, background: C.surface, color: C.ink,
};

function StatusPill({ status, label }) {
  const tone = REPORT_STATUS_TONE[status] || REPORT_STATUS_TONE.pending;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 999,
      fontSize: 11.5, fontWeight: 700, background: tone.bg, color: tone.fg, whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

export default function EnforcerReportsView() {
  const { reports, reportsLoading, reportsError } = useTrafficData();
  const { profile } = useAuth();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All");
  const [date, setDate] = useState("");
  const [open, setOpen] = useState(null);

  const counts = useMemo(() => ({
    total: reports.length,
    pending: reports.filter(r => r.status === "pending").length,
    under_review: reports.filter(r => r.status === "under_review").length,
    resolved: reports.filter(r => r.status === "resolved").length,
    dismissed: reports.filter(r => r.status === "dismissed").length,
  }), [reports]);

  const filtered = useMemo(() => reports.filter(r => {
    const text = `${r.ticket} ${r.enforcer?.name || ""} ${r.enforcer?.badge || ""}`.toLowerCase();
    const matchesQuery = !query || text.includes(query.toLowerCase());
    const matchesCategory = category === "All" || r.category === category;
    const matchesStatus = status === "All" || r.status === status;
    const matchesDate = !date || (r.createdAt && r.createdAt.slice(0, 10) === date);
    return matchesQuery && matchesCategory && matchesStatus && matchesDate;
  }), [reports, query, category, status, date]);

  return (
    <div className="et-fade-in">
      <PageHeader
        title="Enforcer reports"
        subtitle="Complaints and reports submitted by motorists through the Motorist Portal"
      />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <TicketStat icon={FileWarning} label="Total reports" value={counts.total} tone="accent" />
        <TicketStat icon={Clock3} label="Pending" value={counts.pending} tone="accent" />
        <TicketStat icon={EyeIcon} label="Under review" value={counts.under_review} tone="info" />
        <TicketStat icon={CheckCircle2} label="Resolved" value={counts.resolved} tone="success" />
        <TicketStat icon={XCircle} label="Dismissed" value={counts.dismissed} tone="danger" />
      </div>

      <Panel title={`Reports (${filtered.length})`}>
        <div style={{ display: "flex", gap: 9, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 240px" }}>
            <Search size={14} color={C.inkFaint} style={{ position: "absolute", left: 10, top: 11 }} />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search ticket number or enforcer..."
              style={{ ...input, paddingLeft: 31 }} />
          </div>
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...input, width: 200 }}>
            <option value="All">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...input, width: 160 }}>
            <option value="All">All statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...input, width: 150 }} />
        </div>

        {reportsError && (
          <div style={{ padding: "10px 12px", marginBottom: 12, borderRadius: 8, background: C.dangerSoft, color: C.danger, fontSize: 12.5 }}>
            Couldn't load reports: {reportsError}
          </div>
        )}

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Report ID", "Ticket No.", "Enforcer", "Category", "Submitted", "Status", "Actions"].map(h => (
                  <th key={h} style={{ textAlign: "left", fontSize: 10.5, color: C.inkFaint, fontWeight: 700, padding: "8px 10px", borderBottom: `1px solid ${C.line}`, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reportsLoading && (
                <tr><td colSpan={7} style={{ padding: 28, textAlign: "center", color: C.inkFaint }}>Loading reports...</td></tr>
              )}
              {!reportsLoading && filtered.map(r => (
                <tr key={r.id} className="et-row">
                  <td style={cellStyle}><span className="et-mono" style={{ fontSize: 11 }}>{r.id.slice(0, 8)}</span></td>
                  <td style={cellStyle}><span className="et-mono">{r.ticket}</span></td>
                  <td style={cellStyle}>{r.enforcer ? `${r.enforcer.name} (${r.enforcer.badge})` : "—"}</td>
                  <td style={cellStyle}>{r.category}</td>
                  <td style={cellStyle}>{fmtDate(new Date(r.createdAt))}</td>
                  <td style={cellStyle}><StatusPill status={r.status} label={r.statusLabel} /></td>
                  <td style={cellStyle}>
                    <button className="et-btn" title="View details" onClick={() => setOpen(r)}
                      style={{ padding: 6, borderRadius: 6, background: C.accentSoft, color: C.accentDark }}>
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {!reportsLoading && !filtered.length && (
                <tr><td colSpan={7} style={{ padding: 28, textAlign: "center", color: C.inkFaint }}>No reports match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {open && (
        <>
          <div onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, background: "rgba(10,20,15,0.15)", zIndex: 30 }} />
          <ReportDrawer report={open} adminName={profile?.name || "Administrator"} onClose={() => setOpen(null)} />
        </>
      )}
    </div>
  );
}