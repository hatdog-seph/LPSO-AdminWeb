export function filterCitationsByRange(citations, from, to) {
  if (!from && !to) return citations;
  return citations.filter(c => {
    if (!c.date) return false;
    if (from && c.date < from) return false;
    if (to && c.date > to) return false;
    return true;
  });
}

export function computeAnalytics(citations) {
  let totalFine = 0;
  let settledAmount = 0;
  let pendingAmount = 0;
  const motoristSet = new Set();
  const violationMap = new Map();
  const statusMap = new Map();
  const barangayMap = new Map();
  const monthMap = new Map();

  citations.forEach(c => {
    const amount = Number(c.amount) || 0;
    totalFine += amount;
    if (c.status === "Settled") settledAmount += amount;
    else pendingAmount += amount;

    if (c.motoristId) motoristSet.add(c.motoristId);

    const violations = (c.violations && c.violations.length)
      ? c.violations
      : (c.ordinance ? [c.ordinance] : []);
    violations.forEach(v => {
      const key = v.code || v.desc || "unknown";
      const entry = violationMap.get(key) || { code: v.code || "—", desc: v.desc || "Unknown violation", count: 0, fine: 0 };
      entry.count += 1;
      entry.fine += Number(v.fine) || 0;
      violationMap.set(key, entry);
    });

    const status = c.status || "Unknown";
    statusMap.set(status, (statusMap.get(status) || 0) + 1);

    const zone = c.zone || "Unmapped";
    barangayMap.set(zone, (barangayMap.get(zone) || 0) + 1);

    if (c.date) {
      const month = c.date.slice(0, 7);
      monthMap.set(month, (monthMap.get(month) || 0) + 1);
    }
  });

  const violationFrequency = [...violationMap.values()].sort((a, b) => b.count - a.count);
  const statusBreakdown = [...statusMap.entries()].map(([status, count]) => ({ status, count }));
  const barangayDistribution = [...barangayMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const monthlyTrend = [...monthMap.entries()]
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    total: citations.length,
    totalFine,
    settledAmount,
    pendingAmount,
    uniqueMotorists: motoristSet.size,
    violationFrequency,
    statusBreakdown,
    barangayDistribution,
    monthlyTrend,
  };
}

export function monthLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}