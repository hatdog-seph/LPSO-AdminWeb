import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, Lock, X, ZoomIn } from "lucide-react";
import { C } from "../theme.js";
import { fmtDate, fmtTime } from "../data/geoData.js";
import { supabase } from "../lib/supabaseClient.js";

const BUCKET = "report-evidence";
const LINK_SECONDS = 600; // temporary links expire after 10 minutes

// Thumbnails + full-size viewer for the evidence photos attached to an
// enforcer report. The photos live in a private bucket, so each one is
// loaded through a short-lived signed link that only a signed-in admin
// can create.
export default function EvidencePhotos({ paths, ticket, uploadedAt }) {
  const [urls, setUrls] = useState([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null); // index of the photo shown full size

  const loadLinks = useCallback(async () => {
    setError("");
    const { data, error: err } = await supabase.storage.from(BUCKET).createSignedUrls(paths, LINK_SECONDS);
    if (err) {
      setError("Couldn't load the evidence photos.");
      setUrls([]);
      return;
    }
    setUrls((data || []).map(d => d.signedUrl || null));
  }, [paths]);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  const download = async (i) => {
    const name = `evidence-${ticket}-${i + 1}.${paths[i].split(".").pop()}`;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(paths[i], 60, { download: name });
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  };

  // keyboard: Esc closes, arrows switch photos
  useEffect(() => {
    if (open === null) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen(i => (i + 1) % paths.length);
      if (e.key === "ArrowLeft") setOpen(i => (i - 1 + paths.length) % paths.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, paths.length]);

  if (error) {
    return (
      <div style={{ fontSize: 12.5, color: C.danger, background: C.dangerSoft, padding: "9px 11px", borderRadius: 8 }}>
        {error}{" "}
        <button className="et-btn" onClick={loadLinks} style={{ background: "transparent", color: C.danger, fontWeight: 700, textDecoration: "underline", padding: 0 }}>Try again</button>
      </div>
    );
  }

  const navBtn = {
    width: 40, height: 40, borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "#fff",
    display: "grid", placeItems: "center", flex: "none",
  };

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {paths.map((p, i) => (
          <button
            key={p} className="et-btn" onClick={() => urls[i] && setOpen(i)}
            title="View full size"
            style={{
              position: "relative", height: 96, padding: 0, borderRadius: 8, overflow: "hidden",
              border: `1px solid ${C.line}`, background: C.surfaceSunk, cursor: urls[i] ? "zoom-in" : "default",
            }}
          >
            {urls[i] ? (
              <img src={urls[i]} alt={`Evidence photo ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            ) : (
              <span style={{ fontSize: 11, color: C.inkFaint }}>Loading…</span>
            )}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.inkFaint, marginTop: 2 }}>
        <Lock size={11} /> Private. Only visible to LPSO administrators.
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, marginLeft: "auto" }}><ZoomIn size={11} /> Click to enlarge</span>
      </div>

      {/* rendered on <body>: the report drawer's slide-in animation keeps a
          transform on it, which would otherwise trap this fixed overlay
          inside the 420px drawer instead of covering the whole screen */}
      {open !== null && createPortal(
        <div
          onClick={() => setOpen(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.92)", zIndex: 60, display: "flex", flexDirection: "column", padding: "18px 22px" }}
        >
          <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#E2E8F0", fontSize: 13, marginBottom: 12 }}>
            <span>Evidence photo {open + 1} of {paths.length} · <span className="et-mono">{ticket}</span></span>
            <span style={{ display: "flex", gap: 8 }}>
              <button className="et-btn" onClick={() => download(open)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 12.5, fontWeight: 600 }}>
                <Download size={14} /> Download
              </button>
              <button className="et-btn" onClick={() => setOpen(null)} aria-label="Close" style={{ ...navBtn, width: 34, height: 34 }}>
                <X size={17} />
              </button>
            </span>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", gap: 14 }}>
            {paths.length > 1 && (
              <button className="et-btn" aria-label="Previous photo" style={navBtn}
                onClick={e => { e.stopPropagation(); setOpen(i => (i - 1 + paths.length) % paths.length); }}>
                <ChevronLeft size={22} />
              </button>
            )}
            <div style={{ flex: 1, height: "100%", display: "flex", alignItems: "center", justifyContent: "center", minWidth: 0 }}>
              <img
                src={urls[open]} alt={`Evidence photo ${open + 1}`} onClick={e => e.stopPropagation()}
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 6, boxShadow: "0 10px 40px rgba(0,0,0,0.4)" }}
              />
            </div>
            {paths.length > 1 && (
              <button className="et-btn" aria-label="Next photo" style={navBtn}
                onClick={e => { e.stopPropagation(); setOpen(i => (i + 1) % paths.length); }}>
                <ChevronRight size={22} />
              </button>
            )}
          </div>

          {uploadedAt && (
            <div style={{ textAlign: "center", color: "#94A3B8", fontSize: 11.5, marginTop: 10 }}>
              Uploaded {fmtDate(new Date(uploadedAt))}, {fmtTime(new Date(uploadedAt))} with the report
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
