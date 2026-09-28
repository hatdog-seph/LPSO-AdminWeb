import React, { useMemo, useState } from "react";
import { X, Printer } from "lucide-react";
import { C } from "../theme.js";
import { peso } from "../data/geoData.js";
import { useAuth } from "../context/AuthContext.jsx";
import { computeAnalytics } from "../utils/analytics.js";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function MonthlyReportView({ citations, ordinances, payments, onClose }) {
  const { user } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());

  const years = useMemo(() => {
    const set = new Set(citations.map(c => c.date ? Number(c.date.slice(0, 4)) : null).filter(Boolean));
    set.add(now.getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [citations]);

  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthCitations = useMemo(
    () => citations.filter(c => c.date && c.date.slice(0, 7) === monthKey),
    [citations, monthKey],
  );
  const stats = useMemo(() => computeAnalytics(monthCitations), [monthCitations]);

  // Payments are matched to the selected month by when the payment record
  // was created, not by the citation's issue date, since a citation can be
  // issued one month and paid the next - the report should reflect actual
  // collection activity in the selected month.
  const monthPayments = useMemo(
    () => (payments || []).filter(p => p.createdAt && p.createdAt.slice(0, 7) === monthKey),
    [payments, monthKey],
  );

  const paymentStats = useMemo(() => {
    const paid = monthPayments.filter(p => p.status === "paid");
    const pending = monthPayments.filter(p => p.status === "pending");
    const failed = monthPayments.filter(p => p.status === "failed" || p.status === "expired");
    const refunded = monthPayments.filter(p => p.status === "refunded");
    return {
      totalPayments: monthPayments.length,
      paidCount: paid.length,
      pendingCount: pending.length,
      failedCount: failed.length,
      refundedCount: refunded.length,
      // Only rows this system itself marked "paid" (verified PayMongo webhook
      // or a status refresh) ever count toward collected amounts - never a
      // frontend claim - and each payment_id is summed exactly once, so a
      // webhook retry or repeated refresh can't double-count a transaction.
      verifiedAmount: paid.reduce((s, p) => s + p.amount, 0),
      refundedAmount: refunded.reduce((s, p) => s + p.amount, 0),
    };
  }, [monthPayments]);

  const generatedAt = new Date();
  const generatedBy = user?.name || "LPSO Administrator";

  return (
    <div className="report-overlay" style={{ position: "fixed", inset: 0, zIndex: 90, background: C.bg, overflowY: "auto" }}>
      <div className="no-print" style={{
        position: "sticky", top: 0, zIndex: 2, background: C.surface, borderBottom: `1px solid ${C.line}`,
        padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Monthly Report</div>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} style={selectStyle}>
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={selectStyle}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="et-btn" onClick={() => window.print()}
            style={{ padding: "9px 14px", borderRadius: 8, border: "none", background: C.accent, color: "#fff", fontWeight: 700, fontSize: 12.5, display: "flex", alignItems: "center", gap: 7 }}>
            <Printer size={14} /> Print Monthly Report
          </button>
          <button className="et-btn" onClick={onClose}
            style={{ padding: "9px 14px", borderRadius: 8, border: `1px solid ${C.line}`, background: C.surface, color: C.inkSoft, fontWeight: 600, fontSize: 12.5, display: "flex", alignItems: "center", gap: 7 }}>
            <X size={14} /> Close
          </button>
        </div>
      </div>

      <div className="report-page" style={{ maxWidth: 780, margin: "24px auto", background: "#fff", padding: 40, border: `1px solid ${C.line}` }}>
        <div style={{ textAlign: "center", borderBottom: `2px solid ${C.ink}`, paddingBottom: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.08em", color: C.inkFaint, textTransform: "uppercase" }}>Libmanan Public Safety Office</div>
          <h1 style={{ fontSize: 20, margin: "6px 0 4px" }}>LPSO Monthly Traffic Citation Report</h1>
          <div style={{ fontSize: 13, color: C.inkSoft }}>{MONTHS[month]} {year}</div>
        </div>

        <ReportSection title="Summary">
          <SummaryGrid>
            <SummaryItem label="Total citations issued" value={stats.total} />
            <SummaryItem label="Motorists cited" value={stats.uniqueMotorists} />
            <SummaryItem label="Total fines" value={peso(stats.totalFine)} />
            <SummaryItem label="Settled amount" value={peso(stats.settledAmount)} />
            <SummaryItem label="Pending amount" value={peso(stats.pendingAmount)} />
          </SummaryGrid>
        </ReportSection>

        <ReportSection title="Citation status summary">
          {stats.statusBreakdown.length ? (
            <SimpleTable
              headers={["Status", "Citations", "Share"]}
              rows={stats.statusBreakdown.map(s => [s.status, s.count, `${((s.count / stats.total) * 100 || 0).toFixed(1)}%`])}
            />
          ) : <NoData />}
        </ReportSection>

        <ReportSection title="Most common violations">
          {stats.violationFrequency.length ? (
            <SimpleTable
              headers={["Code", "Description", "Citations", "Total fines"]}
              rows={stats.violationFrequency.map(v => [v.code, v.desc, v.count, peso(v.fine)])}
            />
          ) : <NoData />}
        </ReportSection>

        <ReportSection title="Citations by barangay">
          {stats.barangayDistribution.length ? (
            <SimpleTable
              headers={["Barangay", "Citations"]}
              rows={stats.barangayDistribution.map(b => [b.name, b.count])}
            />
          ) : <NoData />}
          <p style={{ fontSize: 10.5, color: C.inkFaint, marginTop: 6 }}>
            Barangay is derived by matching each citation's recorded GPS coordinates to the
            nearest known barangay location — citations without a recorded GPS position are
            not included here.
          </p>
        </ReportSection>

        <ReportSection title="Payment summary">
          <SummaryGrid>
            <SummaryItem label="Total citations" value={stats.total} />
            <SummaryItem label="Verified payments" value={paymentStats.paidCount} />
            <SummaryItem label="Total amount collected" value={peso(paymentStats.verifiedAmount)} />
            <SummaryItem label="Pending payments" value={paymentStats.pendingCount} />
            <SummaryItem label="Failed payments" value={paymentStats.failedCount} />
            <SummaryItem label="Refunded payments" value={paymentStats.refundedCount} />
          </SummaryGrid>
          <p style={{ fontSize: 10.5, color: C.inkFaint, marginTop: 6 }}>
            Figures come from the payment ledger (PayMongo QR Ph transactions verified by webhook
            or by a server-side status check) — never from a frontend claim or screenshot. Each
            transaction is counted exactly once, so retried webhook deliveries do not inflate totals.
          </p>
        </ReportSection>

        <ReportSection title="Monthly payment breakdown">
          <SimpleTable
            headers={["Metric", "Value"]}
            rows={[
              ["Total violation amount (issued)", peso(stats.totalFine)],
              ["Total verified amount paid", peso(paymentStats.verifiedAmount)],
              ["Number of paid tickets", paymentStats.paidCount],
              ["Pending payments", paymentStats.pendingCount],
              ["Failed payments", paymentStats.failedCount],
              ["Refunded amount", peso(paymentStats.refundedAmount)],
            ]}
          />
          <p style={{ fontSize: 10.5, color: C.inkFaint, marginTop: 6 }}>
            "Total violation amount" is the value of citations issued this month regardless of
            payment status. "Total verified amount paid" is the actual amount collected and
            verified through PayMongo this month — these are two different figures and should
            not be added together.
          </p>
        </ReportSection>

        <ReportSection title="Trends and planning notes">
          <p style={{ fontSize: 12.5, color: C.ink, lineHeight: 1.6 }}>
            {stats.total === 0
              ? "No citations were recorded for this month."
              : `${stats.barangayDistribution[0]?.name || "No location data"} recorded the highest number ` +
                `of citations this month (${stats.barangayDistribution[0]?.count || 0}), and ` +
                `${stats.violationFrequency[0]?.desc || "no dominant violation"} was the most frequently ` +
                `cited violation (${stats.violationFrequency[0]?.count || 0} occurrences). This may indicate a ` +
                `priority area/violation for enforcer deployment planning.`}
          </p>
        </ReportSection>

        <div style={{ marginTop: 30, paddingTop: 14, borderTop: `1px solid ${C.line}`, fontSize: 10.5, color: C.inkFaint, display: "flex", justifyContent: "space-between" }}>
          <span>Generated by: {generatedBy}</span>
          <span>Generated on: {generatedAt.toLocaleString("en-PH")}</span>
        </div>
      </div>
    </div>
  );
}

const selectStyle = { height: 34, padding: "0 9px", border: `1px solid ${C.line}`, borderRadius: 7, fontSize: 12.5, background: C.surface, color: C.ink };

function ReportSection({ title, children }) {
  return (
    <div className="report-section" style={{ marginBottom: 22 }}>
      <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", color: C.inkSoft, borderBottom: `1px solid ${C.line}`, paddingBottom: 6, marginBottom: 10 }}>{title}</h2>
      {children}
    </div>
  );
}

function SummaryGrid({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>{children}</div>;
}

function SummaryItem({ label, value }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, color: C.inkFaint, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.ink, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function SimpleTable({ headers, rows }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr>
          {headers.map(h => (
            <th key={h} style={{ textAlign: "left", padding: "6px 8px", borderBottom: `1.5px solid ${C.ink}`, fontSize: 10.5, textTransform: "uppercase", color: C.inkSoft }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} style={{ padding: "6px 8px", borderBottom: `1px solid ${C.line}` }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function NoData() {
  return <p style={{ fontSize: 12, color: C.inkFaint }}>No data available for this period.</p>;
}
