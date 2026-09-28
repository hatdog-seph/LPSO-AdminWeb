import React, { useState } from "react";
import {
  ChevronRight, Bell, BellOff, LogOut, CheckCheck,
  Ticket, CreditCard, ShieldCheck, Gavel, ClipboardList, Info,
} from "lucide-react";
import { C } from "../theme.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useTrafficData } from "../context/TrafficDataContext.jsx";

// Maps a notification's title to an icon + tone, matching the same
// icon-in-soft-badge convention used by TicketStat elsewhere in the app,
// so notifications read as a native part of this UI rather than a
// bolted-on generic list.
const NOTIF_TYPES = [
  { match: /payment/i, icon: CreditCard, tone: "success" },
  { match: /citation/i, icon: Ticket, tone: "accent" },
  { match: /enforcer/i, icon: ShieldCheck, tone: "info" },
  { match: /ordinance/i, icon: Gavel, tone: "danger" },
  { match: /report/i, icon: ClipboardList, tone: "info" },
];
const TONES = {
  accent: { bg: C.accentSoft, fg: C.accentDark },
  success: { bg: C.successSoft, fg: C.successDark },
  danger: { bg: C.dangerSoft, fg: C.dangerDark },
  info: { bg: C.infoSoft, fg: C.infoDark },
};

function notifIcon(title = "") {
  const found = NOTIF_TYPES.find(t => t.match.test(title));
  return { Icon: found?.icon || Info, tone: TONES[found?.tone || "accent"] };
}

export default function Topbar({ title }) {
  const { user, logout } = useAuth();
  const { notifications, markNotificationRead, markAllNotificationsRead } = useTrafficData();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const initials = user?.initials || "AO";
  const name = user?.name || "Admin Officer";
  const role = user?.role || "Administrator";
  const unreadCount = notifications.filter(n => !n.read).length;
  const unreadLabel = unreadCount > 9 ? "9+" : String(unreadCount);

  return (
    <header className="et-topbar" style={{
      height: 64, borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center",
      justifyContent: "space-between", padding: "0 22px", background: C.surface, flexShrink: 0,
    }}>
      <div style={{ fontSize: 12.5, color: C.inkFaint }}>
        Libmanan Public Safety Office <ChevronRight size={11} style={{ display: "inline", verticalAlign: -1, margin: "0 2px" }} /> <span style={{ color: C.ink, fontWeight: 600 }}>{title}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ position: "relative" }}>
          <button
            className="et-btn" onClick={() => setNotifOpen(o => !o)}
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
            style={{ background: "transparent", color: C.inkSoft, position: "relative", padding: 4, borderRadius: 8 }}
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span style={{
                position: "absolute", top: -4, right: -5, minWidth: 15, height: 15, padding: "0 3px",
                borderRadius: 999, background: C.danger, color: "#fff", fontSize: 9.5, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center", border: `1.5px solid ${C.surface}`,
              }}>
                {unreadLabel}
              </span>
            )}
          </button>
          {notifOpen && (
            <>
              <div onClick={() => setNotifOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
              <div className="et-fade-in" style={{
                position: "absolute", top: 44, right: 0, width: 360, maxHeight: 440, overflowY: "auto",
                background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12,
                boxShadow: "0 12px 32px rgba(10,20,15,0.14)", zIndex: 41,
              }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 16px", borderBottom: `1px solid ${C.line}`, position: "sticky", top: 0, background: C.surface,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>Notifications</div>
                    {unreadCount > 0 && (
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, color: C.accentDark, background: C.accentSoft,
                        borderRadius: 999, padding: "2px 7px",
                      }}>
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      className="et-btn" onClick={markAllNotificationsRead}
                      style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", color: C.accentDark, fontSize: 11.5, fontWeight: 600, padding: "4px 2px" }}
                    >
                      <CheckCheck size={13} /> Mark all read
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "36px 20px", textAlign: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 999, background: C.surfaceSunk, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <BellOff size={18} color={C.inkFaint} />
                    </div>
                    <div style={{ fontSize: 12.5, color: C.inkSoft, fontWeight: 600 }}>You're all caught up</div>
                    <div style={{ fontSize: 11.5, color: C.inkFaint }}>New citation, payment, and account activity will show up here.</div>
                  </div>
                ) : (
                  notifications.map(n => {
                    const { Icon, tone } = notifIcon(n.title);
                    return (
                      <button
                        key={n.id}
                        className="et-btn et-row"
                        onClick={() => markNotificationRead(n.id)}
                        style={{
                          display: "block", width: "100%", textAlign: "left", padding: "12px 16px",
                          borderBottom: `1px solid ${C.line}`, background: n.read ? "transparent" : C.accentSoft,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: 8, background: tone.bg, flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1,
                          }}>
                            <Icon size={14} color={tone.fg} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}>{n.title}</div>
                              {!n.read && (
                                <span style={{ width: 6, height: 6, borderRadius: 999, background: C.accent, flexShrink: 0 }} />
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2, lineHeight: 1.4 }}>{n.message}</div>
                            <div style={{ fontSize: 10.5, color: C.inkFaint, marginTop: 4 }}>{n.time}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
                {notifications.length > 0 && (
                  <div style={{ padding: "9px 16px", textAlign: "center", fontSize: 10.5, color: C.inkFaint, borderTop: `1px solid ${C.line}` }}>
                    Showing the {notifications.length} most recent
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <div style={{ position: "relative" }}>
          <button
            className="et-btn" onClick={() => setMenuOpen(o => !o)}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", padding: 0 }}
          >
            <div style={{ width: 30, height: 30, borderRadius: 999, background: C.accentSoft, color: C.accentDark, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 700 }}>{initials}</div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.1 }}>{name}</div>
              <div style={{ fontSize: 10.5, color: C.inkFaint }}>{role}</div>
            </div>
          </button>
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
              <div className="et-fade-in" style={{
                position: "absolute", top: 40, right: 0, minWidth: 160, background: C.surface,
                border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(10,20,15,0.12)",
                zIndex: 41, padding: 6,
              }}>
                <button
                  className="et-btn" onClick={logout}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                    borderRadius: 7, background: "transparent", color: C.dangerDark, fontSize: 12.5, fontWeight: 600,
                  }}
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}