// FILE PATH: AdminWeb/src/components/SmsReminderDialog.jsx  (NEW file)
import React, { useEffect, useMemo, useState } from "react";
import { X, Send } from "lucide-react";
import { C } from "../theme.js";
import { supabase } from "../lib/supabaseClient.js";

const addDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });

// Keep this wording in sync with buildMessage() in supabase/functions/send-sms-reminder/index.ts.
// "PHP" is used instead of the peso sign because non-GSM characters force a 70-character SMS segment.
export function buildPreview({ ticket, violation, amount, deadline, portalUrl }) {
  return `LPSO Libmanan: Pending citation ${ticket} for ${violation}. Fine: PHP ${Number(amount || 0).toLocaleString("en-PH")}. ` +
    `Please settle by ${fmtDate(deadline)}. Pay online: ${portalUrl}`;
}

const segments = (len) => (len <= 160 ? 1 : Math.ceil(len / 153));
const maskPhone = (p) => (p && p.length > 6 ? `${p.slice(0, 4)} ••• ${p.slice(-3)}` : p);

export default function SmsReminderDialog({ citation, onClose }) {
  const [deadline, setDeadline] = useState(addDays(7));
  const [last, setLast] = useState(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { ok, text }

  const portalUrl = import.meta.env.VITE_PORTAL_URL || "https://your-portal.example";

  useEffect(() => {
    let active = true;
    supabase
      .from("sms_log")
      .select("sent_at, status")
      .eq("citation_id", citation.id)
      .order("sent_at", { ascending: false })
      .limit(1)
      .then(({ data }) => { if (active) setLast(data?.[0] || null); });
    return () => { active = false; };
  }, [citation.id]);

  const message = useMemo(() => buildPreview({
    ticket: citation.ticket || citation.id,
    violation: citation.violation,
    amount: citation.amount,
    deadline,
    portalUrl,
  }), [citation, deadline, portalUrl]);

  const send = async () => {
    setSending(true);
    setResult(null);
    const { data, error } = await supabase.functions.invoke("send-sms-reminder", {
      body: { citation_id: citation.id, deadline },
    });
    setSending(false);
    if (error || data?.error) {
      let text = data?.error || error?.message || "Failed to send SMS.";
      try { const body = await error?.context?.json?.(); if (body?.error) text = body.error; } catch { /* keep text */ }
      setResult({ ok: false, text });
    } else {
      setResult({ ok: true, text: "SMS sent to the motorist." });
    }
  };

  const row = { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.line}`, fontSize: 12 };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(10,25,55,.35)", display: "flex", justifyContent: "center", alignItems: "center", padding: 20 }}
      onMouseDown={e => { if (e.target === e.currentTarget && !sending) onClose(); }}>
      <div style={{ width: "min(460px, 100%)", maxHeight: "90vh", overflowY: "auto", background: C.surface, borderRadius: 14, boxShadow: "0 18px 50px rgba(0,0,0,.2)" }}>
        <div style={{ padding: "16px 18px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Send SMS reminder</div>
            <div style={{ fontSize: 11, color: C.inkFaint }}>This sends one text message to the motorist.</div>
          </div>
          <button type="button" className="et-btn" onClick={onClose} style={{ padding: 6, background: "transparent", color: C.inkSoft }}><X size={18} /></button>
        </div>

        <div style={{ padding: 18 }}>
          <div style={row}><span style={{ color: C.inkSoft }}>Ticket</span><span className="et-mono">{citation.ticket || citation.id}</span></div>
          <div style={row}><span style={{ color: C.inkSoft }}>Motorist</span><span>{citation.motorist}</span></div>
          <div style={row}><span style={{ color: C.inkSoft }}>Send to</span><span>{maskPhone(citation.phone)}</span></div>
          <div style={row}><span style={{ color: C.inkSoft }}>Last reminder</span>
            <span>{last ? `${new Date(last.sent_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })} (${last.status})` : "None yet"}</span></div>

          <label style={{ display: "grid", gap: 5, fontSize: 11, color: C.inkSoft, fontWeight: 600, marginTop: 12 }}>
            Pay-by date
            <input type="date" value={deadline} min={addDays(1)} onChange={e => setDeadline(e.target.value)}
              style={{ height: 36, padding: "0 10px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 12, color: C.ink }} />
          </label>

          <div style={{ background: C.surfaceSunk, borderRadius: 8, padding: 10, fontSize: 12, lineHeight: 1.55, marginTop: 12 }}>{message}</div>
          <div style={{ fontSize: 11, color: C.inkFaint, textAlign: "right", marginTop: 4 }}>
            {message.length} characters · {segments(message.length)} SMS
          </div>

          {result && (
            <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: result.ok ? C.successSoft : C.dangerSoft, color: result.ok ? C.successDark : C.dangerDark }}>
              {result.text}
            </div>
          )}
        </div>

        <div style={{ padding: "0 18px 18px", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="et-btn" onClick={onClose} disabled={sending}
            style={{ padding: "9px 14px", borderRadius: 8, background: C.surface, border: `1px solid ${C.line}`, color: C.inkSoft }}>
            {result?.ok ? "Close" : "Cancel"}
          </button>
          {!result?.ok && (
            <button type="button" className="et-btn" onClick={send} disabled={sending || !deadline}
              style={{ padding: "9px 15px", borderRadius: 8, border: "none", background: C.accent, color: "#fff", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, opacity: sending ? 0.7 : 1 }}>
              <Send size={14} /> {sending ? "Sending..." : "Send SMS"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}