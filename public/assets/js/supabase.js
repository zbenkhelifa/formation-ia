// Client Supabase + petits outils partagés entre les pages
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const $ = (sel, root = document) => root.querySelector(sel);

export function afficherMessage(el, texte, type = "ok") {
  el.textContent = texte;
  el.className = `message ${type}`;
}

export function echapper(texte = "") {
  return String(texte).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function formaterPrix(centimes, devise = "eur") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: devise.toUpperCase(), maximumFractionDigits: centimes % 100 ? 2 : 0 }).format(centimes / 100);
}

/** Renvoie la session courante ou redirige vers la page de connexion. */
export async function exigerConnexion() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.href = `connexion.html?retour=${encodeURIComponent(location.pathname + location.search)}`;
    return null;
  }
  return session;
}

/** Met à jour les liens "Mon espace" / "Connexion" de l'en-tête. */
export async function majEntete() {
  const lien = $("#lien-compte");
  if (!lien) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (session) { lien.textContent = "Mon espace"; lien.href = "espace.html"; }
}

/** Lien YouTube / Vimeo → URL d'intégration. Tout autre lien est intégré tel quel s'il est en https. */
export function urlVideo(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v") || u.pathname.split("/").pop();
      return `https://www.youtube-nocookie.com/embed/${id}`;
    }
    if (u.hostname === "youtu.be") return `https://www.youtube-nocookie.com/embed${u.pathname}`;
    if (u.hostname.includes("vimeo.com") && !u.hostname.startsWith("player")) return `https://player.vimeo.com/video${u.pathname}`;
    return u.href;
  } catch { return null; }
}

/** Branche un formulaire newsletter (champs name="email", "first_name", piège "website"). */
export function brancherNewsletter(form) {
  if (!form) return;
  const msg = form.querySelector(".message");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const bouton = form.querySelector("button");
    bouton.disabled = true;
    const donnees = Object.fromEntries(new FormData(form));
    const { data, error } = await supabase.functions.invoke("newsletter-subscribe", { body: donnees });
    bouton.disabled = false;
    if (error || data?.error) {
      afficherMessage(msg, data?.error || "L'inscription n'a pas fonctionné. Réessaie dans un instant.", "erreur");
      return;
    }
    form.reset();
    afficherMessage(msg, "Presque fini : clique sur le lien de confirmation reçu par e-mail.");
  });
}

majEntete();
