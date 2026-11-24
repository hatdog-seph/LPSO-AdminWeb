// Builds the monthly report as plain data, then writes it as CSV, Excel,
// Word or PDF. Heavy libraries are loaded only when that format is chosen.
//
// A cell is a string/number, or { money: n } (a peso amount). CSV and Excel
// keep money as real numbers; Word and PDF show "PHP 1,234.00" because the
// built-in PDF font has no peso sign.

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const php = (n) => `PHP ${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const money = (n) => ({ money: Number(n) || 0 });
const isMoney = (c) => c && typeof c === "object" && "money" in c;
const textOf = (c) => (isMoney(c) ? php(c.money) : c == null ? "" : String(c));
const rawOf = (c) => (isMoney(c) ? c.money : c == null ? "" : c);

export function buildReportModel({ month, year, stats, paymentStats, generatedBy, generatedAt }) {
  const pct = (n) => `${((n / stats.total) * 100 || 0).toFixed(1)}%`;
  const topBrgy = stats.barangayDistribution[0];
  const topViol = stats.violationFrequency[0];
  const note = stats.total === 0
    ? "No citations were recorded for this month."
    : `${topBrgy?.name || "No location data"} recorded the highest number of citations this month ` +
      `(${topBrgy?.count || 0}), and ${topViol?.desc || "no dominant violation"} was the most frequently cited ` +
      `violation (${topViol?.count || 0} occurrences). This may indicate a priority area/violation for enforcer deployment planning.`;

  return {
    org: "Libmanan Public Safety Office",
    title: "LPSO Monthly Traffic Citation Report",
    period: `${MONTHS[month]} ${year}`,
    fileBase: `LPSO-Monthly-Report-${year}-${String(month + 1).padStart(2, "0")}`,
    generatedBy,
    generatedOn: generatedAt.toLocaleString("en-PH"),
    sections: [
      {
        title: "Summary", headers: ["Metric", "Value"],
        rows: [
          ["Total citations issued", stats.total],
          ["Motorists cited", stats.uniqueMotorists],
          ["Total fines", money(stats.totalFine)],
          ["Settled amount", money(stats.settledAmount)],
          ["Pending amount", money(stats.pendingAmount)],
        ],
      },
      {
        title: "Citation status summary", headers: ["Status", "Citations", "Share"],
        rows: stats.statusBreakdown.map(s => [s.status, s.count, pct(s.count)]),
      },
      {
        title: "Most common violations", headers: ["Code", "Description", "Citations", "Total fines"],
        rows: stats.violationFrequency.map(v => [v.code, v.desc, v.count, money(v.fine)]),
      },
      {
        title: "Citations by barangay", headers: ["Barangay", "Citations"],
        rows: stats.barangayDistribution.map(b => [b.name, b.count]),
        note: "Barangay is derived by matching each citation's GPS coordinates to the nearest known barangay. Citations without GPS are not included.",
      },
      {
        title: "Payment summary", headers: ["Metric", "Value"],
        rows: [
          ["Total citations", stats.total],
          ["Verified payments", paymentStats.paidCount],
          ["Total amount collected", money(paymentStats.verifiedAmount)],
          ["Pending payments", paymentStats.pendingCount],
          ["Failed payments", paymentStats.failedCount],
          ["Refunded payments", paymentStats.refundedCount],
        ],
        note: "Figures come from the payment ledger (PayMongo QR Ph transactions verified by webhook or server-side status check). Each transaction is counted once.",
      },
      {
        title: "Monthly payment breakdown", headers: ["Metric", "Value"],
        rows: [
          ["Total violation amount (issued)", money(stats.totalFine)],
          ["Total verified amount paid", money(paymentStats.verifiedAmount)],
          ["Number of paid tickets", paymentStats.paidCount],
          ["Pending payments", paymentStats.pendingCount],
          ["Failed payments", paymentStats.failedCount],
          ["Refunded amount", money(paymentStats.refundedAmount)],
        ],
        note: "Total violation amount is the value of citations issued this month regardless of payment status. Total verified amount paid is what was actually collected. They are different figures and should not be added together.",
      },
      { title: "Trends and planning notes", paragraph: note },
    ],
  };
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// a column is right-aligned when any of its cells is a peso amount
const moneyCols = (s) => (s.headers || []).map((_, ci) => s.rows.some(r => isMoney(r[ci])));

// ---------------- CSV ----------------
const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(m) {
  const lines = [
    [m.org], [m.title], [m.period], [`Generated by: ${m.generatedBy}`, `Generated on: ${m.generatedOn}`], [],
  ];
  m.sections.forEach((s) => {
    lines.push([s.title.toUpperCase()]);
    if (s.paragraph) lines.push([s.paragraph]);
    if (s.headers) lines.push(s.headers);
    (s.rows || []).forEach(r => lines.push(r.map(rawOf)));
    if (s.note) lines.push([s.note]);
    lines.push([]);
  });
  // BOM so Excel opens UTF-8 correctly
  return "﻿" + lines.map(l => l.map(csvCell).join(",")).join("\r\n");
}

// ---------------- Excel ----------------
export async function toXlsxBlob(m) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const used = new Set();
  const sheetName = (t) => {
    let n = t.replace(/[\\/?*[\]:]/g, " ").slice(0, 28);
    let i = 2, base = n;
    while (used.has(n)) n = `${base.slice(0, 25)} ${i++}`;
    used.add(n);
    return n;
  };
  m.sections.forEach((s) => {
    const aoa = [[m.title], [m.period], []];
    if (s.paragraph) aoa.push([s.paragraph]);
    if (s.headers) aoa.push(s.headers);
    (s.rows || []).forEach(r => aoa.push(r.map(rawOf)));
    if (s.note) aoa.push([], [s.note]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const widths = (s.headers || ["", ""]).map((h, ci) => ({
      wch: Math.min(60, Math.max(String(h).length, ...(s.rows || []).map(r => textOf(r[ci]).length), 12)),
    }));
    ws["!cols"] = widths;
    // peso format on money cells
    (s.rows || []).forEach((r, ri) => r.forEach((c, ci) => {
      if (isMoney(c)) {
        const addr = XLSX.utils.encode_cell({ r: 3 + (s.paragraph ? 1 : 0) + 1 + ri, c: ci });
        if (ws[addr]) ws[addr].z = '"PHP" #,##0.00';
      }
    }));
    XLSX.utils.book_append_sheet(wb, ws, sheetName(s.title));
  });
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// ---------------- Word ----------------
export async function toDocxBlob(m) {
  const d = await import("docx");
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, BorderStyle } = d;
  const kids = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: m.org.toUpperCase(), size: 18, color: "666666" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: m.title, bold: true, size: 36 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: m.period, size: 24, color: "444444" })] }),
  ];
  const cell = (text, header, right) => new TableCell({
    width: { size: 100, type: WidthType.AUTO },
    shading: header ? { fill: "E8ECF3" } : undefined,
    children: [new Paragraph({ alignment: right ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text: String(text), bold: !!header, size: 20 })] })],
  });
  m.sections.forEach((s) => {
    kids.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 100 }, children: [new TextRun({ text: s.title, bold: true, size: 26 })] }));
    if (s.paragraph) kids.push(new Paragraph({ children: [new TextRun({ text: s.paragraph, size: 21 })] }));
    if (s.headers) {
      if (!s.rows.length) {
        kids.push(new Paragraph({ children: [new TextRun({ text: "No data available for this period.", italics: true, size: 20, color: "888888" })] }));
      } else {
        kids.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ tableHeader: true, children: s.headers.map((h, ci) => cell(h, true, moneyCols(s)[ci])) }),
            ...s.rows.map(r => new TableRow({ children: r.map((c, ci) => cell(textOf(c), false, moneyCols(s)[ci])) })),
          ],
        }));
      }
    }
    if (s.note) kids.push(new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: s.note, italics: true, size: 17, color: "777777" })] }));
  });
  kids.push(new Paragraph({
    spacing: { before: 400 },
    border: { top: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC", space: 6 } },
    children: [new TextRun({ text: `Generated by: ${m.generatedBy}     Generated on: ${m.generatedOn}`, size: 17, color: "777777" })],
  }));
  const doc = new Document({ sections: [{ children: kids }] });
  return Packer.toBlob(doc);
}

// ---------------- PDF ----------------
export async function toPdfBlob(m) {
  const { jsPDF } = await import("jspdf");
  const atMod = await import("jspdf-autotable");
  const autoTable = [atMod.default?.default, atMod.default, atMod.autoTable].find(f => typeof f === "function");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 48;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(110);
  doc.text(m.org.toUpperCase(), W / 2, y, { align: "center" }); y += 20;
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(20);
  doc.text(m.title, W / 2, y, { align: "center" }); y += 18;
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(70);
  doc.text(m.period, W / 2, y, { align: "center" }); y += 14;
  doc.setDrawColor(30); doc.setLineWidth(1); doc.line(40, y, W - 40, y); y += 22;

  const ensure = (need) => { if (y + need > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); y = 48; } };
  m.sections.forEach((s) => {
    ensure(60);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(60);
    doc.text(s.title.toUpperCase(), 40, y); y += 8;
    doc.setDrawColor(200); doc.line(40, y, W - 40, y); y += 10;
    if (s.paragraph) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(30);
      const lines = doc.splitTextToSize(s.paragraph, W - 80);
      ensure(lines.length * 13);
      doc.text(lines, 40, y + 4); y += lines.length * 13 + 8;
    }
    if (s.headers) {
      if (!s.rows.length) {
        doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(140);
        doc.text("No data available for this period.", 40, y + 4); y += 22;
      } else {
        autoTable(doc, {
          startY: y, margin: { left: 40, right: 40 },
          head: [s.headers], body: s.rows.map(r => r.map(textOf)),
          styles: { fontSize: 9, cellPadding: 4 },
          headStyles: { fillColor: [232, 236, 243], textColor: 30 },
          didParseCell: (d) => {
            if (moneyCols(s)[d.column.index]) d.cell.styles.halign = "right";
          },
        });
        y = doc.lastAutoTable.finalY + 8;
      }
    }
    if (s.note) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(120);
      const lines = doc.splitTextToSize(s.note, W - 80);
      ensure(lines.length * 10);
      doc.text(lines, 40, y + 4); y += lines.length * 10 + 6;
    }
    y += 12;
  });
  ensure(30);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120);
  doc.setDrawColor(200); doc.line(40, y, W - 40, y);
  doc.text(`Generated by: ${m.generatedBy}`, 40, y + 14);
  doc.text(`Generated on: ${m.generatedOn}`, W - 40, y + 14, { align: "right" });
  return doc.output("blob");
}

export const EXPORT_FORMATS = [
  { id: "pdf", label: "PDF file (.pdf)" },
  { id: "docx", label: "Word file (.docx)" },
  { id: "xlsx", label: "Excel file (.xlsx)" },
  { id: "csv", label: "CSV file (.csv)" },
];

export async function exportReport(format, model) {
  if (format === "csv") return download(new Blob([toCsv(model)], { type: "text/csv;charset=utf-8" }), `${model.fileBase}.csv`);
  if (format === "xlsx") return download(await toXlsxBlob(model), `${model.fileBase}.xlsx`);
  if (format === "docx") return download(await toDocxBlob(model), `${model.fileBase}.docx`);
  if (format === "pdf") return download(await toPdfBlob(model), `${model.fileBase}.pdf`);
  throw new Error(`Unknown format: ${format}`);
}
