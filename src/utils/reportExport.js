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

export const RECORD_HEADERS = [
  "Ticket No.", "Date", "Time", "Motorist", "License No.", "Plate No.",
  "Violation(s)", "Fine (PHP)", "Status", "Barangay", "Enforcer",
];

// One flat row per citation, oldest first. Used for the CSV file and the
// "Citations" sheet in Excel.
function buildRecords(citations = []) {
  return [...citations]
    .sort((a, b) => String(a.issuedAt || a.date || "").localeCompare(String(b.issuedAt || b.date || "")))
    .map(c => [
      c.ticket || "",
      c.date || "",
      c.time || "",
      c.motorist || "",
      c.license && c.license !== "No License" ? c.license : "",
      c.plateNumber || "",
      (c.violations?.length ? c.violations.map(v => v.desc).filter(Boolean).join("; ") : c.violation) || "",
      Number(c.amount ?? c.fine ?? 0),
      c.status || "Pending",
      c.barangay?.name || c.zone || "",
      c.enforcer?.name || (c.officer && c.officer !== "Unassigned" ? c.officer.replace(/^Officer /, "") : ""),
    ]);
}

export function buildReportModel({ month, year, stats, paymentStats, generatedBy, generatedAt, citations }) {
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
    records: buildRecords(citations),
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
  // One clean table (a header row, then one row per citation) so it opens
  // straight into Excel / Google Sheets and can be filtered or pivoted.
  const lines = [RECORD_HEADERS, ...m.records];
  // BOM so Excel opens UTF-8 correctly
  return "\ufeff" + lines.map(l => l.map(csvCell).join(",")).join("\r\n");
}

// ---------------- Excel ----------------
const NAVY = "FF1B2B4B";
const PESO_FMT = '"\u20B1"#,##0.00';
const thin = { style: "thin", color: { argb: "FFD0D5DD" } };
const BORDER = { top: thin, left: thin, bottom: thin, right: thin };
const STATUS_COLOR = { Paid: "FF166534", Settled: "FF166534", Pending: "FF8A5A00", Overdue: "FFB23A2E", Voided: "FF667085", Disputed: "FF1D4ED8" };

