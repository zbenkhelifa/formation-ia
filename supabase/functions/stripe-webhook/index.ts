// Webhook Stripe : enregistre l'achat, ajoute l'acheteur dans Brevo, gère les remboursements.
// Événements à cocher dans Stripe : checkout.session.completed, charge.refunded
import Stripe from "npm:stripe@17";
import { adminClient, brevoAddCustomer } from "../_shared/utils.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Signature manquante", { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await req.text(),
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
      undefined,
      cryptoProvider,
    );
  } catch (e) {
    console.error("Signature invalide", e);
    return new Response("Signature invalide", { status: 400 });
  }

  const db = adminClient();

  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.payment_status !== "paid") return new Response("ignoré", { status: 200 });

      const email = (s.customer_details?.email ?? s.customer_email ?? "").toLowerCase();
      const courseId = s.metadata?.course_id;
      if (!email || !courseId) throw new Error(`Session ${s.id} sans email ou course_id`);

      // Rattache au compte s'il existe déjà
      const { data: profile } = await db.from("profiles").select("id").eq("email", email).maybeSingle();

      const { error } = await db.from("purchases").upsert(
        {
          course_id: courseId,
          email,
          user_id: profile?.id ?? null,
          stripe_session_id: s.id,
          stripe_customer_id: typeof s.customer === "string" ? s.customer : null,
          amount_cents: s.amount_total,
          currency: s.currency,
          status: "paid",
        },
        { onConflict: "stripe_session_id" },
      );
      if (error) throw error;

      // Brevo : un échec ici ne doit pas bloquer l'accès à la formation
      try {
        await brevoAddCustomer(email, s.metadata?.course_slug ?? "");
      } catch (e) {
        console.error("Brevo", e);
      }
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      if (charge.refunded && charge.payment_intent) {
        const sessions = await stripe.checkout.sessions.list({
          payment_intent: String(charge.payment_intent),
          limit: 1,
        });
        const sessionId = sessions.data[0]?.id;
        if (sessionId) {
          await db.from("purchases").update({ status: "refunded" }).eq("stripe_session_id", sessionId);
        }
      }
    }
  } catch (e) {
    console.error(e);
    return new Response("Erreur de traitement", { status: 500 }); // Stripe réessaiera
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
