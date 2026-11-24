// Offense tracking for the admin side.
//
// An offense number counts how many times the same motorist has been cited for the same violation, in date order.
// The 1st citation for a violation is the 1st offense, the next is the 2nd.
// Voided citations are ignored. This matches the check done in the enforcer app.

export const ordinal = (n) => {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] || "th"}`;
};

const rawTime = (c) => String(c.issuedAt || `${c.date || ""}T${c.time || ""}`);
const plateKey = (c) => String(c.plateNumber || c.vehicle?.plate || "").replace(/\s+/g, "").toUpperCase();

function violationsOf(c) {
  const list = c.violations && c.violations.length ? c.violations : (c.ordinance ? [c.ordinance] : []);
  const out = [];
  const seen = new Set();
  list.forEach((v) => {
    const key = v.code || v.desc;
    if (key && !seen.has(key)) { seen.add(key); out.push({ key, label: v.desc || v.code }); }
  });
  if (!out.length && c.violation && c.violation !== "—") out.push({ key: c.violation, label: c.violation });
  return out;
}

// Same person: matched by motorist record. The plate number is used only when a
// record has no motorist link, so different people who share a plate are not merged.
const sameMotorist = (a, b) => {
  if (a.motoristId && b.motoristId) return a.motoristId === b.motoristId;
  const pa = plateKey(a);
  return !!pa && pa === plateKey(b);
};

/** @returns {Map<string, { level: number, items: {key,label,level}[] }>} keyed by citation id */
export function computeOffenses(citations) {
  const live = (citations || []).filter((c) => c.status !== "Voided");
  const sorted = [...live].sort((a, b) => rawTime(a).localeCompare(rawTime(b)) || String(a.id).localeCompare(String(b.id)));
  const byViolation = new Map();
  const result = new Map();
  sorted.forEach((c) => {
    const items = violationsOf(c).map(({ key, label }) => {
      const earlier = byViolation.get(key) || [];
      return { key, label, level: 1 + earlier.filter((p) => sameMotorist(c, p)).length };
    });
    items.forEach(({ key }) => {
      if (!byViolation.has(key)) byViolation.set(key, []);
      byViolation.get(key).push(c);
    });
    result.set(c.id, { level: items.reduce((m, i) => Math.max(m, i.level), 1), items });
  });
  return result;
}

/** every citation of the same motorist or plate (including this one), oldest first */
export function historyFor(citation, citations) {
  return (citations || [])
    .filter((c) => c.id === citation.id || sameMotorist(citation, c))
    .sort((a, b) => rawTime(a).localeCompare(rawTime(b)));
}
