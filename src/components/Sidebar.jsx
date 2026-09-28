import React from "react";
import lpsoLogo from "../data/lpso_logo.png";
import { LayoutDashboard, Ticket, MapPinned, ShieldCheck, ScrollText, Users, ShieldAlert, BarChart3, CreditCard } from "lucide-react";
import { C } from "../theme.js";


export const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "citations", label: "Citations", icon: Ticket },
  { id: "motorists", label: "Motorists", icon: Users },
  { id: "map", label: "Hotspot map", icon: MapPinned },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "enforcers", label: "Enforcers", icon: ShieldCheck },
  { id: "ordinances", label: "Ordinances", icon: ScrollText },
  { id: "reports", label: "Enforcer Reports", icon: ShieldAlert },
  { id: "payments", label: "Payment Verification", icon: CreditCard },
];

export default function Sidebar({ tab, setTab }) {
  return (
    <aside className="et-sidebar" style={{ width: 236, background: C.sidebar, color: C.sidebarText, flexShrink: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "22px 20px 18px", borderBottom: `1px solid ${C.sidebarLine}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
         <div style={{ width: 50, height: 50, borderRadius: 7, overflow: "hidden", flexShrink: 0 }}>
          <img src={lpsoLogo} alt="LPSO logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div>
            <div className="et-display" style={{ fontSize: 16, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>eTicket</div>
            <div style={{ fontSize: 10, color: C.sidebarTextDim, letterSpacing: "0.04em" }}>LPSO ADMIN CONSOLE</div>
          </div>
        </div>
      </div>

      <nav style={{ padding: "14px 12px", flex: 1 }}>
        {NAV.map(item => {
          const active = tab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id} className="et-btn et-nav-item" title={item.label} onClick={() => setTab(item.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", borderRadius: 8, marginBottom: 3, textAlign: "left",
                background: active ? C.sidebarSoft : "transparent",
                color: active ? "#fff" : C.sidebarText, fontSize: 13.5, fontWeight: active ? 600 : 500,
              }}
            >
              <Icon size={16} color={active ? C.accent : C.sidebarTextDim} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: "14px 20px 20px", borderTop: `1px solid ${C.sidebarLine}` }}>
        <div style={{ fontSize: 10.5, color: C.sidebarTextDim, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>System status</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#CFE3D8" }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: "#4CAF7D" }} />
          All modules operational
        </div>
      </div>
    </aside>
  );
}