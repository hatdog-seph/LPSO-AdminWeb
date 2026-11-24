// Rule-based Decision Support System (DSS) for the LPSO.
//
// It reads the citation records already in the system and applies a small set
// of transparent if-then rules. Every recommendation carries the numbers it is
// based on, so an administrator can see WHY it was suggested and decide for
// themselves. Nothing here predicts the future or changes any data.

export const DEFAULT_SETTINGS = {
  hotspotSharePct: 30,   // one barangay holds at least this % of citations
  peakWindowSharePct: 40, // best 3-hour window holds at least this % of citations
  topViolationSharePct: 40, // one violation is at least this % of violations
  repeatMin: 3,          // a motorist cited this many times counts as a repeat offender
  repeatMotoristsMin: 3, // flag when at least this many repeat offenders exist
  unpaidPct: 50,         // % of aged citations still unpaid
  unpaidAgeDays: 30,     // a citation counts as "aged" after this many days
  workloadSharePct: 60,  // one enforcer issued at least this % of citations
  trendChangePct: 20,    // period-over-period change worth a look
  minSample: 10,         // minimum citations before time/pattern rules are trusted
};

export const SETTING_LABELS = {
  hotspotSharePct: ["Hotspot share (%)", "A barangay with at least this share of citations is flagged for deployment."],
  peakWindowSharePct: ["Peak-hours share (%)", "The busiest 3-hour window is flagged when it holds at least this share."],
  topViolationSharePct: ["Dominant violation share (%)", "A violation making up at least this share of all violations is flagged."],
  repeatMin: ["Repeat offender (citations)", "A motorist cited this many times counts as a repeat offender."],
  repeatMotoristsMin: ["Repeat offenders needed", "How many repeat offenders are needed before it is flagged."],
  unpaidPct: ["Unpaid share (%)", "Flagged when this share of aged citations is still unpaid."],
  unpaidAgeDays: ["Aged after (days)", "How old a citation must be before it counts as overdue."],
  workloadSharePct: ["Enforcer workload share (%)", "Flagged when one enforcer issued at least this share of citations."],
  trendChangePct: ["Trend change (%)", "A rise or fall of at least this much versus the previous period is flagged."],
  minSample: ["Minimum citations", "Time-based rules need at least this many citations to be reliable."],
};

const DAY_MS = 86400000;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PAID = new Set(["Settled", "Paid"]);

const pct = (n, d) => (d > 0 ? (n / d) * 100 : 0);
const r1 = (n) => Math.round(n * 10) / 10;
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// Hour and date are read from the stored text, because the enforcer app saves
// local time (so converting time zones in the browser would shift them).
function hourOf(c) {
  const m = /[T ](\d{2}):/.exec(String(c.issuedAt || ""));
  return m ? Number(m[1]) : null;
}
function dateOf(c) {
  const d = String(c.issuedAt || c.date || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}
const dayNum = (iso) => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY_MS);
const hourLabel = (h) => {
  const hh = ((h % 24) + 24) % 24;
  const suffix = hh >= 12 ? "PM" : "AM";
  return `${hh % 12 === 0 ? 12 : hh % 12} ${suffix}`;
};

function priorityOf(value, threshold) {
  if (!(threshold > 0)) return "Low";
  const ratio = value / threshold;
  if (ratio >= 1.5) return "High";
  if (ratio >= 1) return "Medium";
  return null; // below threshold: not a recommendation
}

export function filterByPeriod(citations, period, today = new Date()) {
  if (period === "all") return { current: citations, previous: [], label: "All time" };
  const days = period === "30" ? 30 : period === "90" ? 90 : 180;
  const t = dayNum(today.toISOString().slice(0, 10));
  const current = [], previous = [];
  citations.forEach((c) => {
    const d = dateOf(c);
    if (!d) return;
    const age = t - dayNum(d);
    if (age >= 0 && age < days) current.push(c);
    else if (age >= days && age < days * 2) previous.push(c);
  });
  return { current, previous, label: `Last ${days} days` };
}

/**
 * @param {Array} citations   citations in the selected period
 * @param {Object} opts       { previous, enforcersRegistered, settings, today }
 * @returns {{ insights, normal, summary, facts }}
 */
