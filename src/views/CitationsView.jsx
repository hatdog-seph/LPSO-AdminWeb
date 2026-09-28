import React, { useMemo, useState } from "react";
import { Search, Plus, Pencil, Trash2, X } from "lucide-react";
import { C, cellStyle } from "../theme.js";
import PageHeader from "../components/PageHeader.jsx";
import StatusPill from "../components/StatusPill.jsx";
import Select from "../components/Select.jsx";
import { useTrafficData } from "../context/TrafficDataContext.jsx";

const emptyForm = {
  motorist: "", plateNumber: "", ordinanceId: "", violation: "",
  // barangayId is filled in per-form (openCreate/openEdit) once the live
  // barangay list has loaded from Supabase - it can't be known at module
  // load time the way a hardcoded BARANGAYS[0] could.
  enforcerId: "", barangayId: "",
  date: new Date().toISOString().slice(0, 10), time: "", status: "Pending",
};

function Field({ label, children }) {
  return <label style={{ display: "grid", gap: 5, fontSize: 11, color: C.inkSoft, fontWeight: 600 }}>
    {label}{children}
  </label>;
}
const inputStyle = {
  width: "100%", height: 36, padding: "0 10px", border: `1px solid ${C.line}`,
  borderRadius: 8, fontSize: 12, background: C.surface, color: C.ink,
};

