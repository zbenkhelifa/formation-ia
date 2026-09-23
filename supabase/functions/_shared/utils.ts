// Outils partagés par les Edge Functions
import { createClient } from "npm:@supabase/supabase-js@2";

export const SITE_URL = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");

export const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_URL || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Client Supabase avec la clé service_role (contourne RLS : à n'utiliser que côté serveur). */
export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ---------------- Brevo ----------------
const BREVO_API = "https://api.brevo.com/v3";

async function brevo(path: string, body: unknown) {
  const res = await fetch(`${BREVO_API}${path}`, {
    method: "POST",
    headers: {
      "api-key": Deno.env.get("BREVO_API_KEY")!,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    // 400 "Contact already exist" n'est pas une vraie erreur
    if (!text.includes("duplicate_parameter")) {
      throw new Error(`Brevo ${path} ${res.status}: ${text}`);
    }
  }
}

/** Inscription newsletter avec double opt-in (obligatoire RGPD en pratique). */
export function brevoDoubleOptIn(email: string, firstName?: string) {
  return brevo("/contacts/doubleOptinConfirmation", {
    email,
    attributes: firstName ? { PRENOM: firstName } : {},
    includeListIds: [Number(Deno.env.get("BREVO_LIST_NEWSLETTER"))],
    templateId: Number(Deno.env.get("BREVO_DOI_TEMPLATE_ID")),
    redirectionUrl: `${SITE_URL}/newsletter-confirmee.html`,
  });
}

/** Ajout direct d'un acheteur dans la liste « clients » (relation contractuelle). */
export function brevoAddCustomer(email: string, courseSlug: string) {
  return brevo("/contacts", {
    email,
    updateEnabled: true,
    listIds: [Number(Deno.env.get("BREVO_LIST_CLIENTS"))],
    attributes: { FORMATION: courseSlug },
  });
}
