import React, { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap } from "react-leaflet";
import { C } from "../theme.js";

const LIBMANAN_CENTER = [13.6938, 123.0620];

function radiusFor(count, max) {
  return 8 + (count / max) * 22;
}

function FocusController({ highlight, stats }) {
  const map = useMap();
  useEffect(() => {
    if (!highlight) return;
    const b = stats.find(s => s.id === highlight);
    if (b) map.panTo([b.lat, b.lng], { animate: true, duration: 0.4 });
  }, [highlight, stats, map]);
  return null;
}

export default function HotspotMap({ compact = false, highlight, onSelect, stats = [], citations = [] }) {
  const safeStats = stats.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  const max = Math.max(...safeStats.map(s => s.count), 1);
  const height = compact ? 300 : 460;
  const topId = safeStats[0]?.id;

  return (
    <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${C.line}` }}>
      <MapContainer
        center={LIBMANAN_CENTER}
        zoom={compact ? 12 : 13}
        style={{ height, width: "100%", background: C.surfaceSunk }}
        scrollWheelZoom={!compact}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FocusController highlight={highlight} stats={safeStats} />

        {safeStats.map((b) => {
          const r = radiusFor(b.count, max);
          const isTop = b.id === topId;
          const dim = highlight && highlight !== b.id;
          return (
            <React.Fragment key={b.id}>
              <CircleMarker
                center={[b.lat, b.lng]}
                radius={r}
                pathOptions={{
                  color: "transparent",
                  fillColor: C.accent,
                  fillOpacity: dim ? 0.06 : 0.16,
                }}
                interactive={false}
              />
              <CircleMarker
                center={[b.lat, b.lng]}
                radius={Math.max(6, r * 0.45)}
                pathOptions={{
                  color: "#fff",
                  weight: 2,
                  fillColor: isTop ? C.danger : C.accent,
                  fillOpacity: dim ? 0.35 : 0.95,
                }}
                eventHandlers={onSelect ? { click: () => onSelect(b.id) } : undefined}
              >
                <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                  <div style={{ fontFamily: "Inter, sans-serif" }}>
                    <div style={{ fontWeight: 700, fontSize: 12.5 }}>{b.name}</div>
                    <div style={{ fontSize: 11.5, color: "#5B6660" }}>
                      {b.count} citation{b.count === 1 ? "" : "s"} · ₱{Number(b.revenue || 0).toLocaleString("en-PH")} collected
                    </div>
                    {b.note && <div style={{ fontSize: 11, color: "#8B948D", marginTop: 2 }}>{b.note}</div>}
                  </div>
                </Tooltip>
              </CircleMarker>
            </React.Fragment>
          );
        })}

        {/* Rendered LAST (on top) so a citation's exact-location dot is
            always visible, even when it sits on the same coordinates as
            its barangay's hotspot circle above - admins need to be able
            to pick out individual citations at a glance. */}
        {citations.filter(c => Array.isArray(c.position) && c.position.length >= 2).map((c) => {
          const fee = Number(c.amount ?? c.fine ?? 0);
          const location = c.location || c.barangay?.name || "Libmanan";
          return (
            <CircleMarker
              key={`citation-${c.id}`}
              center={[Number(c.position[0]), Number(c.position[1])]}
              radius={6}
              pathOptions={{ color: "#fff", weight: 2, fillColor: C.citationMarker, fillOpacity: 1 }}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11 }}>
                  <strong>{c.motorist || "Unknown Motorist"}</strong><br />
                  {c.plateNumber || "No plate"} · {c.violation || "Violation"}<br />
                  {location} · ₱{fee.toLocaleString("en-PH")}
                </div>
              </Tooltip>
              <Popup>
                <div style={{ minWidth: 190, fontFamily: "Inter, sans-serif" }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 5 }}>{c.motorist || "Unknown Motorist"}</div>
                  <div style={{ fontSize: 11.5, lineHeight: 1.6 }}>
                    <div><b>Plate:</b> {c.plateNumber || "—"}</div>
                    <div><b>Violation:</b> {c.violation || "—"}</div>
                    <div><b>Location:</b> {location}</div>
                    <div><b>Fee:</b> ₱{fee.toLocaleString("en-PH")}</div>
                    <div><b>Status:</b> {c.status || "Pending"}</div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
