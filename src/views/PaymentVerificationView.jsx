import React, { useMemo, useState } from "react";
import { Search, Eye, Wallet, Clock3, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { C, cellStyle } from "../theme.js";
import { peso, fmtDate } from "../data/geoData.js";
import PageHeader from "../components/PageHeader.jsx";
import Panel from "../components/Panel.jsx";
import TicketStat from "../components/TicketStat.jsx";
import { useTrafficData } from "../context/TrafficDataContext.jsx";
import PaymentDrawer, { PAYMENT_STATUS_TONE } from "../components/PaymentDrawer.jsx";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "expired", label: "Expired" },
  { value: "refunded", label: "Refunded" },
];

const input = {
  width: "100%", height: 36, padding: "0 10px",
  border: `1px solid ${C.line}`, borderRadius: 8,
  fontSize: 12, background: C.surface, color: C.ink,
};

function StatusPill({ status, label }) {
  const tone = PAYMENT_STATUS_TONE[status] || PAYMENT_STATUS_TONE.pending;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 999,
      fontSize: 11.5, fontWeight: 700, background: tone.bg, color: tone.fg, whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

export default function PaymentVerificationView({ goTab }) {
  const { payments, paymentsLoading, paymentsError, refreshAllPendingPayments } = useTrafficData();

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [open, setOpen] = useState(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [refreshAllMsg, setRefreshAllMsg] = useState("");

  const pendingQrphCount = useMemo(
    () => payments.filter(p => p.source === "qrph" && p.status === "pending").length,
    [payments],
  );

  const handleRefreshAll = async () => {
    setRefreshingAll(true);
    setRefreshAllMsg("");
    const result = await refreshAllPendingPayments();
    setRefreshingAll(false);
    if (!result.checked) {
      setRefreshAllMsg("No pending QR Ph payments to check.");
      return;
    }
    setRefreshAllMsg(
      `Checked ${result.checked} pending payment${result.checked === 1 ? "" : "s"} with PayMongo` +
      (result.updated ? ` — ${result.updated} updated.` : " — no changes.") +
      (result.errors ? ` (${result.errors} could not be checked.)` : "")
    );
  };

  const counts = useMemo(() => {
    const paidPayments = payments.filter(p => p.status === "paid");
    return {
      total: payments.length,
      pending: payments.filter(p => p.status === "pending").length,
      paid: paidPayments.length,
      failedOrExpired: payments.filter(p => p.status === "failed" || p.status === "expired").length,
      // Summed only from rows this system has itself marked "paid" - either
      // by a verified PayMongo webhook/status check, or by an explicit,
      // audited manual verification. Never from a frontend claim.
      verifiedAmount: paidPayments.reduce((sum, p) => sum + p.amount, 0),
    };
  }, [payments]);

  const filtered = useMemo(() => payments.filter(p => {
    const text = `${p.ticket} ${p.id} ${p.motorist} ${p.referenceNumber || ""}`.toLowerCase();
    const matchesQuery = !query || text.includes(query.toLowerCase());
    const matchesStatus = status === "All" || p.status === status;
    const day = p.createdAt ? p.createdAt.slice(0, 10) : "";
    const matchesFrom = !dateFrom || (day && day >= dateFrom);
    const matchesTo = !dateTo || (day && day <= dateTo);
    return matchesQuery && matchesStatus && matchesFrom && matchesTo;
  }), [payments, query, status, dateFrom, dateTo]);

  return (
    <div className="et-fade-in">
      <PageHeader
        title="Payment verification"
        subtitle="Review and verify motorist citation payments processed through the Motorist Portal"
        actions={
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
            <button
              className="et-btn" onClick={handleRefreshAll} disabled={refreshingAll}
              style={{
                display: "flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 8,
                border: "none", background: C.accent, color: "#fff", fontWeight: 700, fontSize: 12.5,
              }}
            >
              <RefreshCw size={14} className={refreshingAll ? "spin" : ""} />
              {refreshingAll ? "Checking with PayMongo..." : "Refresh Payment Status"}
              {!refreshingAll && pendingQrphCount > 0 && (
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999,
                  background: "rgba(255,255,255,0.25)", fontSize: 11, fontWeight: 700,
                }}>
                  {pendingQrphCount}
                </span>
              )}
            </button>
            {refreshAllMsg && <div style={{ fontSize: 11.5, color: C.inkSoft, textAlign: "right", maxWidth: 260 }}>{refreshAllMsg}</div>}
          </div>
        }
      />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <TicketStat icon={Wallet} label="Total verified amount" value={peso(counts.verifiedAmount)} tone="success" />
        <TicketStat icon={CheckCircle2} label="Verified / Paid" value={counts.paid} tone="success" />
        <TicketStat icon={Clock3} label="Pending" value={counts.pending} tone="accent" />
        <TicketStat icon={XCircle} label="Failed / Expired" value={counts.failedOrExpired} tone="danger" />
      </div>

      <Panel
        title={`Transactions (${filtered.length})`}
        action={goTab ? { label: "View Monthly Report", onClick: () => goTab("analytics") } : undefined}
      >
        <div style={{ display: "flex", gap: 9, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 240px" }}>
            <Search size={14} color={C.inkFaint} style={{ position: "absolute", left: 10, top: 11 }} />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search ticket no. or transaction ID..."
              style={{ ...input, paddingLeft: 31 }} />
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...input, width: 160 }}>
            <option value="All">All statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...input, width: 145 }} title="From date" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...input, width: 145 }} title="To date" />
        </div>

        {paymentsError && (
          <div style={{ padding: "10px 12px", marginBottom: 12, borderRadius: 8, background: C.dangerSoft, color: C.danger, fontSize: 12.5 }}>
            Couldn't load payments: {paymentsError}
          </div>
        )}

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Transaction ID", "Ticket No.", "Motorist", "Violation", "Amount", "Method", "Reference", "Date", "Status", "Actions"].map(h => (
                  <th key={h} style={{ textAlign: "left", fontSize: 10.5, color: C.inkFaint, fontWeight: 700, padding: "8px 10px", borderBottom: `1px solid ${C.line}`, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paymentsLoading && (
                <tr><td colSpan={10} style={{ padding: 28, textAlign: "center", color: C.inkFaint }}>Loading payments...</td></tr>
              )}
              {!paymentsLoading && filtered.map(p => (
                <tr key={p.id} className="et-row">
                  <td style={cellStyle}><span className="et-mono" style={{ fontSize: 11 }}>{p.id.slice(0, 8)}</span></td>
                  <td style={cellStyle}><span className="et-mono">{p.ticket}</span></td>
                  <td style={cellStyle}>{p.motorist}</td>
                  <td style={cellStyle}>{p.violationType}</td>
                  <td style={cellStyle}>{peso(p.amount)}</td>
                  <td style={cellStyle}>{p.method}</td>
                  <td style={cellStyle}>{p.referenceNumber ? <span className="et-mono">{p.referenceNumber}</span> : "—"}</td>
                  <td style={cellStyle}>{fmtDate(new Date(p.createdAt))}</td>
                  <td style={cellStyle}><StatusPill status={p.status} label={p.statusLabel} /></td>
                  <td style={cellStyle}>
                    <button className="et-btn" title="View details" onClick={() => setOpen(p)}
                      style={{ padding: 6, borderRadius: 6, background: C.accentSoft, color: C.accentDark }}>
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {!paymentsLoading && !filtered.length && (
                <tr><td colSpan={10} style={{ padding: 28, textAlign: "center", color: C.inkFaint }}>No payments match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {open && (
        <>
          <div onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, background: "rgba(10,20,15,0.15)", zIndex: 30 }} />
          <PaymentDrawer payment={open} onClose={() => setOpen(null)} />
        </>
      )}
    </div>
  );
}