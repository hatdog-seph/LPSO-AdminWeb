import React, { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, X, Search, Link2 } from "lucide-react";
import { C, cellStyle } from "../theme.js";
import { peso } from "../data/geoData.js";
import PageHeader from "../components/PageHeader.jsx";
import TicketStat from "../components/TicketStat.jsx";
import { useTrafficData } from "../context/TrafficDataContext.jsx";

const empty = { code: "", desc: "", fine: "" };
const inputStyle = { width: "100%", height: 36, padding: "0 10px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 12, background: C.surface, color: C.ink };

export default function OrdinancesView() {
  const { ordinances = [], ordinancesLoading, ordinancesError, citations = [], addOrdinance, updateOrdinance, deleteOrdinance } = useTrafficData();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => ordinances.filter(o => {
    const text = `${o.id} ${o.code} ${o.desc}`.toLowerCase();
    return !q || text.includes(q.toLowerCase());
  }), [ordinances, q]);

  const citedCount = useMemo(() => new Set(citations.map(c => c.ordinanceId || c.ordinance?.id).filter(Boolean)).size, [citations]);
  const totalScheduled = useMemo(() => ordinances.reduce((sum, o) => sum + Number(o.fine || 0), 0), [ordinances]);
  const linkedCitations = citations.filter(c => c.ordinanceId || c.ordinance?.id).length;

  const openCreate = () => { setFormError(""); setEditing({ ...empty }); setShowForm(true); };
  const openEdit = o => { setFormError(""); setEditing({ ...o }); setShowForm(true); };
  const close = () => { setEditing(null); setShowForm(false); setFormError(""); };

  const save = async e => {
    e.preventDefault();
    if (!editing?.code?.trim() || !editing?.desc?.trim() || editing.fine === "") {
      setFormError("Code, description, and fine amount are required.");
      return;
    }
    setSaving(true);
    setFormError("");
    const result = editing.id
      ? await updateOrdinance(editing.id, editing)
      : await addOrdinance(editing);
    setSaving(false);
    if (!result.ok) { setFormError(result.error); return; }
    close();
  };

  const remove = async o => {
    if (window.confirm(`Delete ${o.code}? This will be blocked if citations still use this ordinance.`)) {
      const result = await deleteOrdinance(o.id);
      if (!result.ok) window.alert(result.error);
    }
  };

  return (
    <div className="et-fade-in">
      <PageHeader title="Ordinances & fine schedule" subtitle="CRUD-managed ordinance master data synchronized with citations, motorists, enforcers, dashboard KPIs, and the map" live />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginBottom: 18 }}>
        <TicketStat icon={Link2} label="Active ordinances" value={ordinances.length} sub="Current master records" tone="info" />
        <TicketStat icon={Link2} label="Ordinances cited" value={citedCount} sub="With at least one citation" tone="accent" />
        <TicketStat icon={Link2} label="Linked citations" value={linkedCitations} sub="Using ordinance records" tone="success" />
        <TicketStat icon={Link2} label="Scheduled fines" value={peso(totalScheduled)} sub="Sum of ordinance fine values" tone="danger" />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 300px" }}>
          <Search size={14} color={C.inkFaint} style={{ position: "absolute", left: 10, top: 11 }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search ordinance code or description" style={{ ...inputStyle, paddingLeft: 30 }} />
        </div>
        <button className="et-btn" onClick={openCreate} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 13px", borderRadius: 8, border: "none", background: C.accent, color: "#fff", fontWeight: 700 }}><Plus size={15} /> Add Ordinance</button>
      </div>

      {ordinancesError && (
        <div style={{ padding: "10px 12px", marginBottom: 12, borderRadius: 8, background: C.dangerSoft, color: C.danger, fontSize: 12.5 }}>
          Couldn't load ordinances: {ordinancesError}
        </div>
      )}

      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: C.surfaceSunk }}>
              {["Code", "Description", "Fine", "Citations", "Actions"].map(h => <th key={h} style={{ textAlign: "left", fontSize: 10.5, color: C.inkFaint, fontWeight: 700, padding: "10px", textTransform: "uppercase" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {ordinancesLoading && (
                <tr><td colSpan={5} style={{ padding: 30, textAlign: "center", color: C.inkFaint }}>Loading fine schedule...</td></tr>
              )}
              {!ordinancesLoading && rows.map(o => {
                const cited = citations.filter(c => (c.ordinanceId || c.ordinance?.id) === o.id).length;
                return <tr key={o.id} className="et-row">
                  <td style={cellStyle}><div className="et-mono" style={{ fontWeight: 700 }}>{o.code}</div><div style={{ fontSize: 10.5, color: C.inkFaint }}>{o.id}</div></td>
                  <td style={cellStyle}>{o.desc}</td>
                  <td style={{ ...cellStyle, fontWeight: 700 }}>{peso(Number(o.fine || 0))}</td>
                  <td style={cellStyle}>{cited}</td>
                  <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                    <button className="et-btn" title="Edit ordinance" onClick={() => openEdit(o)} style={{ padding: 6, borderRadius: 6, background: C.infoSoft, color: C.infoDark, marginRight: 5 }}><Pencil size={14} /></button>
                    <button className="et-btn" title="Delete ordinance" onClick={() => remove(o)} style={{ padding: 6, borderRadius: 6, background: cited ? C.surfaceSunk : C.dangerSoft, color: cited ? C.inkFaint : C.danger }}><Trash2 size={14} /></button>
                  </td>
                </tr>;
              })}
              {!ordinancesLoading && !rows.length && <tr><td colSpan={5} style={{ padding: 30, textAlign: "center", color: C.inkFaint }}>No ordinances match your search.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && editing && <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(10,25,55,.35)", display: "flex", justifyContent: "center", alignItems: "center", padding: 20 }} onMouseDown={e => e.target === e.currentTarget && close()}>
        <form onSubmit={save} style={{ width: "min(620px, 100%)", background: C.surface, borderRadius: 14, boxShadow: "0 18px 50px rgba(0,0,0,.2)" }}>
          <div style={{ padding: "16px 18px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><div style={{ fontSize: 16, fontWeight: 700 }}>{editing.id ? "Edit Ordinance" : "Add Ordinance"}</div><div style={{ fontSize: 11, color: C.inkFaint }}>{editing.id || "New ordinance master record"}</div></div>
            <button type="button" className="et-btn" onClick={close} style={{ padding: 6, background: "transparent", color: C.inkSoft }}><X size={18} /></button>
          </div>
          <div style={{ padding: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 5, fontSize: 11, color: C.inkSoft, fontWeight: 600 }}>Ordinance code<input required value={editing.code} onChange={e => setEditing(x => ({ ...x, code: e.target.value }))} style={inputStyle} placeholder="MO-2026-001 §1.1" /></label>
            <label style={{ display: "grid", gap: 5, fontSize: 11, color: C.inkSoft, fontWeight: 600 }}>Fine (₱)<input required type="number" min="0" value={editing.fine} onChange={e => setEditing(x => ({ ...x, fine: e.target.value }))} style={inputStyle} placeholder="500" /></label>
            <label style={{ display: "grid", gap: 5, fontSize: 11, color: C.inkSoft, fontWeight: 600, gridColumn: "1 / -1" }}>Violation / description<input required value={editing.desc} onChange={e => setEditing(x => ({ ...x, desc: e.target.value }))} style={inputStyle} placeholder="No helmet / improper protective gear" /></label>
            {formError && (
              <div style={{ gridColumn: "1 / -1", padding: "9px 11px", borderRadius: 8, background: C.dangerSoft, color: C.danger, fontSize: 12.5 }}>
                {formError}
              </div>
            )}
          </div>
          <div style={{ padding: "0 18px 18px", display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="et-btn" onClick={close} style={{ padding: "9px 14px", borderRadius: 8, background: C.surface, border: `1px solid ${C.line}`, color: C.inkSoft }}>Cancel</button>
            <button type="submit" className="et-btn" disabled={saving} style={{ padding: "9px 15px", borderRadius: 8, border: "none", background: C.accent, color: "#fff", fontWeight: 700, opacity: saving ? 0.7 : 1 }}>{saving ? "Saving..." : editing.id ? "Save Changes" : "Create Ordinance"}</button>
          </div>
        </form>
      </div>}
    </div>
  );
}
