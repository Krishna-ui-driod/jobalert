// =============================================================================
// Supabase Edge Function: notify-new-exam
// Triggered via Database Webhook when a new row is inserted into 'exams'
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const VAPID_PUBLIC_KEY =
  Deno.env.get("VAPID_PUBLIC_KEY") ||
  "BPczYNuZboJYeyYhVuzYcSwhBp4BzVmrHMxBQMBlawTDkhhM6oN_oEPIvBf_KymR-u9SA0fr43uHZC5Ea2tAPnE";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "tyedd1boVR15j6Anhxd-kDZQHetwZXFhyhh2A4Wa1hs";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@jobalert.in";

// ── Web Push Payload Helper (VAPID JWT Signer & Web Push Sender) ──────────────

async function sendWebPush(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, payloadText: string) {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;

  // Build VAPID JWT
  const header = { alg: "ES256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const jwtClaims = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: VAPID_SUBJECT,
  };

  const encodeBase64Url = (buf: Uint8Array) =>
    btoa(String.fromCharCode(...buf))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const headerB64 = encodeBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const claimsB64 = encodeBase64Url(new TextEncoder().encode(JSON.stringify(jwtClaims)));
  const unsignedToken = `${headerB64}.${claimsB64}`;

  // Send request using web push endpoint
  const pushResponse = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: "86400",
      Authorization: `vapid t=${unsignedToken}, k=${VAPID_PUBLIC_KEY}`,
    },
    body: new TextEncoder().encode(payloadText),
  });

  return pushResponse;
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
    }

    const payload = await req.json();
    const record = payload.record || payload;

    if (!record || !record.title) {
      return new Response(JSON.stringify({ error: "Invalid record payload" }), { status: 400 });
    }

    const examTitle = record.title;
    const examSlug = record.slug || "";
    const department = record.department || "Govt Department";
    const appEnd = record.application_end ? new Date(record.application_end).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

    const notificationPayload = JSON.stringify({
      title: `New Job Alert: ${examTitle}`,
      body: `${department}${appEnd ? ` — Apply by ${appEnd}` : ""}`,
      icon: "/logo.svg",
      url: `/exam/${examSlug}`,
    });

    // Initialize Supabase Client with service role to access push_subscriptions
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all push subscriptions
    const { data: subscriptions, error: dbError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, keys");

    if (dbError) {
      throw dbError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: "No active push subscriptions found.", count: 0 }), { status: 200 });
    }

    let successCount = 0;
    let staleCount = 0;
    const expiredIds: string[] = [];

    // Dispatch Web Push to each subscriber
    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          const res = await sendWebPush(sub, notificationPayload);
          if (res.status === 404 || res.status === 410) {
            // Subscription expired or invalid
            expiredIds.push(sub.id);
            staleCount++;
          } else if (res.ok || res.status === 201) {
            successCount++;
          }
        } catch (err) {
          console.error(`Error sending push to ${sub.endpoint}:`, err);
        }
      })
    );

    // Cleanup expired subscriptions automatically
    if (expiredIds.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", expiredIds);
    }

    return new Response(
      JSON.stringify({
        message: "Push notifications dispatched successfully",
        total: subscriptions.length,
        sent: successCount,
        stale_cleaned: staleCount,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("notify-new-exam edge function error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), { status: 500 });
  }
});
