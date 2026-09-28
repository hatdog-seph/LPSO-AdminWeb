import React from "react";
import { Wifi, WifiOff } from "lucide-react";
import { C } from "../theme.js";

export default function SyncBadge({ synced }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5,
      color: synced ? C.successDark : C.dangerDark, fontWeight: 500,
    }}>
      {synced ? <Wifi size={12} /> : <WifiOff size={12} />}
      {synced ? "Synced" : "Pending sync"}
    </span>
  );
}
