import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell, PieChart, Pie, Legend,
} from "recharts";
import { FileText, Receipt, Users, CircleDollarSign, Clock3 } from "lucide-react";
import { C } from "../theme.js";
import { peso } from "../data/geoData.js";
import PageHeader from "../components/PageHeader.jsx";
import Panel from "../components/Panel.jsx";
import TicketStat from "../components/TicketStat.jsx";
import HotspotMap from "../components/HotspotMap.jsx";
import { useTrafficData } from "../context/TrafficDataContext.jsx";
import { computeAnalytics, filterCitationsByRange, monthLabel } from "../utils/analytics.js";
import MonthlyReportView from "./MonthlyReportView.jsx";

const PIE_COLORS = [C.accent, C.success, C.danger, C.info, C.inkFaint];

const input = {
  height: 36, padding: "0 10px",
  border: `1px solid ${C.line}`, borderRadius: 8,
  fontSize: 12, background: C.surface, color: C.ink,
};

function distanceKm(a, b) {
  const lat1 = Number(a[0]), lng1 = Number(a[1]);
  const lat2 = Number(b[0]), lng2 = Number(b[1]);
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export default function AnalyticsView() {
  const { citations, ordinances, payments, barangays } = useTrafficData();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [violationFilter, setViolationFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showReport, setShowReport] = useState(false);

  const filtered = useMemo(() => {
    let rows = filterCitationsByRange(citations, from, to);
    if (violationFilter !== "All") {
      rows = rows.filter(c => (c.violations || []).some(v => v.code === violationFilter) || c.ordinance?.code === violationFilter);
    }
    if (statusFilter !== "All") {
      rows = rows.filter(c => c.status === statusFilter);
    }
    return rows;
  }, [citations, from, to, violationFilter, statusFilter]);

  const stats = useMemo(() => computeAnalytics(filtered), [filtered]);

  const hotspotStats = useMemo(() => {
    const rows = barangays.map(b => ({ ...b, count: 0, revenue: 0 }));
    filtered.forEach(c => {
      if (!Array.isArray(c.position) || c.position.length < 2) return;
      let nearest = rows[0];
      let nearestDistance = Infinity;
      rows.forEach(b => {
        const d = distanceKm(c.position, [b.lat, b.lng]);
        if (d < nearestDistance) { nearest = b; nearestDistance = d; }
      });
      if (nearestDistance <= 15) {
        nearest.count += 1;
        const amount = Number(c.amount ?? c.fine ?? 0);
        if (c.status === "Settled") nearest.revenue += amount;
      }
    });
    return rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).map((b, i) => ({ ...b, rank: i + 1 }));
  }, [filtered, barangays]);

  const statusOptions = useMemo(() => ["All", ...new Set(citations.map(c => c.status).filter(Boolean))], [citations]);

  return (
    <>
    <div className="et-fade-in">
      <div className={showReport ? "no-print" : undefined}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <PageHeader
            title="Analytics"
            subtitle="Data-driven citation trends to support LPSO policy formulation and enforcer deployment"
          />
        </div>
        <button
          className="et-btn" onClick={() => setShowReport(true)}
          style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: C.accent, color: "#fff", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}
        >
          <FileText size={15} /> View Monthly Report
        </button>
      </div>

      <div style={{ display: "flex", gap: 9, marginBottom: 18, flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: C.inkSoft, fontWeight: 600 }}>
          From
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={input} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: C.inkSoft, fontWeight: 600 }}>
          To
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={input} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: C.inkSoft, fontWeight: 600 }}>
          Violation
          <select value={violationFilter} onChange={e => setViolationFilter(e.target.value)} style={{ ...input, width: 220 }}>
            <option value="All">All violations</option>
            {ordinances.map(o => <option key={o.id} value={o.code}>{o.code} — {o.desc}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: C.inkSoft, fontWeight: 600 }}>
          Status
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...input, width: 160 }}>
            {statusOptions.map(s => <option key={s} value={s}>{s === "All" ? "All statuses" : s}</option>)}
          </select>
        </label>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <TicketStat icon={Receipt} label="Total citations" value={stats.total} tone="accent" />
        <TicketStat icon={Users} label="Motorists cited" value={stats.uniqueMotorists} tone="info" />
        <TicketStat icon={CircleDollarSign} label="Total fines" value={peso(stats.totalFine)} tone="accent" />
        <TicketStat icon={CircleDollarSign} label="Settled amount" value={peso(stats.settledAmount)} tone="success" />
        <TicketStat icon={Clock3} label="Pending amount" value={peso(stats.pendingAmount)} tone="danger" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 16 }}>
        <Panel title="Monthly citation trend">
          {stats.monthlyTrend.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={stats.monthlyTrend.map(m => ({ ...m, label: monthLabel(m.month) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.inkFaint }} />
                <YAxis tick={{ fontSize: 11, fill: C.inkFaint }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" name="Citations" stroke={C.accent} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </Panel>

        <Panel title="Citation status breakdown">
          {stats.statusBreakdown.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={stats.statusBreakdown} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={85} label={({ status, count }) => `${status}: ${count}`}>
                  {stats.statusBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </Panel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Panel title="Most frequent violations">
          {stats.violationFrequency.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.violationFrequency.slice(0, 8)} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: C.inkFaint }} allowDecimals={false} />
                <YAxis type="category" dataKey="code" width={90} tick={{ fontSize: 10.5, fill: C.inkFaint }} />
                <Tooltip formatter={(v, n, p) => [v, p.payload.desc]} />
                <Bar dataKey="count" name="Citations" fill={C.accent} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </Panel>

        <Panel title="Citations by barangay">
          {stats.barangayDistribution.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.barangayDistribution.slice(0, 10)} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: C.inkFaint }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10.5, fill: C.inkFaint }} />
                <Tooltip />
                <Bar dataKey="count" name="Citations" fill={C.info} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </Panel>
      </div>

      <Panel title="Traffic violation hotspots">
        <HotspotMap stats={hotspotStats} citations={filtered} highlight={null} onSelect={() => {}} />
        <p style={{ fontSize: 11.5, color: C.inkFaint, marginTop: 10 }}>
          Derived from the same GPS-tagged citation records as the Hotspot Map page, matched to
          the nearest known barangay (records more than 15km away are excluded).
        </p>
      </Panel>
      </div>
      </div>

      {showReport && (
        <MonthlyReportView citations={citations} ordinances={ordinances} payments={payments} onClose={() => setShowReport(false)} />
      )}
    </>
  );
}

function EmptyChart() {
  return (
    <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: C.inkFaint, fontSize: 12.5 }}>
      No citation records for the current filters.
    </div>
  );
}