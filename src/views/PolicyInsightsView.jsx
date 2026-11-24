import React, { useMemo, useState } from "react";
import { Lightbulb, Download, ChevronDown, SlidersHorizontal, MapPin, Clock, Scale, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { C } from "../theme.js";
import PageHeader from "../components/PageHeader.jsx";
import Panel from "../components/Panel.jsx";
import { useTrafficData } from "../context/TrafficDataContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { EXPORT_FORMATS, exportReport } from "../utils/reportExport.js";
import {
  DEFAULT_SETTINGS, SETTING_LABELS, filterByPeriod, generateInsights, buildInsightsModel,
} from "../utils/policyInsights.js";

const PRIORITY = {
  High:   { bg: "#F8E2DE", fg: "#7A271E", bar: "#B23A2E" },
  Medium: { bg: "#FDF1D6", fg: "#7A5300", bar: "#D99A00" },
  Low:    { bg: "#E1EBF1", fg: "#254A61", bar: "#3A6B8A" },
};
const CATEGORY_ICON = {
  "Enforcer deployment": MapPin,
  "Policy formulation": Scale,
  "Data quality": Info,
};
const PERIODS = [
  { id: "30", label: "Last 30 days" },
  { id: "90", label: "Last 90 days" },
  { id: "180", label: "Last 6 months" },
  { id: "all", label: "All time" },
];
const field = {
  height: 36, padding: "0 10px", border: `1px solid ${C.line}`, borderRadius: 8,
  fontSize: 12.5, background: C.surface, color: C.ink,
};

function InsightCard({ item }) {
  const p = PRIORITY[item.priority] || PRIORITY.Low;
  const Icon = CATEGORY_ICON[item.category] || Lightbulb;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `4px solid ${p.bar}`, borderRadius: 12, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ background: p.bg, color: p.fg, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>{item.priority} priority</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>
          <Icon size={13} /> {item.category}
        </span>
      </div>
      <h3 className="et-display" style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>{item.area}</h3>
      <p style={{ fontSize: 13, color: C.inkSoft, margin: "0 0 12px", lineHeight: 1.5 }}>
        <b style={{ color: C.ink }}>Finding: </b>{item.finding}
      </p>
      <div style={{ background: C.accentSoft, borderRadius: 8, padding: "10px 12px", fontSize: 13, lineHeight: 1.5, color: C.ink }}>
        <b>Recommended action: </b>{item.recommendation}
      </div>
      {item.evidence?.length > 0 && (
        <details style={{ marginTop: 10 }}>
          <summary style={{ fontSize: 12, color: C.accentDark, cursor: "pointer", fontWeight: 600 }}>View supporting data</summary>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12.5, color: C.inkSoft, lineHeight: 1.7 }}>
            {item.evidence.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

export default function PolicyInsightsView() {
  const { citations, enforcers } = useTrafficData();
  const { user } = useAuth();
  const [period, setPeriod] = useState("90");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(null);
  const [error, setError] = useState("");

  const { current, previous, label } = useMemo(() => filterByPeriod(citations, period), [citations, period]);
  const result = useMemo(
    () => generateInsights(current, { previous, enforcersRegistered: (enforcers || []).length, settings }),
    [current, previous, enforcers, settings],
  );

  const counts = { High: 0, Medium: 0, Low: 0 };
  result.insights.forEach(i => { counts[i.priority] += 1; });

  const runExport = async (format) => {
    setMenuOpen(false); setError(""); setExporting(format);
    try {
      const model = buildInsightsModel({
        result, settings, periodLabel: label,
        generatedBy: user?.name || "LPSO Administrator", generatedAt: new Date(),
      });
      await exportReport(format, model);
    } catch (e) {
      console.error(e);
      setError("Could not create the file. Please try again.");
    } finally { setExporting(null); }
  };

  const setNum = (k, v) => setSettings(s => ({ ...s, [k]: v === "" ? "" : Math.max(0, Number(v)) }));

  return (
    <div>
      <PageHeader
        title="Policy Insights"
        subtitle="Recommendations for enforcer deployment and policy formulation, based on citation records."
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center", position: "relative", flexWrap: "wrap" }}>
            <select value={period} onChange={e => setPeriod(e.target.value)} style={field} aria-label="Period">
              {PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <button className="et-btn" onClick={() => setShowSettings(s => !s)}
              style={{ ...field, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: 600 }}>
              <SlidersHorizontal size={14} /> Thresholds
            </button>
            <button className="et-btn" onClick={() => setMenuOpen(o => !o)} disabled={!!exporting || !result.insights.length}
              style={{ ...field, border: `1px solid ${C.accent}`, color: C.accent, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, opacity: exporting || !result.insights.length ? 0.55 : 1, cursor: "pointer" }}>
              <Download size={14} /> {exporting ? "Preparing…" : "Download as"} <ChevronDown size={14} />
            </button>
            {menuOpen && (
              <div style={{ position: "absolute", top: 42, right: 0, zIndex: 5, minWidth: 190, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 8, boxShadow: "0 6px 18px rgba(0,0,0,.12)", overflow: "hidden" }}>
                {EXPORT_FORMATS.map(f => (
                  <button key={f.id} onClick={() => runExport(f.id)}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", border: 0, borderBottom: `1px solid ${C.line}`, background: C.surface, color: C.ink, fontSize: 12.5, cursor: "pointer" }}>
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        }
      />
      {error && <div style={{ color: C.danger, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}

      {showSettings && (
        <div style={{ marginBottom: 16 }}>
          <Panel title="Threshold settings">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 14 }}>
              {Object.keys(SETTING_LABELS).map(k => (
                <label key={k} style={{ display: "block", fontSize: 12.5 }}>
                  <span style={{ fontWeight: 600 }}>{SETTING_LABELS[k][0]}</span>
                  <input type="number" min="0" value={settings[k]} onChange={e => setNum(k, e.target.value)} style={{ ...field, width: "100%", marginTop: 4 }} />
                  <span style={{ display: "block", color: C.inkSoft, fontSize: 11.5, marginTop: 3, lineHeight: 1.4 }}>{SETTING_LABELS[k][1]}</span>
                </label>
              ))}
            </div>
            <button className="et-btn" onClick={() => setSettings(DEFAULT_SETTINGS)}
              style={{ marginTop: 12, background: "transparent", color: C.accentDark, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>
              Reset to defaults
            </button>
          </Panel>
        </div>
      )}

      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18, marginBottom: 16, display: "flex", gap: 14, alignItems: "flex-start" }}>
        <Lightbulb size={22} color={C.accent} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600, marginBottom: 4 }}>{label} | {current.length} citation(s) analyzed</div>
          <div style={{ fontSize: 14.5, lineHeight: 1.5 }}>{result.summary}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {["High", "Medium", "Low"].map(k => (
              <span key={k} style={{ background: PRIORITY[k].bg, color: PRIORITY[k].fg, fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>
                {counts[k]} {k.toLowerCase()}
              </span>
            ))}
          </div>
        </div>
      </div>

      {result.insights.length === 0 ? (
        <div style={{ background: C.surface, border: `1px dashed ${C.lineStrong}`, borderRadius: 12, padding: 28, textAlign: "center", color: C.inkSoft, fontSize: 13.5 }}>
          <CheckCircle2 size={26} color={C.success} style={{ marginBottom: 8 }} />
          <div>No recommendations for this period. Select a longer period or lower the thresholds.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: 14 }}>
          {result.insights.map(i => <InsightCard key={i.id} item={i} />)}
        </div>
      )}

      {result.normal.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Panel title="Areas within normal range">
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: C.inkSoft, lineHeight: 1.8 }}>
              {result.normal.map((n, i) => <li key={i}><b style={{ color: C.ink }}>{n.area}:</b> {n.note}</li>)}
            </ul>
          </Panel>
        </div>
      )}

      <p style={{ fontSize: 11.5, color: C.inkFaint, marginTop: 14, display: "flex", gap: 6, alignItems: "flex-start", lineHeight: 1.5 }}>
        <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
        Recommendations are generated by rules applied to existing citation records. They are intended to support, not replace, the decisions of LPSO officials.
      </p>
    </div>
  );
}
