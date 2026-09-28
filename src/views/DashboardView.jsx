import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  Ticket,
  Clock,
  TrendingUp,
  ShieldCheck,
  Users,
  ChevronRight,
} from "lucide-react";

import { C } from "../theme.js";
import {
  STATUSES,
  peso,
  statusColors,
} from "../data/geoData.js";

import PageHeader from "../components/PageHeader.jsx";
import Panel from "../components/Panel.jsx";
import TicketStat from "../components/TicketStat.jsx";
import StatusPill from "../components/StatusPill.jsx";
import HotspotMap from "../components/HotspotMap.jsx";
import { useTrafficData } from "../context/TrafficDataContext.jsx";

/* ---------------------------------
   TABLE CELL STYLE
---------------------------------- */

const cellStyle = {
  padding: "10px",
  borderBottom: `1px solid ${C.line}`,
  color: C.ink,
  verticalAlign: "middle",
};

/* ---------------------------------
   HELPERS
---------------------------------- */

function distanceKm(a, b) {
  if (!Array.isArray(a) || a.length < 2) return Infinity;
  if (!Array.isArray(b) || b.length < 2) return Infinity;

  const lat1 = Number(a[0]);
  const lng1 = Number(a[1]);
  const lat2 = Number(b[0]);
  const lng2 = Number(b[1]);

  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lng2)
  ) {
    return Infinity;
  }

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return (
    6371 *
    2 *
    Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
  );
}

function toDate(value) {
  if (value instanceof Date) return value;

  if (!value) return null;

  const d = new Date(value);

  return Number.isNaN(d.getTime()) ? null : d;
}

/* ---------------------------------
   RECENT CITATIONS TABLE
---------------------------------- */

