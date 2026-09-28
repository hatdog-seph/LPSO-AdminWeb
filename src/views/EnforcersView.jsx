import React, { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, X, Search, Eye, EyeOff } from "lucide-react";
import { C, cellStyle } from "../theme.js";
import PageHeader from "../components/PageHeader.jsx";
import Panel from "../components/Panel.jsx";
import { useTrafficData } from "../context/TrafficDataContext.jsx";

const ROLES = [
  { value: "enforcer", label: "Traffic Enforcer" },
  { value: "senior enforcer", label: "Senior Enforcer" },
  { value: "supervisor", label: "Supervisor" },
];
const roleLabel = (value) => ROLES.find(r => r.value === value)?.label || value;

const emptyForm = { name: "", badge: "", role: "enforcer", password: "" };

const input = {
  width: "100%", height: 36, padding: "0 10px",
  border: `1px solid ${C.line}`, borderRadius: 8,
  fontSize: 12, background: C.surface, color: C.ink,
};

function Field({ label, children }) {
  return <label style={{ display: "grid", gap: 5, fontSize: 11, color: C.inkSoft, fontWeight: 600 }}>{label}{children}</label>;
}

export default function EnforcersView() {
  const {
    enforcers, enforcersLoading, enforcersError, citations,
    addEnforcer, updateEnforcer, deleteEnforcer,
  } = useTrafficData();

  const [query, setQuery] = useState("");
  const [role, setRole] = useState("All");
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => enforcers.filter(e => {
    const text = `${e.id} ${e.badge} ${e.name} ${e.role}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase()))
      && (role === "All" || e.role === role);
  }), [enforcers, query, role]);

  const openCreate = () => {
    setFormError("");
    setEditing({ ...emptyForm });
    setShowForm(true);
  };

  const openEdit = (enforcer) => {
    setFormError("");
    setEditing({ ...enforcer, password: "" });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditing(null); setShowPassword(false); };

  const save = async (e) => {
    e.preventDefault();
    if (!editing?.name?.trim() || (!editing.id && !editing?.badge?.trim())) {
      setFormError("Full name and badge number are required.");
      return;
    }
    setSaving(true);
    setFormError("");

    const result = editing.id
      ? await updateEnforcer(editing.id, { name: editing.name, role: editing.role })
      : await addEnforcer(editing);

    setSaving(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    closeForm();
  };

  const remove = async (enforcer) => {
    if (window.confirm(`Delete ${enforcer.name} (${enforcer.badge})? This cannot be undone.`)) {
      const result = await deleteEnforcer(enforcer.id);
      if (result.ok && editing?.id === enforcer.id) closeForm();
    }
  };

  return (
    <div className="et-fade-in">
      <PageHeader
        title="Enforcer administration"
        subtitle={`${enforcers.length} registered enforcers \u00b7 new registrations sync straight to the enforcer app`}
      />

      <Panel title={`Registered enforcers (${filtered.length})`}>
        <div style={{ display: "flex", gap: 9, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 260px" }}>
            <Search size={14} color={C.inkFaint} style={{ position: "absolute", left: 10, top: 11 }} />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search name, badge, role..."
              style={{ ...input, paddingLeft: 31 }} />
          </div>
          <select value={role} onChange={e => setRole(e.target.value)} style={{ ...input, width: 170 }}>
            <option value="All">All roles</option>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button className="et-btn" onClick={openCreate}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 13px", borderRadius: 8, border: "none", background: C.accent, color: "#fff", fontWeight: 700 }}>
            <Plus size={15} /> Add Enforcer
          </button>
        </div>

        {enforcersError && (
          <div style={{ padding: "10px 12px", marginBottom: 12, borderRadius: 8, background: C.dangerSoft, color: C.danger, fontSize: 12.5 }}>
            Couldn't load enforcers: {enforcersError}
          </div>
        )}

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Badge / Login ID", "Name", "Role", "Citations on file", "Actions"].map(h => (
                  <th key={h} style={{ textAlign: "left", fontSize: 10.5, color: C.inkFaint, fontWeight: 700, padding: "8px 10px", borderBottom: `1px solid ${C.line}`, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enforcersLoading && (
                <tr><td colSpan={5} style={{ padding: 28, textAlign: "center", color: C.inkFaint }}>Loading roster...</td></tr>
              )}
              {!enforcersLoading && filtered.map(e => {
                const count = citations.filter(c => c.officer === e.name).length;
                return (
                  <tr key={e.id} className="et-row">
                    <td style={cellStyle}><span className="et-mono">{e.badge}</span></td>
                    <td style={{ ...cellStyle, fontWeight: 600 }}>{e.name}</td>
                    <td style={cellStyle}>{roleLabel(e.role)}</td>
                    <td style={cellStyle}>{count}</td>
                    <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                      <button className="et-btn" title="Edit enforcer" onClick={() => openEdit(e)}
                        style={{ padding: 6, borderRadius: 6, background: C.infoSoft, color: C.infoDark, marginRight: 5 }}>
                        <Pencil size={14} />
                      </button>
                      <button className="et-btn" title="Delete enforcer" onClick={() => remove(e)}
                        style={{ padding: 6, borderRadius: 6, background: C.dangerSoft, color: C.danger }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!enforcersLoading && !filtered.length && (
                <tr><td colSpan={5} style={{ padding: 28, textAlign: "center", color: C.inkFaint }}>No enforcers match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {showForm && editing && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(10,25,55,.35)", display: "flex", justifyContent: "center", alignItems: "center", padding: 20 }}
          onMouseDown={e => { if (e.target === e.currentTarget) closeForm(); }}
        >
          <form onSubmit={save} style={{ width: "min(480px, 100%)", maxHeight: "90vh", overflowY: "auto", background: C.surface, borderRadius: 14, boxShadow: "0 18px 50px rgba(0,0,0,.2)" }}>
            <div style={{ padding: "16px 18px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{editing.id ? "Edit Enforcer" : "Add Enforcer"}</div>
                <div style={{ fontSize: 11, color: C.inkFaint }}>{editing.id || "New registration \u2192 syncs to the enforcer app"}</div>
              </div>
              <button type="button" className="et-btn" onClick={closeForm}
                style={{ padding: 6, background: "transparent", color: C.inkSoft }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 18, display: "grid", gap: 12 }}>
              <Field label="Full name">
                <input required autoFocus value={editing.name} onChange={e => setEditing(x => ({ ...x, name: e.target.value }))} style={input} />
              </Field>
              <Field label="Badge number (also their enforcer-app login ID)">
                <input required disabled={!!editing.id} value={editing.badge}
                  onChange={e => setEditing(x => ({ ...x, badge: e.target.value.trim() }))}
                  placeholder="e.g. 1046" style={{ ...input, ...(editing.id ? { background: C.surfaceSunk, color: C.inkFaint } : {}) }} />
              </Field>
              <Field label="Role">
                <select value={editing.role} onChange={e => setEditing(x => ({ ...x, role: e.target.value }))} style={input}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </Field>
              {!editing.id && (
                <Field label="Temporary password (min. 6 characters)">
                  <div style={{ position: "relative" }}>
                    <input required type={showPassword ? "text" : "password"} minLength={6} value={editing.password}
                      onChange={e => setEditing(x => ({ ...x, password: e.target.value }))}
                      style={{ ...input, paddingRight: 34 }} />
                    <button type="button" onClick={() => setShowPassword(s => !s)}
                      style={{ position: "absolute", right: 8, top: 8, background: "transparent", border: "none", color: C.inkFaint, cursor: "pointer" }}>
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <div style={{ fontSize: 10.5, color: C.inkFaint, fontWeight: 400 }}>
                    Share this with the enforcer directly \u2014 it won't be shown again.
                  </div>
                </Field>
              )}

              {formError && (
                <div style={{ padding: "9px 11px", borderRadius: 8, background: C.dangerSoft, color: C.danger, fontSize: 12.5 }}>
                  {formError}
                </div>
              )}
            </div>

            <div style={{ padding: "0 18px 18px", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="et-btn" onClick={closeForm}
                style={{ padding: "9px 14px", borderRadius: 8, background: C.surface, border: `1px solid ${C.line}`, color: C.inkSoft }}>
                Cancel
              </button>
              <button type="submit" className="et-btn" disabled={saving}
                style={{ padding: "9px 15px", borderRadius: 8, border: "none", background: C.accent, color: "#fff", fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving..." : editing.id ? "Save Changes" : "Create Enforcer"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