export function generateInsights(citations, opts = {}) {
  const s = { ...DEFAULT_SETTINGS, ...(opts.settings || {}) };
  const previous = opts.previous || [];
  const registered = opts.enforcersRegistered || 0;
  const today = opts.today || new Date();
  const total = citations.length;
  const insights = [];
  const normal = [];

  const add = (item, value, threshold) => {
    const priority = priorityOf(value, threshold);
    if (priority) insights.push({ ...item, priority });
    else normal.push({ area: item.area, note: item.normalNote || item.finding });
  };

  if (total === 0) {
    return {
      insights: [], normal: [],
      summary: "No citations were recorded in this period, so there is nothing to base a recommendation on.",
      facts: { total: 0 },
    };
  }

  // ---- 1. WHERE to deploy: barangay concentration -------------------------
  const byBrgy = new Map();
  citations.forEach((c) => {
    const name = c.zone && c.zone !== "Unmapped" ? c.zone : null;
    if (name) byBrgy.set(name, (byBrgy.get(name) || 0) + 1);
  });
  const mapped = [...byBrgy.values()].reduce((a, b) => a + b, 0);
  const brgyRank = [...byBrgy.entries()].sort((a, b) => b[1] - a[1]);
  if (brgyRank.length) {
    const [topName, topCount] = brgyRank[0];
    const share = pct(topCount, mapped);
    const next = brgyRank.slice(1, 3).map(([n, k]) => `${n} (${k})`).join(", ");
    add({
      id: "deploy-where", category: "Enforcer deployment", area: "Where to deploy",
      finding: `${topName} recorded ${plural(topCount, "citation")}, ${r1(share)}% of the ${mapped} citations with a location.` + (next ? ` Next: ${next}.` : ""),
      recommendation: `Assign more enforcers or regular patrols to ${topName}, and review its traffic signage and enforcement hours.`,
      evidence: brgyRank.slice(0, 5).map(([n, k]) => `${n}: ${k} (${r1(pct(k, mapped))}%)`),
      normalNote: `No single barangay dominates (highest is ${topName} at ${r1(share)}%, below the ${s.hotspotSharePct}% threshold).`,
    }, share, s.hotspotSharePct);
  }

  // ---- 2. WHEN to deploy: busiest 3-hour window and weekday ----------------
  const hours = new Array(24).fill(0);
  let timed = 0;
  const weekdays = new Array(7).fill(0);
  citations.forEach((c) => {
    const h = hourOf(c);
    if (h !== null) { hours[h] += 1; timed += 1; }
    const d = dateOf(c);
    if (d) weekdays[new Date(`${d}T00:00:00Z`).getUTCDay()] += 1;
  });
  if (timed >= s.minSample) {
    let best = { start: 0, count: -1 };
    for (let h = 0; h < 24; h++) {
      const count = hours[h] + hours[(h + 1) % 24] + hours[(h + 2) % 24];
      if (count > best.count) best = { start: h, count };
    }
    const share = pct(best.count, timed);
    const topDay = weekdays.indexOf(Math.max(...weekdays));
    add({
      id: "deploy-when", category: "Enforcer deployment", area: "When to deploy",
      finding: `${r1(share)}% of citations were issued between ${hourLabel(best.start)} and ${hourLabel(best.start + 3)}. The busiest weekday is ${WEEKDAYS[topDay]} (${weekdays[topDay]} citations).`,
      recommendation: `Schedule patrol shifts to cover ${hourLabel(best.start)}–${hourLabel(best.start + 3)}, especially on ${WEEKDAYS[topDay]}s, and use quieter hours for rest or other duties.`,
      evidence: WEEKDAYS.map((d, i) => `${d}: ${weekdays[i]}`),
      normalNote: `Citations are spread across the day (busiest window holds ${r1(share)}%, below the ${s.peakWindowSharePct}% threshold).`,
    }, share, s.peakWindowSharePct);
  } else {
    normal.push({ area: "When to deploy", note: `Only ${timed} citation(s) with a time recorded; at least ${s.minSample} are needed for a reliable pattern.` });
  }

  // ---- 3. WHICH violation to address: dominant violation -------------------
  const viol = new Map();
  let violTotal = 0;
  citations.forEach((c) => {
    const list = c.violations && c.violations.length ? c.violations : (c.ordinance ? [c.ordinance] : []);
    list.forEach((v) => {
      const key = v.desc || v.code || "Unknown";
      viol.set(key, (viol.get(key) || 0) + 1);
      violTotal += 1;
    });
  });
  const violRank = [...viol.entries()].sort((a, b) => b[1] - a[1]);
  if (violRank.length) {
    const [vName, vCount] = violRank[0];
    const share = pct(vCount, violTotal);
    add({
      id: "policy-violation", category: "Policy formulation", area: "Most common violation",
      finding: `"${vName}" accounts for ${r1(share)}% of all violations (${vCount} of ${violTotal}).`,
      recommendation: `Consider a targeted information campaign or stricter enforcement for "${vName}", and review whether the current penalty is discouraging it.`,
      evidence: violRank.slice(0, 5).map(([n, k]) => `${n}: ${k} (${r1(pct(k, violTotal))}%)`),
      normalNote: `Violations are varied (most common is "${vName}" at ${r1(share)}%, below the ${s.topViolationSharePct}% threshold).`,
    }, share, s.topViolationSharePct);
  }

  // ---- 4. WHO to target: repeat offenders ----------------------------------
  const byMotorist = new Map();
  citations.forEach((c) => {
    if (!c.motoristId) return;
    const e = byMotorist.get(c.motoristId) || { name: c.motorist || "Unknown", count: 0 };
    e.count += 1;
    byMotorist.set(c.motoristId, e);
  });
  const repeaters = [...byMotorist.values()].filter(m => m.count >= s.repeatMin).sort((a, b) => b.count - a.count);
  add({
    id: "policy-repeat", category: "Policy formulation", area: "Repeat offenders",
    finding: `${plural(repeaters.length, "motorist")} ${repeaters.length === 1 ? "has" : "have"} been cited ${s.repeatMin} or more times in this period.`,
    recommendation: "Consider a mandatory road-safety seminar, escalating penalties for repeat violations, or a watch list for follow-up.",
    evidence: repeaters.slice(0, 5).map(m => `${m.name}: ${m.count} citations`),
    normalNote: `${plural(repeaters.length, "repeat offender")} found; below the ${s.repeatMotoristsMin} needed to flag a pattern.`,
  }, repeaters.length, s.repeatMotoristsMin);

  // ---- 5. Do the penalties work: unpaid, aged citations --------------------
  const t = dayNum(today.toISOString().slice(0, 10));
  const aged = citations.filter((c) => {
    const d = dateOf(c);
    return d && t - dayNum(d) >= s.unpaidAgeDays && c.status !== "Voided";
  });
  if (aged.length) {
    const unpaid = aged.filter(c => !PAID.has(c.status));
    const share = pct(unpaid.length, aged.length);
    const amount = unpaid.reduce((a, c) => a + (Number(c.amount ?? c.fine) || 0), 0);
    add({
      id: "policy-unpaid", category: "Policy formulation", area: "Unpaid citations",
      finding: `${unpaid.length} of ${aged.length} citations older than ${s.unpaidAgeDays} days are still unpaid (${r1(share)}%), worth PHP ${amount.toLocaleString("en-PH")}.`,
      recommendation: "Send SMS reminders, make QR Ph payment more visible on the ticket, and consider a payment deadline with a clear consequence.",
      evidence: [`Unpaid: ${unpaid.length}`, `Paid: ${aged.length - unpaid.length}`, `Outstanding amount: PHP ${amount.toLocaleString("en-PH")}`],
      normalNote: `Most aged citations are being paid (${r1(share)}% unpaid, below the ${s.unpaidPct}% threshold).`,
    }, share, s.unpaidPct);
  } else {
    normal.push({ area: "Unpaid citations", note: `No citations older than ${s.unpaidAgeDays} days in this period yet.` });
  }

  // ---- 6. Workload balance among enforcers ---------------------------------
  const byEnf = new Map();
  citations.forEach((c) => {
    const name = (c.enforcer?.name || (c.officer || "").replace(/^Officer /, "")) || "Unassigned";
    byEnf.set(name, (byEnf.get(name) || 0) + 1);
  });
  const enfRank = [...byEnf.entries()].sort((a, b) => b[1] - a[1]);
  if (enfRank.length) {
    const [eName, eCount] = enfRank[0];
    const share = pct(eCount, total);
    const others = Math.max(registered, enfRank.length) - 1;
    if (others >= 1) {
      add({
        id: "deploy-workload", category: "Enforcer deployment", area: "Enforcer workload",
        finding: `${eName} issued ${r1(share)}% of citations (${eCount} of ${total}). ${plural(enfRank.length, "enforcer")} issued citations out of ${Math.max(registered, enfRank.length)} registered.`,
        recommendation: "Rebalance patrol assignments so enforcement does not depend on one or two people, and rotate coverage areas and shifts.",
        evidence: enfRank.slice(0, 5).map(([n, k]) => `${n}: ${k} (${r1(pct(k, total))}%)`),
        normalNote: `Workload is spread out (busiest enforcer issued ${r1(share)}%, below the ${s.workloadSharePct}% threshold).`,
      }, share, s.workloadSharePct);
    }
  }

  // ---- 7. Trend versus the previous period ---------------------------------
  if (previous.length >= 3) {
    const change = ((total - previous.length) / previous.length) * 100;
    const up = change >= 0;
    add({
      id: "trend", category: "Policy formulation", area: "Trend",
      finding: `Citations ${up ? "rose" : "fell"} ${r1(Math.abs(change))}% compared with the previous period (${previous.length} before, ${total} now).`,
      recommendation: up
        ? "Check what changed (more patrols, a new ordinance, an event) and whether the rise is a real increase in violations or just more enforcement."
        : "Check whether the drop is better compliance or reduced patrol activity before drawing conclusions.",
      evidence: [`Previous period: ${previous.length}`, `This period: ${total}`],
      normalNote: `Volume is steady (${up ? "+" : "-"}${r1(Math.abs(change))}% versus the previous period, below the ${s.trendChangePct}% threshold).`,
    }, Math.abs(change), s.trendChangePct);
  }

  // ---- Data quality: citations without a location --------------------------
  const noGps = total - mapped;
  if (noGps > 0 && pct(noGps, total) >= 20) {
    insights.push({
      id: "data-gps", category: "Data quality", area: "Missing locations", priority: pct(noGps, total) >= 40 ? "High" : "Medium",
      finding: `${noGps} of ${total} citations (${r1(pct(noGps, total))}%) have no usable location, so they are left out of the hotspot rules.`,
      recommendation: "Remind enforcers to wait for the GPS lock before saving a citation so hotspot recommendations stay accurate.",
      evidence: [`With location: ${mapped}`, `Without location: ${noGps}`],
    });
  }

  const order = { High: 0, Medium: 1, Low: 2 };
  insights.sort((a, b) => order[a.priority] - order[b.priority]);

  const high = insights.filter(i => i.priority === "High");
  const summary = insights.length === 0
    ? `Across ${total} citations, no rule crossed its threshold. Enforcement looks balanced for this period.`
    : `${plural(insights.length, "recommendation")} for ${total} citations` +
      (high.length ? `; ${high.length} ${high.length === 1 ? "is" : "are"} high priority: ${high.map(h => h.area.toLowerCase()).join(", ")}.` : ", none high priority.");

  return { insights, normal, summary, facts: { total, mapped, timed } };
}

