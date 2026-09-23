// POST { course_slug, email? } → { url } (page de paiement Stripe Checkout)
import Stripe from "npm:stripe@17";
import { adminClient, corsHeaders, EMAIL_RE, json, SITE_URL } from "../_shared/utils.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    const { course_slug, email } = await req.json();
    if (typeof course_slug !== "string") return json({ error: "course_slug manquant" }, 400);

    const { data: course, error } = await adminClient()
      .from("courses")
      .select("id, slug, title, stripe_price_id, published")
      .eq("slug", course_slug)
      .single();

    if (error || !course?.published) return json({ error: "Formation introuvable" }, 404);
    if (!course.stripe_price_id) return json({ error: "Prix Stripe non configuré" }, 500);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: course.stripe_price_id, quantity: 1 }],
      customer_email: typeof email === "string" && EMAIL_RE.test(email) ? email : undefined,
      customer_creation: "always",
      allow_promotion_codes: true,
      invoice_creation: { enabled: true }, // facture automatique (mention TVA à régler dans Stripe)
      locale: "fr",
      metadata: { course_id: course.id, course_slug: course.slug },
      success_url: `${SITE_URL}/merci.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/formation.html?annule=1`,
    });

    return json({ url: session.url });
  } catch (e) {
    console.error(e);
    return json({ error: "Impossible de créer le paiement" }, 500);
  }
});
