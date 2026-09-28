import React, { useState } from "react";
import { C } from "./theme.js";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import CitationDrawer from "./components/CitationDrawer.jsx";
import DashboardView from "./views/DashboardView.jsx";
import CitationsView from "./views/CitationsView.jsx";
import HotspotMapView from "./views/HotspotMapView.jsx";
import EnforcersView from "./views/EnforcersView.jsx";
import OrdinancesView from "./views/OrdinancesView.jsx";
import MotoristsView from "./views/MotoristsView.jsx";
import EnforcerReportsView from "./views/EnforcerReportsView.jsx";
import AnalyticsView from "./views/AnalyticsView.jsx";
import PaymentVerificationView from "./views/PaymentVerificationView.jsx";
import LoginView from "./views/LoginView.jsx";
import { TrafficDataProvider } from "./context/TrafficDataContext.jsx";
import { useAuth } from "./context/AuthContext.jsx";

const TITLES = {
  dashboard: "Dashboard", citations: "Citations", motorists: "Motorists", map: "Hotspot map",
  enforcers: "Enforcers", ordinances: "Ordinances", reports: "Enforcer Reports", analytics: "Analytics",
  payments: "Payment Verification",
};

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [openCitation, setOpenCitation] = useState(null);
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.inkFaint, fontSize: 13 }}>
        Loading...
      </div>
    );
  }
  if (!isAuthenticated) return <LoginView />;

  return (
    <TrafficDataProvider>
    <div className="et-root" style={{ display: "flex", height: "100vh", background: C.bg, overflow: "hidden" }}>
      <Sidebar tab={tab} setTab={setTab} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div className="no-print"><Topbar title={TITLES[tab]} /></div>
        <main className="et-main" style={{ flex: 1, overflowY: "auto", padding: 28 }}>
          {tab === "dashboard" && <DashboardView onOpen={setOpenCitation} goTab={setTab} />}
          {tab === "citations" && <CitationsView onOpen={setOpenCitation} />}
          {tab === "motorists" && <MotoristsView />}
          {tab === "map" && <HotspotMapView />}
          {tab === "enforcers" && <EnforcersView />}
          {tab === "ordinances" && <OrdinancesView />}
          {tab === "reports" && <EnforcerReportsView />}
          {tab === "analytics" && <AnalyticsView />}
          {tab === "payments" && <PaymentVerificationView goTab={setTab} />}
        </main>
      </div>
      {openCitation && (
        <>
          <div onClick={() => setOpenCitation(null)} style={{ position: "fixed", inset: 0, background: "rgba(10,20,15,0.15)", zIndex: 30 }} />
          <CitationDrawer citation={openCitation} onClose={() => setOpenCitation(null)} />
        </>
      )}
    </div>
    </TrafficDataProvider>
  );
}