function MiniTable({ rows, onOpen }) {
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 13,
      }}
    >
      <thead>
        <tr>
          {[
            "Citation",
            "Motorist",
            "Zone",
            "Issued",
            "Amount",
            "Status",
            "",
          ].map((h) => (
            <th
              key={h}
              style={{
                textAlign: "left",
                fontSize: 11,
                color: C.inkFaint,
                fontWeight: 600,
                padding: "6px 10px",
                borderBottom: `1px solid ${C.line}`,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {rows.map((c) => {
          const d = toDate(c.issuedAt || c.date);
          const amount = Number(c.amount || 0);

          return (
            <tr
              key={c.id}
              className="et-row"
              onClick={() => onOpen?.(c)}
              style={{
                cursor: onOpen ? "pointer" : "default",
              }}
            >
              <td style={cellStyle}>
                <span className="et-mono">
                  {c.ticket || c.id}
                </span>
              </td>

              <td style={cellStyle}>
                {c.motorist || "—"}
              </td>

              <td style={cellStyle}>
                {c.barangay?.name ||
                  c.zone ||
                  "—"}
              </td>

              <td style={cellStyle}>
                {d
                  ? d.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : c.date || "—"}
              </td>

              <td style={cellStyle}>
                {amount ? peso(amount) : "—"}
              </td>

              <td style={cellStyle}>
                <StatusPill
                  status={c.status || "Pending"}
                />
              </td>

              <td
                style={{
                  ...cellStyle,
                  textAlign: "right",
                }}
              >
                <ChevronRight
                  size={14}
                  color={C.inkFaint}
                />
              </td>
            </tr>
          );
        })}

        {!rows.length && (
          <tr>
            <td
              colSpan={7}
              style={{
                padding: 28,
                textAlign: "center",
                color: C.inkFaint,
              }}
            >
              No citation records yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/* ---------------------------------
   DASHBOARD
---------------------------------- */

export default function DashboardView({
  onOpen,
  goTab,
}) {
  const {
    citations = [],
    enforcers = [],
    ordinances = [],
    barangays = [],
  } = useTrafficData();

  /* ---------------------------------
     CITATIONS TODAY
  ---------------------------------- */

  const todayKey = new Date()
    .toISOString()
    .slice(0, 10);

  const today = useMemo(() => {
    return citations.filter((c) => {
      const d = toDate(
        c.issuedAt || c.date
      );

      if (!d) {
        return c.date === todayKey;
      }

      return (
        d.toISOString().slice(0, 10) ===
        todayKey
      );
    });
  }, [citations, todayKey]);

  /* ---------------------------------
     PENDING CITATIONS
  ---------------------------------- */

  const pending = useMemo(() => {
    return citations.filter(
      (c) =>
        c.status === "Pending" ||
        c.status === "Overdue"
    );
  }, [citations]);

  /* ---------------------------------
     MONTHLY REVENUE
  ---------------------------------- */

  const revenueMTD = useMemo(() => {
    const now = new Date();

    return citations
      .filter((c) => {
        const d = toDate(
          c.issuedAt || c.date
        );

        return (
          c.status === "Settled" &&
          d &&
          d.getFullYear() ===
            now.getFullYear() &&
          d.getMonth() === now.getMonth()
        );
      })
      .reduce(
        (sum, c) =>
          sum + Number(c.amount || 0),
        0
      );
  }, [citations]);

  /* ---------------------------------
     MOTORISTS
  ---------------------------------- */

  const uniqueMotorists = useMemo(() => {
    return new Set(
      citations.map(c => `${String(c.motorist || "").trim().toLowerCase()}|${String(c.plateNumber || c.vehicle?.plate || "").trim().toLowerCase()}`)
    ).size;
  }, [citations]);

  /* ---------------------------------
     ENFORCERS
  ---------------------------------- */

  // Duty status isn't tracked in the shared database yet (only the
  // enforcer roster itself is), so show the full roster count for now
  // instead of a misleading on-duty split.
  const onDuty = enforcers.length;

  /* ---------------------------------
     HOTSPOT DATA
  ---------------------------------- */

  const hotspotStats = useMemo(() => {
    const rows = barangays.map((b) => ({
      ...b,
      count: 0,
      revenue: 0,
    }));

    if (!rows.length) return [];

    citations.forEach((c) => {
      if (!Array.isArray(c.position)) {
        return;
      }

      let nearest = rows[0];
      let nearestDistance = Infinity;

      rows.forEach((b) => {
        const d = distanceKm(
          c.position,
          [b.lat, b.lng]
        );

        if (d < nearestDistance) {
          nearest = b;
          nearestDistance = d;
        }
      });

      /*
       * Ignore citations that are too far
       * away from Libmanan.
       */
      if (nearestDistance <= 15) {
        nearest.count += 1;

        if (c.status === "Settled") {
          nearest.revenue += Number(
            c.amount || 0
          );
        }
      }
    });

    return rows.sort(
      (a, b) =>
        b.count - a.count ||
        a.name.localeCompare(b.name)
    );
  }, [citations, barangays]);

  const top3 = hotspotStats.slice(0, 3);

  /* ---------------------------------
     14-DAY CITATION TREND
  ---------------------------------- */

  const trend = useMemo(() => {
    const days = [];
    const now = new Date();

    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);

      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);

      const key = d
        .toISOString()
        .slice(0, 10);

      days.push({
        date: d.toLocaleDateString(
          "en-US",
          {
            month: "short",
            day: "numeric",
          }
        ),

        citations: citations.filter(
          (c) => {
            const cd = toDate(
              c.issuedAt || c.date
            );

            return (
              cd &&
              cd
                .toISOString()
                .slice(0, 10) === key
            );
          }
        ).length,
      });
    }

    return days;
  }, [citations]);

  /* ---------------------------------
     STATUS BREAKDOWN
  ---------------------------------- */

  const statusBreakdown = useMemo(() => {
    return STATUSES.map((status) => ({
      status,
      count: citations.filter(
        (c) => c.status === status
      ).length,
    }));
  }, [citations]);

  /* ---------------------------------
     RECENT CITATIONS
  ---------------------------------- */

  const recent = useMemo(() => {
    return [...citations]
      .sort(
        (a, b) =>
          (toDate(
            b.issuedAt || b.date
          )?.getTime() || 0) -
          (toDate(
            a.issuedAt || a.date
          )?.getTime() || 0)
      )
      .slice(0, 6);
  }, [citations]);

  /* ---------------------------------
     RENDER
  ---------------------------------- */

  return (
    <div className="et-fade-in">
      <PageHeader
        title="Command overview"
        subtitle="Real-time citation activity across Libmanan"
        live
      />

      {/* KPI CARDS */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(6, minmax(0, 1fr))",
          gap: 14,
          marginBottom: 22,
        }}
      >
        <TicketStat
          icon={Ticket}
          label="Citations today"
          value={today.length}
          sub="Live from citation records"
          tone="accent"
        />

        <TicketStat
          icon={Clock}
          label="Pending payment"
          value={pending.length}
          sub={`${peso(
            pending.reduce(
              (sum, c) =>
                sum + Number(c.amount || 0),
              0
            )
          )} outstanding`}
          tone="danger"
        />

        <TicketStat
          icon={TrendingUp}
          label="Verified revenue"
          value={peso(revenueMTD)}
          sub="Paid citations this month"
          tone="success"
        />

        <TicketStat
          icon={Users}
          label="Motorists"
          value={uniqueMotorists}
          sub="Unique name + plate records"
          tone="info"
        />

        <TicketStat
          icon={ShieldCheck}
          label="Active ordinances"
          value={ordinances.length}
          sub="Current violation rules"
          tone="info"
        />

        <TicketStat
          icon={ShieldCheck}
          label="Enforcers on duty"
          value={`${onDuty} / ${enforcers.length}`}
          sub="Live field roster"
          tone="info"
        />
      </div>

      {/* HOTSPOTS + TREND */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "1.4fr 1fr",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <Panel
          title="Violation hotspots"
          action={{
            label: "Open full map",
            onClick: () =>
              goTab?.("map"),
          }}
        >
          <HotspotMap
            compact
            stats={hotspotStats}
            citations={citations}
          />

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 12,
            }}
          >
            {top3.map((b, i) => (
              <div
                key={b.id}
                style={{
                  flex: 1,
                  background:
                    C.surfaceSunk,
                  borderRadius: 8,
                  padding:
                    "10px 12px",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: C.inkFaint,
                    fontWeight: 600,
                  }}
                >
                  #{i + 1} hotspot
                </div>

                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                  }}
                >
                  {b.name}
                </div>

                <div
                  style={{
                    fontSize: 11.5,
                    color: C.inkSoft,
                  }}
                >
                  {b.count} citations
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="14-day citation trend">
          <ResponsiveContainer
            width="100%"
            height={170}
          >
            <LineChart
              data={trend}
              margin={{
                left: -18,
                right: 8,
                top: 8,
              }}
            >
              <CartesianGrid
                stroke={C.line}
                vertical={false}
              />

              <XAxis
                dataKey="date"
                tick={{
                  fontSize: 10,
                  fill: C.inkFaint,
                }}
                axisLine={{
                  stroke: C.line,
                }}
                tickLine={false}
                interval={2}
              />

              <YAxis
                tick={{
                  fontSize: 10,
                  fill: C.inkFaint,
                }}
                axisLine={false}
                tickLine={false}
                width={26}
                allowDecimals={false}
              />

              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: `1px solid ${C.line}`,
                }}
              />

              <Line
                type="monotone"
                dataKey="citations"
                stroke={C.accent}
                strokeWidth={2.4}
                dot={{
                  r: 2.5,
                  fill: C.accent,
                }}
              />
            </LineChart>
          </ResponsiveContainer>

          <div
            style={{
              height: 1,
              background: C.line,
              margin: "12px 0",
            }}
          />

          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.inkFaint,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 8,
            }}
          >
            Status breakdown
          </div>

          <ResponsiveContainer
            width="100%"
            height={90}
          >
            <BarChart
              data={statusBreakdown}
              layout="vertical"
              margin={{
                left: 0,
                right: 12,
              }}
            >
              <XAxis
                type="number"
                hide
              />

              <YAxis
                dataKey="status"
                type="category"
                width={64}
                tick={{
                  fontSize: 11,
                  fill: C.inkSoft,
                }}
                axisLine={false}
                tickLine={false}
              />

              <Bar
                dataKey="count"
                radius={[
                  0,
                  4,
                  4,
                  0,
                ]}
                barSize={12}
              >
                {statusBreakdown.map(
                  (s, i) => (
                    <Cell
                      key={i}
                      fill={
                        statusColors(
                          s.status
                        ).dot
                      }
                    />
                  )
                )}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* RECENT CITATIONS */}

      <Panel
        title={`Recent citations (${citations.length})`}
        action={{
          label: "View all",
          onClick: () =>
            goTab?.("citations"),
        }}
      >
        <MiniTable
          rows={recent}
          onOpen={onOpen}
        />
      </Panel>
    </div>
  );
}