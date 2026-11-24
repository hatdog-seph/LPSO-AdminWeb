import React, { useEffect, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, CircleMarker, Marker, Tooltip, Popup, useMap } from "react-leaflet";
import { C } from "../theme.js";
import { supabase } from "../lib/supabaseClient.js";

const LIBMANAN_CENTER = [13.6938, 123.0620];

// Citations issued within this many meters of each other are shown as ONE
// place on the map (a numbered marker) instead of stacked dots that hide
// each other.
const GROUP_RADIUS_M = 20;

function radiusFor(count, max) {
  return 8 + (count / max) * 22;
}

function metersBetween(a, b) {
  const R = 6371000;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLng = (b[1] - a[1]) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// Groups citations that share (almost) the same spot. Newest first, so the
// latest citation is always #1 in a group's list.
export function groupCitations(citations, radiusM = GROUP_RADIUS_M) {
  const valid = citations.filter(c =>
    Array.isArray(c.position) && c.position.length >= 2 &&
    c.position[0] != null && c.position[1] != null &&
    Number.isFinite(Number(c.position[0])) && Number.isFinite(Number(c.position[1])));
  const sorted = [...valid].sort((a, b) => String(b.issuedAt || "").localeCompare(String(a.issuedAt || "")));
  const groups = [];
  sorted.forEach((c) => {
    const pos = [Number(c.position[0]), Number(c.position[1])];
    const hit = groups.find(g => metersBetween(g.center, pos) <= radiusM);
    if (hit) hit.items.push(c);
    else groups.push({ center: pos, items: [c] });
  });
  return groups.map(g => ({ ...g, key: `grp-${g.items[0].id}` }));
}

function countIcon(n) {
  return L.divIcon({
    className: "",
    html:
      `<div style="width:22px;height:22px;border-radius:50%;background:${C.citationMarker};` +
      `border:2px solid #fff;box-shadow:0 0 0 3px rgba(242,183,5,.28),0 1px 3px rgba(0,0,0,.3);` +
      `display:flex;align-items:center;justify-content:center;font:700 11px Inter,sans-serif;color:${C.ink}">${n}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });
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

const peso = (n) => `₱${Number(n || 0).toLocaleString("en-PH")}`;

// Vehicle photo from the private citation-photos bucket. A short-lived signed
// link is requested only when the photo is actually on screen.
function VehiclePhoto({ path, visible }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!path || !visible || url) return;
    let cancelled = false;
    supabase.storage.from("citation-photos").createSignedUrl(path, 3600).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data?.signedUrl) setFailed(true); else setUrl(data.signedUrl);
    });
    return () => { cancelled = true; };
  }, [path, visible, url]);

  if (!path) {
    return <div style={{ marginTop: 10, fontSize: 11.5, color: C.inkSoft }}>No vehicle photo</div>;
  }
  if (failed) {
    return <div style={{ marginTop: 10, fontSize: 11.5, color: C.inkSoft }}>Photo could not be loaded</div>;
  }
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 4 }}>Vehicle photo</div>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" title="Open full size">
          <img src={url} alt="Vehicle" style={{ display: "block", width: "100%", height: 150, objectFit: "cover", borderRadius: 8, border: `1px solid ${C.line}` }} />
        </a>
      ) : (
        <div style={{ height: 150, borderRadius: 8, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, color: C.inkSoft }}>Loading photo…</div>
      )}
    </div>
  );
}

function StatusChip({ status }) {
  const s = status || "Pending";
  const tone = s === "Paid"
    ? { bg: C.successSoft, fg: C.successDark }
    : s === "Overdue"
      ? { bg: C.dangerSoft, fg: C.dangerDark }
      : { bg: "#FDF1D3", fg: "#8A5A00" };
  return (
    <span style={{ flex: "none", fontSize: 11, fontWeight: 600, color: tone.fg, background: tone.bg, borderRadius: 999, padding: "2px 8px" }}>
      {s}
    </span>
  );
}

// Popup for a spot with several citations: a numbered list first, then the
// details of ONLY the one that was clicked. Both views stay mounted and are
// toggled with display, so the clicked button is never removed from the page
// in the middle of its own click (Leaflet treats that as a click on the map
// and closes the popup).
function StackedPopup({ items }) {
  const [sel, setSel] = useState(null);
  const font = { fontFamily: "Inter, sans-serif" };
  const location = items[0].location || items[0].barangay?.name || "Libmanan";
  const c = items[sel ?? 0];
  const violations = c.violations?.length ? c.violations.map(v => v.desc).filter(Boolean) : [c.violation || "—"];
  const stop = (e) => e.stopPropagation();

  return (
    <div style={{ ...font, width: 250 }} onClick={stop} onMouseDown={stop}>
      {/* LIST */}
      <div style={{ display: sel === null ? "block" : "none" }}>
        <div style={{ padding: "2px 10px 8px" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.ink }}>{items.length} citations at this spot</div>
          <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>{location} · click a name for details</div>
        </div>
        <div style={{ maxHeight: 240, overflowY: "auto", borderTop: `1px solid ${C.line}` }}>
          {items.map((it, i) => (
            <button key={it.id} type="button" onClick={() => setSel(i)}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.accentSoft; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", boxSizing: "border-box", padding: "9px 10px", border: 0, borderBottom: `1px solid ${C.line}`, background: "#fff", textAlign: "left", cursor: "pointer" }}>
              <span style={{ flex: "none", width: 22, height: 22, borderRadius: "50%", background: C.sidebar, color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
              <span style={{ flexGrow: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: C.ink }}>{it.motorist || "Unknown Motorist"}</span>
                <span style={{ display: "block", fontSize: 11.5, color: C.inkSoft }}>{it.plateNumber || "No plate"} · {peso(it.amount ?? it.fine)}</span>
              </span>
              <StatusChip status={it.status} />
            </button>
          ))}
        </div>
      </div>

      {/* DETAILS of the clicked citation */}
      <div style={{ display: sel === null ? "none" : "block" }}>
        <button type="button" onClick={() => setSel(null)}
          style={{ display: "block", width: "100%", textAlign: "left", border: 0, borderBottom: `1px solid ${C.line}`, background: C.bg, color: C.accentDark, fontSize: 12, fontWeight: 600, padding: "8px 10px", cursor: "pointer", borderRadius: "6px 6px 0 0" }}>
          ‹ All {items.length} citations
        </button>
        <div style={{ padding: "10px 10px 4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: "none", width: 22, height: 22, borderRadius: "50%", background: C.sidebar, color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{(sel ?? 0) + 1}</span>
            <span style={{ flexGrow: 1, fontSize: 14, fontWeight: 700, color: C.ink }}>{c.motorist || "Unknown Motorist"}</span>
            <StatusChip status={c.status} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "76px 1fr", rowGap: 6, marginTop: 10, fontSize: 12.5, lineHeight: 1.4, color: C.ink }}>
            <div style={{ color: C.inkSoft }}>Ticket</div><div style={{ fontWeight: 600, wordBreak: "break-all" }}>{c.ticket || "—"}</div>
            <div style={{ color: C.inkSoft }}>Plate</div><div>{c.plateNumber || "—"}</div>
            <div style={{ color: C.inkSoft }}>Violation</div>
            <div>{violations.map((v, i) => <div key={i}>{v}</div>)}</div>
            <div style={{ color: C.inkSoft }}>Fine</div><div style={{ fontWeight: 600 }}>{peso(c.amount ?? c.fine)}</div>
            <div style={{ color: C.inkSoft }}>Issued</div><div>{c.date || "—"}</div>
            <div style={{ color: C.inkSoft }}>Location</div><div>{c.location || location}</div>
          </div>
          <VehiclePhoto key={c.id} path={c.photoPath} visible={sel !== null} />
        </div>
      </div>
    </div>
  );
}

// One numbered marker for a spot with 2+ citations. Hovering (or tapping)
// opens the list; the popup stays open so a name can be clicked.
function StackMarker({ group }) {
  const [resetKey, setResetKey] = useState(0);
  return (
    <Marker
      position={group.center}
      icon={countIcon(group.items.length)}
      zIndexOffset={1000}
      eventHandlers={{
        mouseover: (e) => { if (!e.target.isPopupOpen()) e.target.openPopup(); },
        popupclose: () => setResetKey(k => k + 1),
      }}
    >
      <Popup minWidth={250} maxWidth={250} closeButton>
        <StackedPopup key={resetKey} items={group.items} />
      </Popup>
    </Marker>
  );
}

function SingleCitationMarker({ c }) {
  const fee = Number(c.amount ?? c.fine ?? 0);
  const location = c.location || c.barangay?.name || "Libmanan";
  return (
    <CircleMarker
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
          <VehiclePhoto path={c.photoPath} visible />
        </div>
      </Popup>
    </CircleMarker>
  );
}

export default function HotspotMap({ compact = false, highlight, onSelect, stats = [], citations = [] }) {
  const safeStats = stats.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  const max = Math.max(...safeStats.map(s => s.count), 1);
  const height = compact ? 300 : 460;
  const topId = safeStats[0]?.id;
  const groups = groupCitations(citations);

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

        {/* Rendered LAST (on top) so exact-location citations stay visible above
            the barangay hotspot circles. A spot with ONE citation keeps the plain
            yellow dot; a spot with several becomes one numbered marker whose
            popup lists every citation there (newest first). The hotspot ranking
            still counts every citation - only the markers are grouped. */}
        {groups.map((g) =>
          g.items.length === 1
            ? <SingleCitationMarker key={g.key} c={g.items[0]} />
            : <StackMarker key={g.key} group={g} />
        )}
      </MapContainer>
    </div>
  );
}
