// FILE PATH: AdminWeb/src/components/BulkSmsDialog.jsx  (NEW file)
import React, { useEffect, useMemo, useState } from "react";
import { X, Send } from "lucide-react";
import { C } from "../theme.js";
import { supabase } from "../lib/supabaseClient.js";
import { buildPreview } from "./SmsReminderDialog.jsx";

const addDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });

// Same rule the Edge Function uses: 09XXXXXXXXX, +639XXXXXXXXX or 639XXXXXXXXX
const validPhone = (p) => /^(09\d{9}|\+?639\d{9})$/.test(String(p || "").replace(/[\s-]/g, ""));
const segments = (len) => (len <= 160 ? 1 : Math.ceil(len / 153));

async function sendReminder(citationId, deadline) {
  const { data, error } = await supabase.functions.invoke("send-sms-reminder", {
    body: { citation_id: citationId, deadline },
  });
  if (!error && !data?.error) return { ok: true };
  let text = data?.error || error?.message || "Failed to send.";
  try { const body = await error?.context?.json?.(); if (body?.error) text = body.error; } catch { /* keep text */ }
  return { ok: false, text };
}

export default function BulkSmsDialog({ citations, onClose }) {
  const [deadline, setDeadline] = useState(addDays(7));
  const [recentIds, setRecentIds] = useState(null); // null = still loading
  const [phase, setPhase] = useState("confirm");    // confirm | sending | done
  const [done, setDone] = useState(0);
  const [sent, setSent] = useState(0);
  const [failures, setFailures] = useState([]);

  const portalUrl = import.meta.env.VITE_PORTAL_URL || "https://your-portal.example";

  // Citations that already got a reminder in the last 24 hours (the server skips these too).
  useEffect(() => {
    let active = true;
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    supabase.from("sms_log").select("citation_id").in("status", ["queued", "sent"]).gte("sent_at", since)
      .then(({ data }) => { if (active) setRecentIds(new Set((data || []).map(r => r.citation_id))); });
    return () => { active = false; };
  }, []);

  const pending = useMemo(() => citations.filter(c => c.status === "Pending"), [citations]);
  const noPhone = useMemo(() => pending.filter(c => !validPhone(c.phone)), [pending]);
  const recent = useMemo(() => pending.filter(c => validPhone(c.phone) && recentIds?.has(c.id)), [pending, recentIds]);
  const eligible = useMemo(() => pending.filter(c => validPhone(c.phone) && !recentIds?.has(c.id)), [pending, recentIds]);

  const sampleMessage = buildPreview({ ticket: "[ticket]", violation: "[violation]", amount: 0, deadline, portalUrl })
    .replace("PHP 0", "PHP [amount]");
  const totalSms = useMemo(() => eligible.reduce((sum, c) =>
    sum + segments(buildPreview({ ticket: c.ticket || c.id, violation: c.violation, amount: c.amount, deadline, portalUrl }).length), 0),
  [eligible, deadline, portalUrl]);

  const start = async () => {
    setPhase("sending"); setDone(0); setSent(0); setFailures([]);
    let ok = 0;
    const failed = [];
    for (let i = 0; i < eligible.length; i++) {
      const c = eligible[i];
      const res = await sendReminder(c.id, deadline);
      if (res.ok) ok++; else failed.push({ ticket: c.ticket || c.id, reason: res.text });
      setDone(i + 1); setSent(ok); setFailures([...failed]);
    }
    setPhase("done");
  };

  const busy = phase === "sending";
  const row = { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.line}`, fontSize: 12 };
  const stat = (n, label, bg, fg) => (
    <div style={{ flex: 1, borderRadius: 10, padding: 10, textAlign: "center", background: bg, color: fg }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{n}</div><div style={{ fontSize: 11 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(10,25,55,.35)", display: "flex", justifyContent: "center", alignItems: "center", padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div style={{ width: "min(480px, 100%)", maxHeight: "90vh", overflowY: "auto", background: C.surface, borderRadius: 14, boxShadow: "0 18px 50px rgba(0,0,0,.2)" }}>
        <div style={{ padding: "16px 18px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {phase === "confirm" ? "Send SMS to pending citations" : phase === "sending" ? "Sending SMS..." : "SMS sending finished"}
            </div>
            <div style={{ fontSize: 11, color: C.inkFaint }}>
              {phase === "sending" ? "Please keep this window open." : "One text per pending citation."}
            </div>
          </div>
          {!busy && <button type="button" className="et-btn" onClick={onClose} style={{ padding: 6, background: "transparent", color: C.inkSoft }}><X size={18} /></button>}
        </div>

        <div style={{ padding: 18 }}>
          {phase === "confirm" && (recentIds === null ? (
            <div style={{ fontSize: 12, color: C.inkSoft }}>Checking recent reminders...</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                {stat(eligible.length, "Will be sent", C.successSoft, C.successDark)}
                {stat(noPhone.length + recent.length, "Skipped", C.surfaceSunk, C.inkSoft)}
              </div>
              <div style={row}><span style={{ color: C.inkSoft }}>Pending citations</span><span>{pending.length}</span></div>
              <div style={row}><span style={{ color: C.inkSoft }}>No valid phone number</span><span>{noPhone.length}</span></div>
              <div style={row}><span style={{ color: C.inkSoft }}>Reminded in last 24 hours</span><span>{recent.length}</span></div>

              <label style={{ display: "grid", gap: 5, fontSize: 11, color: C.inkSoft, fontWeight: 600, marginTop: 12 }}>
                Pay-by date
                <input type="date" value={deadline} min={addDays(1)} onChange={e => setDeadline(e.target.value)}
                  style={{ height: 36, padding: "0 10px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 12, color: C.ink }} />
              </label>
              <div style={{ background: C.surfaceSunk, borderRadius: 8, padding: 10, fontSize: 12, lineHeight: 1.55, marginTop: 12 }}>{sampleMessage}</div>
              <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 4 }}>
                {eligible.length} messages · {totalSms} SMS in total (due {fmtDate(deadline)})
              </div>
              <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, fontSize: 12, background: C.accentSoft, color: C.accentDark }}>
                {eligible.length
                  ? `This will text ${eligible.length} motorist${eligible.length === 1 ? "" : "s"} right away. It cannot be undone.`
                  : "No pending citation can be texted right now."}
              </div>
            </>
          ))}

          {phase !== "confirm" && (
            <>
              <div style={{ fontSize: 12, color: C.inkSoft }}>{done} of {eligible.length} processed</div>
              <div style={{ height: 8, borderRadius: 4, background: C.line, margin: "6px 0 10px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${eligible.length ? (done / eligible.length) * 100 : 100}%`, background: C.success, transition: "width .2s" }} />
              </div>
              <div style={{ padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: C.successSoft, color: C.successDark }}>{sent} sent successfully</div>
              {failures.length > 0 && (
                <div style={{ marginTop: 6, padding: "8px 10px", borderRadius: 8, fontSize: 12, background: C.dangerSoft, color: C.dangerDark }}>
                  <b>{failures.length} failed</b>
                  {failures.map(f => <div key={f.ticket} style={{ marginTop: 3 }}><span className="et-mono">{f.ticket}</span>: {f.reason}</div>)}
                </div>
              )}
              <div style={{ ...row, marginTop: 8 }}><span style={{ color: C.inkSoft }}>Skipped, no valid phone</span><span>{noPhone.length}</span></div>
              <div style={row}><span style={{ color: C.inkSoft }}>Skipped, reminded recently</span><span>{recent.length}</span></div>
            </>
          )}
        </div>

        <div style={{ padding: "0 18px 18px", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {phase === "confirm" && <>
            <button type="button" className="et-btn" onClick={onClose}
              style={{ padding: "9px 14px", borderRadius: 8, background: C.surface, border: `1px solid ${C.line}`, color: C.inkSoft }}>Cancel</button>
            <button type="button" className="et-btn" onClick={start} disabled={!eligible.length || recentIds === null || !deadline}
              style={{ padding: "9px 15px", borderRadius: 8, border: "none", background: C.accent, color: "#fff", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, opacity: eligible.length ? 1 : 0.4 }}>
              <Send size={14} /> Send {eligible.length} SMS
            </button>
          </>}
          {phase === "done" && <button type="button" className="et-btn" onClick={onClose}
            style={{ padding: "9px 14px", borderRadius: 8, background: C.surface, border: `1px solid ${C.line}`, color: C.inkSoft }}>Close</button>}
        </div>
      </div>
    </div>
  );
}