import React, { useMemo, useState } from "react";
import { Search, MapPin, Ticket, Banknote, Users } from "lucide-react";
import { C } from "../theme.js";
import PageHeader from "../components/PageHeader.jsx";
import StatusPill from "../components/StatusPill.jsx";
import TicketStat from "../components/TicketStat.jsx";
import { useTrafficData } from "../context/TrafficDataContext.jsx";

const peso = (n) => `₱${Number(n || 0).toLocaleString("en-PH")}`;

export default function MotoristsView() {
  const { citations = [] } = useTrafficData();
  const [q, setQ] = useState("");

  const rows = useMemo(() => [...citations].sort((a, b) => {
    const ad = new Date(a.issuedAt || a.date || 0).getTime();
    const bd = new Date(b.issuedAt || b.date || 0).getTime();
    return bd - ad;
  }), [citations]);

  const filtered = useMemo(() => rows.filter(c => {
    const text = [c.motorist, c.plateNumber, c.violation, c.location, c.barangay?.name, c.id].join(" ").toLowerCase();
    return !q || text.includes(q.toLowerCase());
  }), [rows, q]);

  const uniqueMotorists = new Set(rows.map(c => `${String(c.motorist || "").trim().toLowerCase()}|${String(c.plateNumber || "").trim().toLowerCase()}`)).size;
  const totalFees = rows.reduce((sum, c) => sum + Number(c.amount ?? c.fine ?? 0), 0);
  const unpaidFees = rows.filter(c => c.status !== "Paid").reduce((sum, c) => sum + Number(c.amount ?? c.fine ?? 0), 0);

  return (
    <div className="et-fade-in">
      <PageHeader
        title="Motorists"
        subtitle={`${uniqueMotorists} motorists · ${rows.length} citation records · synchronized with citations and map`}
        live
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginBottom: 18 }}>
        <TicketStat icon={Users} label="Unique motorists" value={uniqueMotorists} sub="Name + plate records" tone="info" />
        <TicketStat icon={Ticket} label="Citations" value={rows.length} sub="Live citation records" tone="accent" />
        <TicketStat icon={Banknote} label="Total fees" value={peso(totalFees)} sub="All recorded violations" tone="success" />
        <TicketStat icon={Banknote} label="Outstanding fees" value={peso(unpaidFees)} sub="Pending, overdue, or contested" tone="danger" />
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: 14, borderBottom: `1px solid ${C.line}`, display: "flex", gap: 10 }}>
          <div style={{ position: "relative", flex: "1 1 320px" }}>
            <Search size={14} color={C.inkFaint} style={{ position: "absolute", left: 10, top: 11 }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search motorist, plate, violation, or location" style={{ width: "100%", height: 36, padding: "0 10px 0 30px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 12, background: C.surface, color: C.ink }} />
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.surfaceSunk }}>
                {["Motorist's Name", "Plate Number", "Violation", "Location of Citation", "Fee", "Status"].map(h => (
                  <th key={h} style={{ textAlign: "left", fontSize: 10.5, color: C.inkFaint, fontWeight: 700, padding: "10px", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const location = c.location || c.barangay?.name || "Libmanan";
                return (
                  <tr key={c.id} className="et-row">
                    <td style={{ padding: 10, borderBottom: `1px solid ${C.line}`, fontWeight: 650 }}>
                      <div>{c.motorist || "Unknown Motorist"}</div>
                      <div style={{ fontSize: 10.5, color: C.inkFaint }} className="et-mono">{c.id}</div>
                    </td>
                    <td style={{ padding: 10, borderBottom: `1px solid ${C.line}` }}><span className="et-mono">{c.plateNumber || "—"}</span></td>
                    <td style={{ padding: 10, borderBottom: `1px solid ${C.line}` }}>{c.violation || "—"}</td>
                    <td style={{ padding: 10, borderBottom: `1px solid ${C.line}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}><MapPin size={13} color={C.accent} />{location}</div>
                      {Array.isArray(c.position) && <div style={{ fontSize: 10.5, color: C.inkFaint, marginTop: 2 }}>{Number(c.position[0]).toFixed(5)}, {Number(c.position[1]).toFixed(5)}</div>}
                    </td>
                    <td style={{ padding: 10, borderBottom: `1px solid ${C.line}`, fontWeight: 650 }}>{peso(c.amount ?? c.fine)}</td>
                    <td style={{ padding: 10, borderBottom: `1px solid ${C.line}` }}><StatusPill status={c.status || "Pending"} /></td>
                  </tr>
                );
              })}
              {!filtered.length && <tr><td colSpan={6} style={{ padding: 30, textAlign: "center", color: C.inkFaint }}>No motorists match your search.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
