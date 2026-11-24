import React from "react";
import { createPortal } from "react-dom";
import { Printer, X, CheckCircle2 } from "lucide-react";
import lpsoLogo from "../data/lpso_logo.png";

const peso = (n) => `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function formatPaid(value) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-PH", { year: "numeric", month: "long", day: "2-digit", hour: "numeric", minute: "2-digit", hour12: true });
}

/**
 * Payment receipt for one paid payment. Same layout the motorist sees in the
 * portal, so the office can print a copy. `citation` is optional: when it is
 * found, its full violation list and vehicle are shown.
 */
export default function ReceiptDialog({ payment, citation, onClose }) {
  if (!payment) return null;
  const receiptNo = `RCPT-${String(payment.id).replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const paidAt = payment.verifiedAt || payment.updatedAt || payment.createdAt;
  const reference = payment.referenceNumber || payment.paymongoIntentId || null;
  const method = payment.method === "qrph" || payment.source === "qrph" ? "QR Ph (PayMongo)" : (payment.method || "QR Ph");
  const vehicle = citation?.vehicle ? `${citation.vehicle.type || ""} • ${citation.vehicle.plate || ""}` : (citation?.plateNumber || "-");
  const lines = citation?.violations?.length
    ? citation.violations.map(v => ({ code: v.code, title: v.desc, fine: v.fine }))
    : [{ code: payment.violationCode || "-", title: payment.violationType, fine: payment.violationAmount ?? payment.amount }];

  return createPortal(
    <div className="receipt-overlay">
      <div className="receipt-wrap">
        <div className="receipt-actions no-print">
          <button className="et-btn" onClick={() => window.print()} style={{ background: "#102A43", color: "#fff" }}>
            <Printer size={16} /> Print / Save as PDF
          </button>
          <button className="et-btn" onClick={onClose} style={{ background: "#EEF2F7", color: "#172033" }}>
            <X size={16} /> Close
          </button>
        </div>

        <div className="receipt-paper receipt-print">
          <div className="receipt-head">
            <img src={lpsoLogo} alt="LPSO logo" />
            <div>
              <div className="receipt-org">Libmanan Public Safety Office</div>
              <h2>Payment Receipt</h2>
            </div>
          </div>
          <div className="receipt-paid"><CheckCircle2 size={18} /> PAID</div>
          <div className="receipt-amount"><span>Amount paid</span><strong>{peso(payment.amount)}</strong></div>

          <dl className="receipt-grid">
            <div><dt>Receipt no.</dt><dd>{receiptNo}</dd></div>
            <div><dt>Date and time paid</dt><dd>{formatPaid(paidAt)}</dd></div>
            <div><dt>Citation ticket no.</dt><dd>{payment.ticket}</dd></div>
            <div><dt>Payment method</dt><dd>{method}</dd></div>
            <div><dt>Motorist</dt><dd>{payment.motorist}</dd></div>
            <div><dt>Vehicle</dt><dd>{vehicle}</dd></div>
            {reference && <div className="wide"><dt>Payment reference</dt><dd className="mono">{reference}</dd></div>}
          </dl>

          <table className="receipt-table">
            <thead><tr><th>Violation</th><th className="r">Fine</th></tr></thead>
            <tbody>
              {lines.map((v, i) => (
                <tr key={`${v.code}-${i}`}><td><b>{v.code}</b><br />{v.title}</td><td className="r">{peso(v.fine)}</td></tr>
              ))}
            </tbody>
            <tfoot><tr><td>Total paid</td><td className="r">{peso(payment.amount)}</td></tr></tfoot>
          </table>

          <p className="receipt-note">
            This receipt was generated automatically after the payment was confirmed. Keep it as proof of payment.
            Questions about this payment can be raised at the LPSO office with the receipt number above.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
