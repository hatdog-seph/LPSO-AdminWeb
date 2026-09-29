import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isInsideLibmanan } from "../data/libmananGeofence.js";
import { supabase } from "../lib/supabaseClient.js";
import { sha256Hex } from "../lib/hashPassword.js";

const NOTIF_STORAGE = "eticket-traffic-notifications";

// The barangay list (id, name, lat, lng) used to be a hardcoded array here
// (and separately duplicated in the motorist portal backend and the
// enforcer app). It now lives in one place - the `barangay` table in
// Supabase - so correcting a name or a centroid is one UPDATE statement,
// not a redeploy of three codebases. See TrafficDataProvider's `barangays`
// state below for the live-fetched list; this helper just does the
// nearest-centroid math against whatever list it's given.
function nearestBarangay(barangays, position) {
  if (!Array.isArray(position) || position.length < 2) return null;
  let nearest = null;
  let distance = Infinity;
  (barangays || []).forEach((b) => {
    const dLat = Number(position[0]) - b.lat;
    const dLng = Number(position[1]) - b.lng;
    const d = dLat * dLat + dLng * dLng;
    if (d < distance) { distance = d; nearest = b; }
  });
  return nearest;
}

function load(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

const fromEnforcerRow = (row) => ({
  id: row.enforcer_id,
  registrationId: row.registration_id || "",
  badge: row.badge_number,
  name: row.full_name,
  username: row.username,
  role: row.role,
});

const fromOrdinanceRow = (row) => ({
  id: row.ordinance_id,
  code: row.ordinance_code,
  desc: row.violation_description,
  fine: Number(row.fine_amount) || 0,
});

const REPORT_SELECT = `
  report_id, citation_id, enforcer_id, category, description, contact_info,
  status, admin_notes, reviewed_by, reviewed_at, created_at, updated_at,
  citation:citation_id ( ticket_number, motorist_full_name, status, fine_amount ),
  enforcer:enforcer_id ( full_name, badge_number )
`;

const REPORT_STATUS_LABELS = {
  pending: "Pending",
  under_review: "Under Review",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

function fromReportRow(row) {
  return {
    id: row.report_id,
    citationId: row.citation_id,
    ticket: row.citation?.ticket_number || "—",
    citationStatus: row.citation?.status || null,
    citationFine: row.citation?.fine_amount != null ? Number(row.citation.fine_amount) : null,
    motorist: row.citation?.motorist_full_name || "—",
    enforcerId: row.enforcer_id,
    enforcer: row.enforcer ? { name: row.enforcer.full_name, badge: row.enforcer.badge_number } : null,
    category: row.category,
    description: row.description,
    contactInfo: row.contact_info,
    status: row.status,
    statusLabel: REPORT_STATUS_LABELS[row.status] || row.status,
    adminNotes: row.admin_notes,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const PAYMENT_SELECT = `
  payment_id, citation_id, paymongo_payment_intent_id, amount, method,
  reference_number, status, source,
  created_at, updated_at, verified_by, verified_at, verification_notes,
  citation:citation_id (
    ticket_number, motorist_full_name, status, ordinance_id,
    ordinance:ordinance_id ( ordinance_code, violation_description, fine_amount )
  )
`;

const PAYMENT_STATUS_LABELS = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  expired: "Expired",
  refunded: "Refunded",
};

function fromPaymentRow(row) {
  const citation = row.citation;
  const ordinance = citation?.ordinance;
  return {
    id: row.payment_id,
    citationId: row.citation_id,
    ticket: citation?.ticket_number || "—",
    motorist: citation?.motorist_full_name || "—",
    citationStatus: citation?.status || null,
    violationType: ordinance?.violation_description || "—",
    violationCode: ordinance?.ordinance_code || null,
    violationAmount: ordinance?.fine_amount != null ? Number(ordinance.fine_amount) : null,
    amount: Number(row.amount) || 0,
    method: row.method || (row.source === "qrph" ? "QR Ph" : "—"),
    referenceNumber: row.reference_number || null,
    paymongoIntentId: row.paymongo_payment_intent_id || null,
    source: row.source,
    status: row.status,
    statusLabel: PAYMENT_STATUS_LABELS[row.status] || row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    verifiedBy: row.verified_by || null,
    verifiedAt: row.verified_at || null,
    verificationNotes: row.verification_notes || null,
  };
}

const CITATION_SELECT = `
  citation_id, ticket_number, enforcer_id, motorist_id, vehicle_id,
  ordinance_id, location_id, issued_at, status, motorist_full_name,
  fine_amount, qr_code_data, is_synced,
  motorist:motorist_id ( license_number ),
  vehicle:vehicle_id ( plate_number, vehicle_type ),
  ordinance:ordinance_id ( ordinance_id, ordinance_code, violation_description, fine_amount ),
  citation_location:location_id ( latitude, longitude, barangay ),
  enforcer:enforcer_id ( full_name, badge_number ),
  citation_violation ( ordinance_code, violation_description, fine_amount )
`;

function fromCitationRow(row, barangays) {
  const loc = row.citation_location;
  const violations = row.citation_violation || [];
  const primaryViolation = violations[0];
  const position = loc && Number.isFinite(Number(loc.latitude)) && Number.isFinite(Number(loc.longitude))
    ? [Number(loc.latitude), Number(loc.longitude)]
    : null;
  const barangayName = loc?.barangay || (position ? nearestBarangay(barangays, position)?.name : null);
  const issued = row.issued_at ? new Date(row.issued_at) : null;

  const ordinance = row.ordinance ? {
    id: row.ordinance.ordinance_id,
    code: row.ordinance.ordinance_code,
    desc: row.ordinance.violation_description,
    fine: Number(row.ordinance.fine_amount) || 0,
  } : null;

  return {
    id: row.citation_id,
    ticket: row.ticket_number,
    motorist: row.motorist_full_name || "Unknown Motorist",
    plateNumber: (row.vehicle?.plate_number || "").toUpperCase(),
    vehicle: row.vehicle ? { type: row.vehicle.vehicle_type, plate: row.vehicle.plate_number } : null,
    vehicleId: row.vehicle_id,
    motoristId: row.motorist_id,
    // An empty string here is a real, confirmed "No License" answer from
    // the enforcer app, not missing data - only a genuinely absent
    // motorist record should read as "no data" (null).
    license: row.motorist ? (row.motorist.license_number || "No License") : null,
    ordinanceId: row.ordinance_id,
    ordinance,
    violation: primaryViolation?.violation_description || ordinance?.desc || "—",
    violations: violations.map(v => ({ code: v.ordinance_code, desc: v.violation_description, fine: Number(v.fine_amount) || 0 })),
    amount: Number(row.fine_amount) || 0,
    fine: Number(row.fine_amount) || 0,
    officer: row.enforcer?.full_name ? `Officer ${row.enforcer.full_name}` : "Unassigned",
    enforcer: row.enforcer ? { name: row.enforcer.full_name, badge: row.enforcer.badge_number } : null,
    enforcerId: row.enforcer_id,
    zone: barangayName || "Unmapped",
    barangay: barangayName ? { name: barangayName } : null,
    locationId: row.location_id,
    position,
    date: issued ? issued.toISOString().slice(0, 10) : "",
    time: issued ? issued.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
    issuedAt: row.issued_at,
    status: row.status || "Pending",
    synced: row.is_synced !== false,
    qrCodeData: row.qr_code_data || null,
  };
}

export function TrafficDataProvider({ children }) {
  const [citations, setCitations] = useState([]);
  const [citationsLoading, setCitationsLoading] = useState(true);
  const [citationsError, setCitationsError] = useState(null);

  const [notifications, setNotifications] = useState(() => load(NOTIF_STORAGE, []));
  const [enforcers, setEnforcers] = useState([]);
  const [enforcersLoading, setEnforcersLoading] = useState(true);
  const [enforcersError, setEnforcersError] = useState(null);
  const [ordinances, setOrdinances] = useState([]);
  const [ordinancesLoading, setOrdinancesLoading] = useState(true);
  const [ordinancesError, setOrdinancesError] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState(null);
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [paymentsError, setPaymentsError] = useState(null);
  const [barangays, setBarangays] = useState([]);
  const [barangaysLoading, setBarangaysLoading] = useState(true);

  useEffect(() => localStorage.setItem(NOTIF_STORAGE, JSON.stringify(notifications)), [notifications]);

  const addNotification = ({ title, message }) => setNotifications(prev => [
    { id: Date.now(), title, message, time: new Date().toLocaleTimeString() }, ...prev,
  ].slice(0, 8));

  // Reference data (rarely changes), fetched once and shared by every view
  // that used to import a hardcoded BARANGAYS array.
  const refreshBarangays = async () => {
    setBarangaysLoading(true);
    const { data, error } = await supabase
      .from("barangay")
      .select("id, name, latitude, longitude")
      .order("name", { ascending: true });
    if (!error && data) {
      setBarangays(data.map(b => ({ id: b.id, name: b.name, lat: Number(b.latitude), lng: Number(b.longitude) })));
    }
    setBarangaysLoading(false);
  };

  useEffect(() => { refreshBarangays(); }, []);

  const refreshCitations = async () => {
    setCitationsLoading(true);
    const { data, error } = await supabase
      .from("citation")
      .select(CITATION_SELECT)
      .order("issued_at", { ascending: false });
    if (error) {
      setCitationsError(error.message);
    } else {
      setCitationsError(null);
      setCitations((data || []).map(row => fromCitationRow(row, barangays)));
    }
    setCitationsLoading(false);
  };

  // Re-run once the barangay list actually arrives, so citations loaded
  // before it was ready still get their fallback barangay resolved instead
  // of being stuck with the empty list from the very first render.
  useEffect(() => { refreshCitations(); }, [barangays]);

  // Keep the dashboard live when the enforcer app syncs a new citation from
  // the field: that insert happens directly against Supabase from the
  // Flutter app, outside of any request this browser tab makes, so without
  // a subscription the admin would only see it after manually reloading the
  // page (same reasoning as the payment-changes subscription below).
  useEffect(() => {
    const channel = supabase
      .channel("citation-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "citation" }, () => {
        refreshCitations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addCitation = async (data) => {
    if (!isInsideLibmanan(data?.position)) {
      window.alert("Citation location is outside the Municipality of Libmanan.");
      return false;
    }
    const ordinance = ordinances.find(o => o.id === data.ordinanceId);
    if (!ordinance) {
      window.alert("Select a valid ordinance/violation.");
      return false;
    }
    if (!data.enforcerId) {
      window.alert("Select the enforcer issuing this citation.");
      return false;
    }

    const plate = (data.plateNumber || "").trim().toUpperCase();
    const motoristName = (data.motorist || "").trim();

    try {
      let motoristId, vehicleId;
      const { data: existingVehicle } = await supabase
        .from("vehicle")
        .select("vehicle_id, motorist_id")
        .ilike("plate_number", plate)
        .maybeSingle();

      if (existingVehicle) {
        vehicleId = existingVehicle.vehicle_id;
        motoristId = existingVehicle.motorist_id;
      } else {
        motoristId = `MOT-${Date.now().toString(36).toUpperCase()}`;
        vehicleId = `VEH-${Date.now().toString(36).toUpperCase()}`;
        const { error: motoristErr } = await supabase.from("motorist").insert({
          motorist_id: motoristId,
          full_name: motoristName,
          license_number: "UNKNOWN",
          violation_count: 0,
        });
        if (motoristErr) throw motoristErr;
        const { error: vehicleErr } = await supabase.from("vehicle").insert({
          vehicle_id: vehicleId,
          motorist_id: motoristId,
          plate_number: plate,
        });
        if (vehicleErr) throw vehicleErr;
      }

      const barangay = nearestBarangay(barangays, data.position);
      const locationId = `LOC-${Date.now().toString(36).toUpperCase()}`;
      const { error: locErr } = await supabase.from("citation_location").insert({
        location_id: locationId,
        latitude: data.position[0],
        longitude: data.position[1],
        barangay: barangay?.name || null,
        recorded_at: new Date().toISOString(),
      });
      if (locErr) throw locErr;

      const citationId = `CIT-${Date.now().toString(36).toUpperCase()}`;
      const issuedAt = new Date();
      const ticketNumber = `LPSO-${issuedAt.getFullYear()}-ADMIN-${String(Date.now()).slice(-6)}`;

      const { error: citationErr } = await supabase.from("citation").insert({
        citation_id: citationId,
        ticket_number: ticketNumber,
        enforcer_id: data.enforcerId,
        motorist_id: motoristId,
        vehicle_id: vehicleId,
        ordinance_id: ordinance.id,
        location_id: locationId,
        issued_at: issuedAt.toISOString(),
        status: data.status || "Pending",
        motorist_full_name: motoristName,
        fine_amount: ordinance.fine,
        qr_code_data: `https://eticket.libmananpso.gov.ph/t/${ticketNumber}`,
        is_synced: true,
      });
      if (citationErr) throw citationErr;

      await refreshCitations();
      addNotification({ title: "Traffic Citation Issued", message: `${ordinance.desc} citation issued to ${motoristName}.` });
      return true;
    } catch (err) {
      window.alert(err.message || "Could not create citation.");
      return false;
    }
  };

  const updateCitation = async (id, patch) => {
    const current = citations.find(c => c.id === id);
    if (!current) return { ok: false, error: "Citation not found." };

    const citationUpdate = {};
    if (patch.status !== undefined) citationUpdate.status = patch.status;
    if (patch.motorist !== undefined) citationUpdate.motorist_full_name = patch.motorist.trim();
    if (patch.enforcerId !== undefined) citationUpdate.enforcer_id = patch.enforcerId;
    if (patch.ordinanceId !== undefined) {
      const ord = ordinances.find(o => o.id === patch.ordinanceId);
      if (ord) {
        citationUpdate.ordinance_id = ord.id;
        citationUpdate.fine_amount = ord.fine;
      }
    }

    if (Object.keys(citationUpdate).length) {
      const { error } = await supabase.from("citation").update(citationUpdate).eq("citation_id", id);
      if (error) return { ok: false, error: error.message };
    }

    if (patch.plateNumber !== undefined && current.vehicleId) {
      const { error } = await supabase
        .from("vehicle")
        .update({ plate_number: patch.plateNumber.trim().toUpperCase() })
        .eq("vehicle_id", current.vehicleId);
      if (error) return { ok: false, error: error.message };
    }

    await refreshCitations();
    addNotification({ title: "Citation Updated", message: `${id} was updated successfully.` });
    return { ok: true };
  };

  const deleteCitation = async (id) => {
    const citation = citations.find(c => c.id === id);
    const { error } = await supabase.from("citation").delete().eq("citation_id", id);
    if (error) {
      const message = error.code === "23503"
        ? "Can't delete this citation - it still has linked violation/payment records. Remove those first."
        : error.message;
      window.alert(message);
      return { ok: false, error: message };
    }
    setCitations(prev => prev.filter(c => c.id !== id));
    if (citation) addNotification({ title: "Citation Deleted", message: `${citation.id} for ${citation.motorist} was deleted.` });
    return { ok: true };
  };

  const refreshEnforcers = async () => {
    setEnforcersLoading(true);
    const { data, error } = await supabase
      .from("enforcer")
      .select("enforcer_id, registration_id, full_name, badge_number, username, role")
      .order("full_name", { ascending: true });
    if (error) {
      setEnforcersError(error.message);
    } else {
      setEnforcersError(null);
      setEnforcers(data.map(fromEnforcerRow));
    }
    setEnforcersLoading(false);
  };

  useEffect(() => { refreshEnforcers(); }, []);

  const addEnforcer = async (data) => {
    const name = data?.name?.trim();
    const badge = data?.badge?.trim();
    const password = data?.password || "";
    const role = data?.role || "enforcer";

    if (!name || !badge) return { ok: false, error: "Full name and badge number are required." };
    if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

    const enforcerId = `ENF-${Date.now().toString(36).toUpperCase()}`;
    const passwordHash = await sha256Hex(password);

    const { data: row, error } = await supabase
      .from("enforcer")
      .insert({
        enforcer_id: enforcerId,
        registration_id: "",
        full_name: name,
        badge_number: badge,
        username: badge,
        password_hash: passwordHash,
        role,
      })
      .select("enforcer_id, registration_id, full_name, badge_number, username, role")
      .single();

    if (error) {
      const message = error.code === "23505"
        ? `Badge number "${badge}" is already registered.`
        : error.message;
      return { ok: false, error: message };
    }

    setEnforcers(prev => [...prev, fromEnforcerRow(row)].sort((a, b) => a.name.localeCompare(b.name)));
    addNotification({ title: "Enforcer Registered", message: `${name} (badge ${badge}) can now log into the enforcer app.` });
    return { ok: true };
  };

  const updateEnforcer = async (id, patch) => {
    const update = {};
    if (patch.name !== undefined) update.full_name = patch.name.trim();
    if (patch.role !== undefined) update.role = patch.role;

    const { data: row, error } = await supabase
      .from("enforcer")
      .update(update)
      .eq("enforcer_id", id)
      .select("enforcer_id, registration_id, full_name, badge_number, username, role")
      .single();

    if (error) return { ok: false, error: error.message };
    setEnforcers(prev => prev.map(e => e.id === id ? fromEnforcerRow(row) : e));
    addNotification({ title: "Enforcer Updated", message: `${id} was updated successfully.` });
    return { ok: true };
  };

  const deleteEnforcer = async (id) => {
    const enforcer = enforcers.find(e => e.id === id);
    const { error } = await supabase.from("enforcer").delete().eq("enforcer_id", id);

    if (error) {
      const message = error.code === "23503"
        ? "Can't delete this enforcer - they have citations on file. Remove/reassign those first."
        : error.message;
      window.alert(message);
      return { ok: false, error: message };
    }

    setEnforcers(prev => prev.filter(e => e.id !== id));
    if (enforcer) {
      addNotification({ title: "Enforcer Deleted", message: `${enforcer.name} (${enforcer.badge}) was removed from the roster.` });
    }
    return { ok: true };
  };

  const refreshOrdinances = async () => {
    setOrdinancesLoading(true);
    const { data, error } = await supabase
      .from("ordinance")
      .select("ordinance_id, ordinance_code, violation_description, fine_amount")
      .order("ordinance_code", { ascending: true });
    if (error) {
      setOrdinancesError(error.message);
    } else {
      setOrdinancesError(null);
      setOrdinances(data.map(fromOrdinanceRow));
    }
    setOrdinancesLoading(false);
  };

  useEffect(() => { refreshOrdinances(); }, []);

  const addOrdinance = async (data) => {
    const code = String(data?.code || "").trim();
    const desc = String(data?.desc || "").trim();
    const fine = Number(data?.fine);

    if (!code || !desc) return { ok: false, error: "Code and description are required." };
    if (!Number.isFinite(fine) || fine < 0) return { ok: false, error: "Fine amount must be a positive number." };
    if (ordinances.some(o => o.code.toLowerCase() === code.toLowerCase())) {
      return { ok: false, error: "An ordinance with this code already exists." };
    }

    const ordinanceId = `ORD-${Date.now().toString(36).toUpperCase()}`;
    const { data: row, error } = await supabase
      .from("ordinance")
      .insert({
        ordinance_id: ordinanceId,
        ordinance_code: code,
        violation_description: desc,
        fine_amount: fine,
      })
      .select("ordinance_id, ordinance_code, violation_description, fine_amount")
      .single();

    if (error) return { ok: false, error: error.message };

    setOrdinances(prev => [...prev, fromOrdinanceRow(row)].sort((a, b) => a.code.localeCompare(b.code)));
    addNotification({ title: "Ordinance Added", message: `${code} was added to the fine schedule.` });
    return { ok: true };
  };

  const updateOrdinance = async (id, patch) => {
    const current = ordinances.find(o => o.id === id);
    if (!current) return { ok: false, error: "Ordinance not found." };

    const code = String(patch.code ?? current.code).trim();
    const desc = String(patch.desc ?? current.desc).trim();
    const fine = Number(patch.fine ?? current.fine);

    if (!code || !desc) return { ok: false, error: "Code and description are required." };
    if (!Number.isFinite(fine) || fine < 0) return { ok: false, error: "Fine amount must be a positive number." };
    if (ordinances.some(o => o.id !== id && o.code.toLowerCase() === code.toLowerCase())) {
      return { ok: false, error: "An ordinance with this code already exists." };
    }

    const { data: row, error } = await supabase
      .from("ordinance")
      .update({ ordinance_code: code, violation_description: desc, fine_amount: fine })
      .eq("ordinance_id", id)
      .select("ordinance_id, ordinance_code, violation_description, fine_amount")
      .single();

    if (error) return { ok: false, error: error.message };

    const next = fromOrdinanceRow(row);
    setOrdinances(prev => prev.map(o => o.id === id ? next : o));
    addNotification({ title: "Ordinance Updated", message: `${next.code} was updated.` });
    return { ok: true };
  };

  const deleteOrdinance = async (id) => {
    const ordinance = ordinances.find(o => o.id === id);
    const { error } = await supabase.from("ordinance").delete().eq("ordinance_id", id);

    if (error) {
      const message = error.code === "23503"
        ? "Can't delete this ordinance - it's linked to citations on file. Reassign or delete those first."
        : error.message;
      return { ok: false, error: message };
    }

    setOrdinances(prev => prev.filter(o => o.id !== id));
    if (ordinance) {
      addNotification({ title: "Ordinance Deleted", message: `${ordinance.code} was removed from the fine schedule.` });
    }
    return { ok: true };
  };

  const refreshReports = async () => {
    setReportsLoading(true);
    const { data, error } = await supabase
      .from("enforcer_report")
      .select(REPORT_SELECT)
      .order("created_at", { ascending: false });
    if (error) {
      setReportsError(error.message);
    } else {
      setReportsError(null);
      setReports((data || []).map(fromReportRow));
    }
    setReportsLoading(false);
  };

  useEffect(() => { refreshReports(); }, []);

  const updateReport = async (id, patch) => {
    const update = { updated_at: new Date().toISOString() };
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.adminNotes !== undefined) update.admin_notes = patch.adminNotes;
    if (patch.status !== undefined && patch.status !== "pending") {
      update.reviewed_by = patch.reviewedBy || null;
      update.reviewed_at = new Date().toISOString();
    }

    const { data: row, error } = await supabase
      .from("enforcer_report")
      .update(update)
      .eq("report_id", id)
      .select(REPORT_SELECT)
      .single();

    if (error) return { ok: false, error: error.message };

    const next = fromReportRow(row);
    setReports(prev => prev.map(r => r.id === id ? next : r));
    addNotification({ title: "Report Updated", message: `Report on ${next.ticket} marked ${next.statusLabel}.` });
    return { ok: true };
  };

  const refreshPayments = async () => {
    setPaymentsLoading(true);
    const { data, error } = await supabase
      .from("payment")
      .select(PAYMENT_SELECT)
      .order("created_at", { ascending: false });
    if (error) {
      setPaymentsError(error.message);
    } else {
      setPaymentsError(null);
      setPayments((data || []).map(fromPaymentRow));
    }
    setPaymentsLoading(false);
  };

  useEffect(() => { refreshPayments(); }, []);

  // Keep the admin dashboard's payment list live: PayMongo's webhook updates
  // the "payment" (and "citation") rows server-side, outside of any request
  // this browser tab makes, so without a subscription an admin would only
  // ever see a new status after manually reloading the page. Supabase
  // Realtime pushes a notification the moment the webhook (or a manual
  // verification / refresh) writes to the table, and we simply re-fetch the
  // joined payment list at that point rather than trying to patch the
  // change in by hand.
  useEffect(() => {
    const channel = supabase
      .channel("payment-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "payment" }, () => {
        refreshPayments();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Server-side status check against PayMongo (via the admin-check-payment-status
  // edge function, which holds the PayMongo secret key). This is the only way a
  // QR Ph payment's status is confirmed from the admin panel - never from a
  // frontend claim, screenshot, or QR scan.
  const refreshPaymentStatus = async (id) => {
    const current = payments.find(p => p.id === id);
    if (!current) return { ok: false, error: "Payment not found." };
    if (current.source !== "qrph") {
      return { ok: false, error: "Only QR Ph payments can be refreshed against PayMongo." };
    }

    const { data, error } = await supabase.functions.invoke("admin-check-payment-status", {
      body: { payment_id: id },
    });

    if (error || !data?.ok) {
      return { ok: false, error: data?.error || "Could not check payment status with PayMongo." };
    }

    await refreshPayments();
    return { ok: true, status: data.status, paymongoStatus: data.paymongo_status };
  };

  // Bulk version of refreshPaymentStatus for the "Refresh Payment Status"
  // button in the Payment Verification header - checks every still-pending
  // QR Ph payment against PayMongo directly (one at a time, so we don't
  // burst PayMongo's API), then refreshes the list once at the end. Still
  // server-side only: nothing here trusts a frontend claim.
  const refreshAllPendingPayments = async () => {
    const pending = payments.filter(p => p.source === "qrph" && p.status === "pending");
    let updatedCount = 0;
    let errorCount = 0;

    for (const p of pending) {
      const { data, error } = await supabase.functions.invoke("admin-check-payment-status", {
        body: { payment_id: p.id },
      });
      if (error || !data?.ok) {
        errorCount += 1;
        continue;
      }
      if (data.status === "paid" || data.status === "failed") updatedCount += 1;
    }

    await refreshPayments();
    return { ok: true, checked: pending.length, updated: updatedCount, errors: errorCount };
  };

  // Manual "Mark as Paid (Office Payment)" - for when a motorist walks into
  // the LPSO office and pays in person (e.g. cash) instead of through QR Ph.
  // This is a direct admin action, not a motorist claim: the admin doing it
  // is personally verifying the payment right there, so it's recorded with
  // who did it and when for the audit trail, mirroring exactly what the
  // PayMongo webhook does automatically for a QR Ph payment (payment ->
  // "paid", citation -> "Settled"), guarded by the same idempotency check.
  const markPaymentPaidManually = async (id, { verifiedBy, notes } = {}) => {
    const current = payments.find(p => p.id === id);
    if (!current) return { ok: false, error: "Payment not found." };
    if (current.status !== "pending") {
      return { ok: false, error: "Only a pending payment can be marked paid manually." };
    }

    const { data: updated, error } = await supabase
      .from("payment")
      .update({
        status: "paid",
        updated_at: new Date().toISOString(),
        verified_by: verifiedBy || null,
        verified_at: new Date().toISOString(),
        verification_notes: notes || null,
      })
      .eq("payment_id", id)
      .eq("status", "pending")
      .select("payment_id")
      .maybeSingle();

    if (error) {
      return { ok: false, error: error.message };
    }
    if (!updated) {
      return { ok: false, error: "This payment was already resolved by someone else. Refresh and try again." };
    }

    await supabase
      .from("citation")
      .update({ status: "Settled" })
      .eq("citation_id", current.citationId);

    await refreshPayments();
    addNotification({
      title: "Payment Marked Paid",
      message: `${current.ticket} marked paid manually - office payment${verifiedBy ? ` (${verifiedBy})` : ""}.`,
    });
    return { ok: true };
  };

  const officers = useMemo(() =>
    enforcers.filter(e => Array.isArray(e.position)).map(e => ({
      id: e.id,
      name: e.name,
      position: e.position,
      status: e.status,
      zone: e.zone,
      lastUpdate: e.lastUpdate,
    })), [enforcers]);

  const value = useMemo(() => ({
    citations, citationsLoading, citationsError, refreshCitations,
    notifications, enforcers, enforcersLoading, enforcersError, officers,
    ordinances, ordinancesLoading, ordinancesError,
    reports, reportsLoading, reportsError, refreshReports, updateReport,
    payments, paymentsLoading, paymentsError, refreshPayments, refreshPaymentStatus, refreshAllPendingPayments, markPaymentPaidManually,
    barangays, barangaysLoading,
    addCitation, updateCitation, deleteCitation,
    addOrdinance, updateOrdinance, deleteOrdinance, refreshOrdinances,
    addEnforcer, updateEnforcer, deleteEnforcer, refreshEnforcers,
    addNotification
  }), [citations, citationsLoading, citationsError, notifications, enforcers, enforcersLoading, enforcersError, officers, ordinances, ordinancesLoading, ordinancesError, reports, reportsLoading, reportsError, payments, paymentsLoading, paymentsError, barangays, barangaysLoading]);
  return <TrafficDataContext.Provider value={value}>{children}</TrafficDataContext.Provider>;
}

const TrafficDataContext = createContext(null);
export function useTrafficData() {
  const value = useContext(TrafficDataContext);
  if (!value) throw new Error("useTrafficData must be used inside TrafficDataProvider");
  return value;
}