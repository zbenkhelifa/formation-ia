// POST { email, first_name?, website? } → inscription newsletter en double opt-in via Brevo
// "website" est un champ piège (honeypot) : rempli uniquement par les robots.
import { brevoDoubleOptIn, corsHeaders, EMAIL_RE, json } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    const { email, first_name, website } = await req.json();

    // Robot détecté : on fait semblant que tout va bien
    if (website) return json({ ok: true });

    const cleanEmail = String(email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 254) {
      return json({ error: "Adresse e-mail invalide" }, 400);
    }
    const name = typeof first_name === "string" ? first_name.trim().slice(0, 60) : undefined;

    await brevoDoubleOptIn(cleanEmail, name || undefined);
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: "Inscription impossible pour le moment" }, 500);
  }
});
