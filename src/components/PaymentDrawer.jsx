import React, { useState } from "react";
import { X, CreditCard, RefreshCw, AlertCircle, BadgeCheck, CheckCircle2 } from "lucide-react";
import { C } from "../theme.js";
import { peso, fmtDate, fmtTime } from "../data/geoData.js";
import { useTrafficData } from "../context/TrafficDataContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>{children}</div>
    </div>
  );
}

function Row({ k, v, mono, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
      <span style={{ color: C.inkSoft }}>{k}</span>
      <span className={mono ? "et-mono" : ""} style={{ color: C.ink, fontWeight: bold ? 700 : 500, textAlign: "right" }}>{v}</span>
    </div>
  );
}

export const PAYMENT_STATUS_TONE = {
  pending: { bg: C.accentSoft, fg: C.accentDark },
  paid: { bg: C.successSoft, fg: C.successDark },
  failed: { bg: C.dangerSoft, fg: C.dangerDark },
  expired: { bg: C.dangerSoft, fg: C.dangerDark },
  refunded: { bg: C.infoSoft, fg: C.infoDark },
};

const SOURCE_LABELS = { qrph: "QR Ph (PayMongo)", manual: "Manually submitted reference (legacy)" };

export default function PaymentDrawer({ payment, onClose }) {
  const { refreshPaymentStatus, markPaymentPaidManually } = useTrafficData();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");
  const [error, setError] = useState("");

  const [confirmingManual, setConfirmingManual] = useState(false);
  const [manualNotes, setManualNotes] = useState("");
  const [markingPaid, setMarkingPaid] = useState(false);
  const [manualMsg, setManualMsg] = useState("");

  if (!payment) return null;
  const tone = PAYMENT_STATUS_TONE[payment.status] || PAYMENT_STATUS_TONE.pending;

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshMsg("");
    setError("");
    const result = await refreshPaymentStatus(payment.id);
    setRefreshing(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRefreshMsg(`PayMongo reports this payment as "${result.paymongoStatus}". Local status: ${result.status}.`);
  };

  const handleConfirmManualPaid = async () => {
    setMarkingPaid(true);
    setError("");
    setManualMsg("");
    const verifiedBy = user?.name || user?.email || "Admin";
    const result = await markPaymentPaidManually(payment.id, { verifiedBy, notes: manualNotes.trim() });
    setMarkingPaid(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setManualMsg("Marked as paid. Citation updated to Settled.");
    setConfirmingManual(false);
    setManualNotes("");
  };

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: 420, background: C.surface,
      borderLeft: `1px solid ${C.line}`, boxShadow: "-8px 0 24px rgba(20,30,25,0.08)",
      zIndex: 40, overflowY: "auto",
    }} className="et-drawer">
      <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div className="et-mono" style={{ fontSize: 11, color: C.inkFaint, marginBottom: 4 }}>{payment.id}</div>
          <div className="et-display" style={{ fontSize: 19, fontWeight: 600 }}>{payment.ticket}</div>
        </div>
        <button className="et-btn" onClick={onClose} style={{ background: "transparent", padding: 6, borderRadius: 6, color: C.inkSoft }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start",
          padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700,
          background: tone.bg, color: tone.fg,
        }}>
          <CreditCard size={13} /> {payment.statusLabel}
        </span>

        <Section title="Transaction">
          <Row k="Transaction ID" v={payment.id} mono />
          {payment.paymongoIntentId && <Row k="PayMongo intent ID" v={payment.paymongoIntentId} mono />}
          <Row k="Source" v={SOURCE_LABELS[payment.source] || payment.source} />
          <Row k="Payment method" v={payment.method} />
          {payment.referenceNumber && <Row k="Reference number" v={payment.referenceNumber} mono />}
          <Row k="Amount" v={peso(payment.amount)} bold />
        </Section>

        <Section title="Citation">
          <Row k="Ticket no." v={payment.ticket} mono />
          <Row k="Motorist" v={payment.motorist} />
          <Row k="Violation" v={payment.violationType} />
          {payment.violationAmount != null && <Row k="Violation amount" v={peso(payment.violationAmount)} />}
          {payment.citationStatus && <Row k="Citation status" v={payment.citationStatus} />}
        </Section>

        <Section title="Dates">
          <Row k="Created" v={`${fmtDate(new Date(payment.createdAt))}, ${fmtTime(new Date(payment.createdAt))}`} />
          <Row k="Last updated" v={`${fmtDate(new Date(payment.updatedAt))}, ${fmtTime(new Date(payment.updatedAt))}`} />
        </Section>

        {payment.verifiedBy && (
          <Section title="Verification audit trail">
            <Row k="Verified by" v={payment.verifiedBy} bold />
            {payment.verifiedAt && (
              <Row k="Verified at" v={`${fmtDate(new Date(payment.verifiedAt))}, ${fmtTime(new Date(payment.verifiedAt))}`} />
            )}
            {payment.verificationNotes && <Row k="Notes" v={payment.verificationNotes} />}
          </Section>
        )}

        {error && (
          <div style={{ padding: "10px 12px", borderRadius: 8, background: C.dangerSoft, color: C.danger, fontSize: 12.5 }}>
            {error}
          </div>
        )}

        {payment.source === "qrph" && (
          <Section title="Actions">
            <button
              className="et-btn" onClick={handleRefresh} disabled={refreshing}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 8, border: "none", background: C.accentSoft, color: C.accentDark, fontWeight: 700, fontSize: 12.5, alignSelf: "flex-start" }}
            >
              <RefreshCw size={13} className={refreshing ? "spin" : ""} /> {refreshing ? "Checking with PayMongo..." : "Refresh Payment Status"}
            </button>
            {refreshMsg && <div style={{ fontSize: 12, color: C.inkSoft }}>{refreshMsg}</div>}
            <div style={{ fontSize: 11, color: C.inkFaint }}>
              This checks the live status of this payment directly with PayMongo's servers. QR Ph payments are
              otherwise confirmed automatically by PayMongo's webhook, with zero manual step - this button is only
              a manual double-check, never how a payment normally gets marked paid.
            </div>

            {payment.status === "pending" && !manualMsg && (
              <>
                <div style={{ height: 1, background: C.line, margin: "4px 0" }} />

                {!confirmingManual ? (
                  <button
                    className="et-btn" onClick={() => setConfirmingManual(true)}
                    style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.line}`, background: "transparent", color: C.ink, fontWeight: 700, fontSize: 12.5, alignSelf: "flex-start" }}
                  >
                    <BadgeCheck size={13} /> Mark as Paid (Office Payment)
                  </button>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 11px", borderRadius: 8, background: C.surfaceSunk }}>
                    <div style={{ fontSize: 12, color: C.ink, fontWeight: 700 }}>
                      Confirm office payment
                    </div>
                    <div style={{ fontSize: 11.5, color: C.inkSoft }}>
                      Use this only when the motorist has paid in person at the LPSO office (e.g. cash). This will
                      mark the payment "Paid" and the citation "Settled" immediately, and record your name as the
                      verifying admin.
                    </div>
                    <textarea
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                      placeholder="Notes (e.g. official receipt / OR number, amount received)"
                      rows={2}
                      style={{ resize: "vertical", fontSize: 12.5, padding: "7px 9px", borderRadius: 6, border: `1px solid ${C.line}`, fontFamily: "inherit" }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="et-btn" onClick={handleConfirmManualPaid} disabled={markingPaid}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "none", background: C.successSoft, color: C.successDark, fontWeight: 700, fontSize: 12.5 }}
                      >
                        <CheckCircle2 size={13} /> {markingPaid ? "Marking paid..." : "Confirm Paid"}
                      </button>
                      <button
                        className="et-btn" onClick={() => { setConfirmingManual(false); setManualNotes(""); }} disabled={markingPaid}
                        style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: "transparent", color: C.inkSoft, fontWeight: 700, fontSize: 12.5 }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
            {manualMsg && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.successDark, fontWeight: 600 }}>
                <CheckCircle2 size={13} /> {manualMsg}
              </div>
            )}
          </Section>
        )}

        {payment.source === "manual" && (
          <Section title="Legacy manual payment">
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: C.inkSoft, background: C.surfaceSunk, borderRadius: 8, padding: "10px 11px" }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                Manual reference payments have been discontinued - QR Ph is now the only payment method and every
                payment is verified automatically. This record predates that change and has no admin action here.
              </div>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}