export async function toXlsxBlob(m) {
  const mod = await import("exceljs");
  const ExcelJS = mod.default || mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = m.generatedBy;
  wb.created = new Date();

  // ---------- Sheet 1: the formatted report ----------
  const ws = wb.addWorksheet("Report", {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } },
  });
  const widths = [38, 34, 14, 20];
  ws.columns = widths.map(w => ({ width: w }));
  const totalW = widths.reduce((a, b) => a + b, 0);
  const lineCount = (text, w) => Math.max(1, Math.ceil(String(text).length / (w * 1.05)));
  let r = 1;
  const merged = (text, font, height, align = "left") => {
    ws.mergeCells(r, 1, r, 4);
    const c = ws.getCell(r, 1);
    c.value = text;
    c.font = font;
    c.alignment = { vertical: "middle", horizontal: align, wrapText: true };
    if (height) ws.getRow(r).height = height;
    r++;
  };
  merged(m.org.toUpperCase(), { size: 9, color: { argb: "FF667085" } }, 16, "center");
  merged(m.title, { size: 17, bold: true, color: { argb: NAVY } }, 28, "center");
  merged(m.period, { size: 12, color: { argb: "FF475467" } }, 20, "center");
  merged(`Generated by ${m.generatedBy}  |  ${m.generatedOn}`, { size: 9, italic: true, color: { argb: "FF98A2B3" } }, 16, "center");
  r++;

  m.sections.forEach((s) => {
    // section heading with a navy underline
    ws.mergeCells(r, 1, r, 4);
    const h = ws.getCell(r, 1);
    h.value = s.title.toUpperCase();
    h.font = { size: 11, bold: true, color: { argb: NAVY } };
    h.alignment = { vertical: "bottom" };
    for (let c = 1; c <= 4; c++) ws.getCell(r, c).border = { bottom: { style: "medium", color: { argb: NAVY } } };
    ws.getRow(r).height = 22;
    r++;

    if (s.paragraph) {
      ws.mergeCells(r, 1, r, 4);
      const p = ws.getCell(r, 1);
      p.value = s.paragraph;
      p.font = { size: 10.5 };
      p.alignment = { wrapText: true, vertical: "top" };
      ws.getRow(r).height = 15 * lineCount(s.paragraph, totalW) + 6;
      r++;
    }

    if (s.headers) {
      if (!s.rows.length) {
        ws.mergeCells(r, 1, r, 4);
        const n = ws.getCell(r, 1);
        n.value = "No data available for this period.";
        n.font = { italic: true, color: { argb: "FF98A2B3" } };
        r++;
      } else {
        const cols = moneyCols(s);
        const nCols = s.headers.length;
        // 2-column tables put the value in column B; 3-4 column tables use A..D
        s.headers.forEach((hd, ci) => {
          const c = ws.getCell(r, ci + 1);
          c.value = hd;
          c.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
          c.border = BORDER;
          c.alignment = { vertical: "middle", horizontal: ci > 0 && (cols[ci] || /^(Citations|Value|Share)$/.test(hd)) ? "right" : "left" };
        });
        ws.getRow(r).height = 20;
        r++;
        s.rows.forEach((row, ri) => {
          let maxLines = 1;
          row.forEach((cell, ci) => {
            const c = ws.getCell(r, ci + 1);
            c.value = rawOf(cell);
            c.font = { size: 10.5 };
            c.border = BORDER;
            c.alignment = { vertical: "top", wrapText: true, horizontal: ci > 0 && (typeof rawOf(cell) === "number" || isMoney(cell) || /%$/.test(String(cell))) ? "right" : "left" };
            if (isMoney(cell)) c.numFmt = PESO_FMT;
            if (ri % 2 === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF6F8FB" } };
            if (typeof cell === "string") maxLines = Math.max(maxLines, lineCount(cell, widths[ci] || 14));
          });
          ws.getRow(r).height = 16 * maxLines + 2;
          r++;
        });
      }
    }
    if (s.note) {
      ws.mergeCells(r, 1, r, 4);
      const n = ws.getCell(r, 1);
      n.value = s.note;
      n.font = { size: 8.5, italic: true, color: { argb: "FF667085" } };
      n.alignment = { wrapText: true, vertical: "top" };
      ws.getRow(r).height = 12 * lineCount(s.note, totalW * 1.15) + 4;
      r++;
    }
    r++;
  });

  // ---------- Sheet 2: every citation as a filterable table ----------
  const cs = wb.addWorksheet("Citations", {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const cw = [22, 12, 9, 26, 18, 12, 44, 14, 12, 20, 22];
  cs.columns = RECORD_HEADERS.map((hd, i) => ({ header: hd, key: `c${i}`, width: cw[i] }));
  const head = cs.getRow(1);
  head.height = 24;
  head.eachCell((c, ci) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c.alignment = { vertical: "middle", horizontal: ci === 8 ? "right" : "left" };
    c.border = BORDER;
  });
  m.records.forEach((rec, i) => {
    const row = cs.addRow(rec.map((v, ci) => (ci === 1 && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(Date.UTC(+v.slice(0, 4), +v.slice(5, 7) - 1, +v.slice(8, 10))) : v)));
    row.eachCell({ includeEmpty: true }, (c, ci) => {
      c.border = BORDER;
      c.alignment = { vertical: "top", wrapText: ci === 7, horizontal: ci === 8 ? "right" : "left" };
      if (i % 2 === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF6F8FB" } };
    });
    row.getCell(2).numFmt = "dd mmm yyyy";
    row.getCell(8).numFmt = PESO_FMT;
    const color = STATUS_COLOR[rec[8]];
    if (color) row.getCell(9).font = { bold: true, color: { argb: color } };
  });
  if (m.records.length) {
    cs.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: RECORD_HEADERS.length } };
    cs.addRow([]);
    const totalRow = cs.addRow(["TOTAL", "", "", "", "", "", `${m.records.length} citation(s)`, { formula: `SUBTOTAL(109,H2:H${m.records.length + 1})` }]);
    totalRow.font = { bold: true };
    totalRow.getCell(8).numFmt = PESO_FMT;
    totalRow.getCell(8).alignment = { horizontal: "right" };
    totalRow.eachCell(c => { c.border = { top: { style: "medium", color: { argb: NAVY } } }; });
  } else {
    cs.addRow(["No citations recorded for this period."]).font = { italic: true, color: { argb: "FF98A2B3" } };
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
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