export default function CitationsView() {
  const { citations, ordinances = [], enforcers = [], barangays = [], addCitation, updateCitation, deleteCitation } = useTrafficData();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [zone, setZone] = useState("All");
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const zoneOptions = useMemo(() => ["All", ...Array.from(new Set(citations.map(c => c.zone).filter(Boolean))).sort()], [citations]);

  const filtered = useMemo(() => citations.filter(c => {
    const text = `${c.id} ${c.motorist} ${c.plateNumber} ${c.violation}`.toLowerCase();
    return (!q || text.includes(q.toLowerCase()))
      && (status === "All" || c.status === status)
      && (zone === "All" || c.zone === zone);
  }), [citations, q, status, zone]);

  const openCreate = () => {
    setEditing({ ...emptyForm, ordinanceId: ordinances[0]?.id || "", violation: ordinances[0]?.desc || "", enforcerId: enforcers[0]?.id || "", barangayId: barangays[0]?.id || "" });
    setShowForm(true);
  };

  const openEdit = (citation) => {
    setEditing({
      ...citation,
      ordinanceId: citation.ordinanceId || citation.ordinance?.id || ordinances.find(o => o.desc === citation.violation)?.id || ordinances[0]?.id || "",
      enforcerId: citation.enforcerId || enforcers[0]?.id || "",
      barangayId: barangays.find(b => b.name === citation.zone)?.id || barangays[0]?.id || "",
    });
    setShowForm(true);
  };

  const save = (e) => {
    e.preventDefault();
    if (!editing?.motorist?.trim() || !editing?.plateNumber?.trim()) return;

    if (editing.id) {
      updateCitation(editing.id, {
        motorist: editing.motorist,
        plateNumber: editing.plateNumber,
        ordinanceId: editing.ordinanceId,
        enforcerId: editing.enforcerId,
        status: editing.status,
      });
    } else {
      const barangay = barangays.find(b => b.id === editing.barangayId) || barangays[0];
      addCitation({ ...editing, position: [barangay.lat, barangay.lng] });
    }
    setShowForm(false);
    setEditing(null);
  };

  const remove = (citation) => {
    if (window.confirm(`Delete citation ${citation.id}? This cannot be undone.`)) {
      deleteCitation(citation.id);
      if (editing?.id === citation.id) {
        setShowForm(false);
        setEditing(null);
      }
    }
  };

  return (
    <div className="et-fade-in">
      <PageHeader title="Citation monitoring" subtitle={`${filtered.length} of ${citations.length} records`} live />

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 260px" }}>
          <Search size={14} color={C.inkFaint} style={{ position: "absolute", left: 10, top: 11 }} />
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search citation, motorist, plate, or violation"
            style={{ ...inputStyle, paddingLeft: 30 }} />
        </div>
        <Select value={status} onChange={setStatus} options={["All", "Paid", "Pending", "Overdue", "Contested"]} />
        <Select value={zone} onChange={setZone} options={zoneOptions} />
        <button className="et-btn" onClick={openCreate}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 13px", borderRadius: 8, border: "none", background: C.accent, color: "#fff", fontWeight: 700 }}>
          <Plus size={15} /> Add Citation
        </button>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: C.surfaceSunk }}>
              {["Citation", "Motorist / Plate", "Violation", "Officer", "Barangay", "Date", "Status", "Actions"].map(h =>
                <th key={h} style={{ textAlign: "left", fontSize: 10.5, color: C.inkFaint, fontWeight: 700, padding: "10px", textTransform: "uppercase" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="et-row">
                  <td style={cellStyle}><span className="et-mono">{c.id}</span></td>
                  <td style={cellStyle}><div style={{ fontWeight: 600 }}>{c.motorist}</div><div style={{ fontSize: 10.5, color: C.inkFaint }}>{c.plateNumber}</div></td>
                  <td style={cellStyle}><div>{c.violation}</div><div style={{ fontSize: 10.5, color: C.inkFaint }}>{c.ordinance?.code || c.ordinanceId || "No ordinance linked"} · ₱{Number(c.amount || 0).toLocaleString("en-PH")}</div></td>
                  <td style={cellStyle}>{c.officer}</td>
                  <td style={cellStyle}>{c.zone}</td>
                  <td style={cellStyle}>{c.date}</td>
                  <td style={cellStyle}><StatusPill status={c.status} /></td>
                  <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                    <button className="et-btn" title="Edit citation" onClick={() => openEdit(c)}
                      style={{ padding: 6, borderRadius: 6, background: C.infoSoft, color: C.infoDark, marginRight: 5 }}><Pencil size={14} /></button>
                    <button className="et-btn" title="Delete citation" onClick={() => remove(c)}
                      style={{ padding: 6, borderRadius: 6, background: C.dangerSoft, color: C.danger }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={8} style={{ padding: 30, textAlign: "center", color: C.inkFaint }}>No citations match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && editing && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(10,25,55,.35)", display: "flex", justifyContent: "center", alignItems: "center", padding: 20 }}
          onMouseDown={e => { if (e.target === e.currentTarget) { setShowForm(false); setEditing(null); } }}>
          <form onSubmit={save} style={{ width: "min(620px, 100%)", maxHeight: "90vh", overflowY: "auto", background: C.surface, borderRadius: 14, boxShadow: "0 18px 50px rgba(0,0,0,.2)" }}>
            <div style={{ padding: "16px 18px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div style={{ fontSize: 16, fontWeight: 700 }}>{editing.id ? "Edit Citation" : "Add Citation"}</div><div style={{ fontSize: 11, color: C.inkFaint }}>{editing.id || "New traffic citation"}</div></div>
              <button type="button" className="et-btn" onClick={() => { setShowForm(false); setEditing(null); }} style={{ padding: 6, background: "transparent", color: C.inkSoft }}><X size={18} /></button>
            </div>
            <div style={{ padding: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Motorist"><input required value={editing.motorist} onChange={e => setEditing(x => ({ ...x, motorist: e.target.value }))} style={inputStyle} /></Field>
              <Field label="Plate number"><input required value={editing.plateNumber} onChange={e => setEditing(x => ({ ...x, plateNumber: e.target.value }))} style={inputStyle} /></Field>
              <Field label="Ordinance / Violation"><select value={editing.ordinanceId} onChange={e => { const o = ordinances.find(x => x.id === e.target.value); setEditing(x => ({ ...x, ordinanceId: e.target.value, violation: o?.desc || x.violation })); }} style={inputStyle}>{ordinances.map(o => <option key={o.id} value={o.id}>{o.code} — {o.desc} (₱{Number(o.fine).toLocaleString("en-PH")})</option>)}</select></Field>
              <Field label="Enforcer"><select value={editing.enforcerId} onChange={e => setEditing(x => ({ ...x, enforcerId: e.target.value }))} style={inputStyle}>{enforcers.length ? enforcers.map(o => <option key={o.id} value={o.id}>{o.name} (Badge {o.badge})</option>) : <option value="">No enforcers registered yet</option>}</select></Field>
              {!editing.id && <Field label="Barangay"><select value={editing.barangayId} onChange={e => setEditing(x => ({ ...x, barangayId: e.target.value }))} style={inputStyle}>{barangays.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>}
              <Field label="Status"><select value={editing.status} onChange={e => setEditing(x => ({ ...x, status: e.target.value }))} style={inputStyle}>{["Paid", "Pending", "Overdue", "Contested"].map(v => <option key={v}>{v}</option>)}</select></Field>
              {editing.id && <Field label="Issued"><input disabled value={`${editing.date || "—"} ${editing.time || ""}`} style={{ ...inputStyle, color: C.inkFaint, background: C.surfaceSunk }} /></Field>}
            </div>
            <div style={{ padding: "0 18px 18px", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="et-btn" onClick={() => { setShowForm(false); setEditing(null); }} style={{ padding: "9px 14px", borderRadius: 8, background: C.surface, border: `1px solid ${C.line}`, color: C.inkSoft }}>Cancel</button>
              <button type="submit" className="et-btn" style={{ padding: "9px 15px", borderRadius: 8, border: "none", background: C.accent, color: "#fff", fontWeight: 700 }}>{editing.id ? "Save Changes" : "Create Citation"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