/** Same shape the report exporter uses, so PDF / Word / Excel / CSV all work. */
export function buildInsightsModel({ result, settings, periodLabel, generatedBy, generatedAt }) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const stamp = generatedAt.toISOString().slice(0, 10);
  return {
    org: "Libmanan Public Safety Office",
    title: "LPSO Policy Insights (Decision Support)",
    period: periodLabel,
    fileBase: `LPSO-Policy-Insights-${stamp}`,
    generatedBy,
    generatedOn: generatedAt.toLocaleString("en-PH"),
    widths: [12, 24, 62, 62],
    csv: {
      headers: ["Priority", "Category", "Area", "Finding", "Recommended action", "Evidence"],
      rows: result.insights.map(i => [i.priority, i.category, i.area, i.finding, i.recommendation, (i.evidence || []).join("; ")]),
    },
    sections: [
      { title: "Summary", paragraph: result.summary },
      {
        title: "Recommendations", headers: ["Priority", "Area", "Finding", "Recommended action"],
        rows: result.insights.map(i => [i.priority, i.area, i.finding, i.recommendation]),
        note: "Recommendations come from simple rules applied to the citation records. They support, and do not replace, the judgment of LPSO officials.",
      },
      {
        title: "Within normal range", headers: ["Area", "Note"],
        rows: result.normal.map(n => [n.area, n.note]),
      },
      {
        title: "Thresholds used", headers: ["Setting", "Value"],
        rows: Object.keys(SETTING_LABELS).map(k => [SETTING_LABELS[k][0], s[k]]),
      },
    ],
  };
}
