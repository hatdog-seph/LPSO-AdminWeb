import React, { useMemo, useState } from "react";
import { C } from "../theme.js";
import PageHeader from "../components/PageHeader.jsx";
import HotspotMap from "../components/HotspotMap.jsx";
import { useTrafficData } from "../context/TrafficDataContext.jsx";

function distanceKm(a, b) {
  const lat1 = Number(a[0]), lng1 = Number(a[1]);
  const lat2 = Number(b[0]), lng2 = Number(b[1]);
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export default function HotspotMapView() {
  const [hover, setHover] = useState(null);
  const { citations, barangays } = useTrafficData();

  // One source of truth:
  // - citation GPS positions determine the counts
  // - the same barangay object determines the marker coordinates
  // - the ranking is sorted from those exact counts
  const stats = useMemo(() => {
    const rows = barangays.map(b => ({ ...b, count: 0, revenue: 0 }));

    citations.forEach(c => {
      if (!Array.isArray(c.position) || c.position.length < 2) return;
      let nearest = rows[0];
      let nearestDistance = Infinity;

      rows.forEach(b => {
        const d = distanceKm(c.position, [b.lat, b.lng]);
        if (d < nearestDistance) {
          nearest = b;
          nearestDistance = d;
        }
      });

      // Ignore GPS records that are clearly outside the Libmanan hotspot area.
      // This prevents stale/out-of-area records from producing a false hotspot.
      if (nearestDistance <= 15) {
        nearest.count += 1;
        const amount = Number(c.amount ?? c.fine ?? 0);
        const isPaid = c.status === "Paid";
        if (isPaid) nearest.revenue += amount;
      }
    });

    return rows
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .map((b, i) => ({ ...b, rank: i + 1 }));
  }, [citations, barangays]);

  const max = Math.max(...stats.map(s => s.count), 1);

  return (
    <div className="et-fade-in">
      <PageHeader
        title="Geospatial hotspot mapping"
        subtitle="Citation density by location, calculated from the same GPS-tagged records shown on the map"
        live
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18 }}>
          <HotspotMap stats={stats} citations={citations} highlight={hover} onSelect={setHover} />
          <p style={{ fontSize: 11.5, color: C.inkFaint, marginTop: 10 }}>
            Ranking and map markers use the same live citation records. Each GPS-tagged citation
            is assigned to its nearest Libmanan hotspot location; records more than 15 km from
            the hotspot area are excluded from the ranking.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
            <LegendItem color={C.danger} label="Hotspot (highest citation count barangay)" />
            <LegendItem color={C.accent} label="Barangay (citation count)" />
            <LegendItem color={C.citationMarker} label="Citation location" />
          </div>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.inkFaint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
            Hotspot ranking · all {stats.length} barangays
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", maxHeight: 460, paddingRight: 4 }}>
            {stats.map((b, i) => (
              <div
                key={b.id}
                onMouseEnter={() => setHover(b.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(b.id)}
                style={{
                  cursor: "pointer",
                  padding: "7px 8px",
                  borderRadius: 8,
                  background: hover === b.id ? C.surfaceSunk : "transparent",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600 }}>{i + 1}. {b.name}</span>
                  <span style={{ color: C.inkFaint }}>{b.count}</span>
                </div>
                <div style={{ height: 6, background: C.surfaceSunk, borderRadius: 999 }}>
                  <div
                    style={{
                      height: 6,
                      width: `${(b.count / max) * 100}%`,
                      background: i === 0 && b.count > 0 ? C.danger : C.accent,
                      borderRadius: 999,
                    }}
                  />
                </div>
                <div style={{ fontSize: 10, color: C.inkFaint, marginTop: 3 }}>
                  {b.lat.toFixed(4)}, {b.lng.toFixed(4)}
                </div>
              </div>
            ))}

            {!citations.length && (
              <div style={{ fontSize: 12, color: C.inkFaint, padding: 10 }}>
                No citation records available yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: C.inkSoft }}>
      <span style={{
        width: 11, height: 11, borderRadius: "50%",
        background: color, border: "2px solid #fff",
        boxShadow: `0 0 0 1px ${C.line}`, flexShrink: 0,
      }} />
      {label}
    </div>
  );
}
