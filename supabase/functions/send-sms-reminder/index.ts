// FILE PATH: AdminWeb/supabase/functions/send-sms-reminder/index.ts  (NEW file - rename this file to index.ts)
// Supabase Edge Function: send-sms-reminder
// Body: { citation_id: string, deadline: "YYYY-MM-DD" }
// Secrets (supabase secrets set ...): SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME (optional), PORTAL_URL
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const RATE_LIMIT_HOURS = 24;

// Keep in sync with buildPreview() in src/components/SmsReminderDialog.jsx
function buildMessage(c: { ticket: string; violation: string; amount: number; deadline: string; portalUrl: string }) {
  const date = new Date(`${c.deadline}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
  return `LPSO Libmanan: Pending citation ${c.ticket} for ${c.violation}. Fine: PHP ${Number(c.amount).toLocaleString("en-PH")}. ` +
    `Please settle by ${date}. Pay online: ${c.portalUrl}`;
}

// 09171234567 / +639171234567 / 639171234567 -> 09171234567
function normalizePhone(raw: string | null): string | null {
  const d = (raw || "").replace(/[\s-]/g, "");
  if (/^09\d{9}$/.test(d)) return d;
  if (/^\+?639\d{9}$/.test(d)) return "0" + d.replace(/^\+?63/, "");
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const authHeader = req.headers.get("Authorization") || "";

  // 1. Who is calling? Verify the JWT, then require an admin profile.
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Not signed in." }, 401);

  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: profile } = await db.from("profiles").select("role").eq("id", userData.user.id).single();
  if (!profile || !/^admin/i.test(profile.role || "")) return json({ error: "Only administrators can send SMS." }, 403);

  // 2. Validate input.
  let body: { citation_id?: string; deadline?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid request body." }, 400); }
  const { citation_id, deadline } = body;
  if (!citation_id || !deadline || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return json({ error: "citation_id and a valid deadline are required." }, 400);
  if (new Date(`${deadline}T23:59:59`) < new Date()) return json({ error: "The pay-by date must be in the future." }, 400);

  // 3. Load the citation on the server so the client can't tamper with the message content.
  const { data: cit, error: citErr } = await db
    .from("citation")
    .select("citation_id, ticket_number, status, fine_amount, motorist:motorist_id ( contact_number ), citation_violation ( violation_description ), ordinance:ordinance_id ( violation_description )")
    .eq("citation_id", citation_id)
    .single();
  if (citErr || !cit) return json({ error: "Citation not found." }, 404);
  if (!["Pending", "Overdue"].includes(cit.status)) return json({ error: `Citation is already ${cit.status}.` }, 409);

  const phone = normalizePhone((cit as any).motorist?.contact_number ?? null);
  if (!phone) return json({ error: "The motorist has no valid Philippine mobile number on file." }, 422);

  // 4. Rate limit: one reminder per citation per 24 hours (blocks double-clicks and repeat costs).
  const since = new Date(Date.now() - RATE_LIMIT_HOURS * 3600 * 1000).toISOString();
  const { count } = await db.from("sms_log").select("sms_id", { count: "exact", head: true })
    .eq("citation_id", citation_id).in("status", ["queued", "sent"]).gte("sent_at", since);
  if ((count ?? 0) > 0) return json({ error: `A reminder was already sent in the last ${RATE_LIMIT_HOURS} hours.` }, 429);

  const message = buildMessage({
    ticket: cit.ticket_number,
    violation: (cit as any).citation_violation?.[0]?.violation_description || (cit as any).ordinance?.violation_description || "traffic violation",
    amount: Number(cit.fine_amount) || 0,
    deadline,
    portalUrl: Deno.env.get("PORTAL_URL") || "",
  });

  // 5. Log first (status queued) so a double request is caught by the rate limit above.
  const { data: logRow, error: logErr } = await db.from("sms_log")
    .insert({ citation_id, phone_number: phone, message, status: "queued", sent_by: userData.user.id })
    .select("sms_id").single();
  if (logErr) return json({ error: "Could not write the SMS log." }, 500);

  // 6. Send through Semaphore (Philippine SMS gateway). Swap this block for another provider if needed.
  try {
    const params = new URLSearchParams({ apikey: Deno.env.get("SEMAPHORE_API_KEY")!, number: phone, message });
    const sender = Deno.env.get("SEMAPHORE_SENDER_NAME");
    if (sender) params.set("sendername", sender);

    const res = await fetch("https://api.semaphore.co/api/v4/messages", { method: "POST", body: params });
    const payload = await res.json().catch(() => null);
    const first = Array.isArray(payload) ? payload[0] : null;

    if (!res.ok || !first) {
      await db.from("sms_log").update({ status: "failed", error_detail: JSON.stringify(payload).slice(0, 500) }).eq("sms_id", logRow.sms_id);
      return json({ error: "The SMS provider rejected the message." }, 502);
    }
    await db.from("sms_log").update({ status: "sent", provider_message_id: String(first.message_id ?? "") }).eq("sms_id", logRow.sms_id);
    return json({ ok: true });
  } catch (e) {
    await db.from("sms_log").update({ status: "failed", error_detail: String(e).slice(0, 500) }).eq("sms_id", logRow.sms_id);
    return json({ error: "Could not reach the SMS provider." }, 502);
  }
});