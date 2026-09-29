import { C } from "../theme.js";

export const STATUSES = ["Settled", "Pending", "Overdue", "Contested"];

/* ---------------------------------------------------------------
   HELPERS
--------------------------------------------------------------- */
export const peso = (n) => `\u20B1${Number(n || 0).toLocaleString("en-PH")}`;
export const fmtDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
export const fmtTime = (d) => new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

export function statusColors(status) {
  switch (status) {
    case "Paid": return { fg: C.successDark, bg: C.successSoft, dot: C.success };
    case "Pending": return { fg: C.accentDark, bg: C.accentSoft, dot: C.accent };
    case "Overdue": return { fg: C.dangerDark, bg: C.dangerSoft, dot: C.danger };
    case "Contested": return { fg: C.infoDark, bg: C.infoSoft, dot: C.info };
    default: return { fg: C.inkSoft, bg: C.surfaceSunk, dot: C.inkFaint };
  }
}