// Back-office : créer / modifier les formations et leurs leçons.
// La sécurité est assurée côté base (RLS : seules les écritures d'un admin passent).
import { marked } from "https://cdn.jsdelivr.net/npm/marked@12/+esm";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3/+esm";
import { supabase, exigerConnexion, afficherMessage, echapper, formaterPrix, $ } from "./supabase.js";

const session = await exigerConnexion();
if (session) {
  const { data: profil } = await supabase.from("profiles").select("is_admin").eq("id", session.user.id).maybeSingle();
  if (!profil?.is_admin) $("#refus").classList.remove("cache");
  else demarrer();
}

let cours = [];          // toutes les formations
let coursActif = null;   // formation sélectionnée
let lecons = [];         // leçons de la formation active
let leconActive = null;  // leçon en cours d'édition (null = nouvelle)

async function demarrer() {
  $("#admin").classList.remove("cache");
  await chargerCours();
  $("#choix-cours").addEventListener("change", (e) => selectionnerCours(e.target.value));
  $("#nouveau-cours").addEventListener("click", nouveauCours);
  $("#form-cours").addEventListener("submit", enregistrerCours);
  $("#nouvelle-lecon").addEventListener("click", () => ouvrirLecon(null));
  $("#form-lecon").addEventListener("submit", enregistrerLecon);
  $("#supprimer-lecon").addEventListener("click", supprimerLecon);
  document.querySelectorAll("[data-onglet]").forEach((b) => b.addEventListener("click", () => basculerOnglet(b.dataset.onglet)));
}

// ---------------- Formations ----------------
async function chargerCours(idASelectionner) {
  const { data, error } = await supabase.from("courses").select("*").order("created_at");
  if (error) return afficherMessage($("#form-cours .message"), error.message, "erreur");
  cours = data;
  $("#choix-cours").innerHTML = cours.map((c) =>
    `<option value="${c.id}">${echapper(c.title)}${c.published ? "" : " (brouillon)"}</option>`).join("");
  const id = idASelectionner || coursActif?.id || cours[0]?.id;
  if (id) { $("#choix-cours").value = id; await selectionnerCours(id); }
  else nouveauCours();
}

async function selectionnerCours(id) {
  coursActif = cours.find((c) => c.id === id) || null;
  remplirFormCours(coursActif);
  await chargerVentes();
  await chargerLecons();
}

function nouveauCours() {
  coursActif = null;
  remplirFormCours(null);
  lecons = [];
  afficherListeLecons();
  $("#form-lecon").classList.add("cache");
  $("#ventes").textContent = "Nouvelle formation : enregistre-la pour pouvoir ajouter des leçons.";
  $("#form-cours [name=title]").focus();
}

function remplirFormCours(c) {
  const f = $("#form-cours");
  f.title.value = c?.title ?? "";
  f.slug.value = c?.slug ?? "";
  f.subtitle.value = c?.subtitle ?? "";
  f.description_md.value = c?.description_md ?? "";
  f.prix.value = c ? (c.price_cents / 100).toFixed(2) : "";
  f.stripe_price_id.value = c?.stripe_price_id ?? "";
  f.published.checked = !!c?.published;
  f.querySelector(".message").textContent = "";
}

async function enregistrerCours(e) {
  e.preventDefault();
  const f = e.target;
  const msg = f.querySelector(".message");
  const donnees = {
    title: f.title.value.trim(),
    slug: f.slug.value.trim(),
    subtitle: f.subtitle.value.trim() || null,
    description_md: f.description_md.value,
    price_cents: Math.round(parseFloat(f.prix.value || "0") * 100),
    stripe_price_id: f.stripe_price_id.value.trim() || null,
    published: f.published.checked,
  };
  const requete = coursActif
    ? supabase.from("courses").update(donnees).eq("id", coursActif.id).select().single()
    : supabase.from("courses").insert(donnees).select().single();
  const { data, error } = await requete;
  if (error) return afficherMessage(msg, error.code === "23505" ? "Ce slug est déjà utilisé." : error.message, "erreur");
  await chargerCours(data.id);
  afficherMessage($("#form-cours .message"), "Formation enregistrée.");
}

async function chargerVentes() {
  if (!coursActif) return;
  const { data } = await supabase.from("purchases").select("amount_cents, status").eq("course_id", coursActif.id);
  const payes = (data || []).filter((p) => p.status === "paid");
  const total = payes.reduce((s, p) => s + (p.amount_cents || 0), 0);
  $("#ventes").textContent = `${payes.length} vente${payes.length > 1 ? "s" : ""} pour ${formaterPrix(total, coursActif.currency)} encaissés.`;
}

// ---------------- Leçons ----------------
async function chargerLecons(idASelectionner) {
  if (!coursActif) return;
  const { data, error } = await supabase.from("lessons").select("*").eq("course_id", coursActif.id).order("position");
  if (error) return;
  lecons = data;
  afficherListeLecons();
  const cible = lecons.find((l) => l.id === (idASelectionner || leconActive?.id));
  if (cible) ouvrirLecon(cible);
  else $("#form-lecon").classList.add("cache");
}

function afficherListeLecons() {
  $("#liste-lecons").innerHTML = lecons.length
    ? lecons.map((l) => `<li><button type="button" data-id="${l.id}" aria-current="${l.id === leconActive?.id}">
        <span class="num">J${l.position}</span>${echapper(l.title)}${l.published ? "" : " <em>(brouillon)</em>"}${l.is_free_preview ? ' <span class="badge">Gratuit</span>' : ""}
      </button></li>`).join("")
    : `<li style="padding: 14px;">Aucune leçon. Ajoute la première.</li>`;
  $("#liste-lecons").querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => ouvrirLecon(lecons.find((l) => l.id === b.dataset.id))));
}

function ouvrirLecon(l) {
  if (!coursActif) return;
  leconActive = l;
  const f = $("#form-lecon");
  f.classList.remove("cache");
  f.position.value = l?.position ?? (Math.max(0, ...lecons.map((x) => x.position)) + 1);
  f.title.value = l?.title ?? "";
  f.summary.value = l?.summary ?? "";
  f.video_url.value = l?.video_url ?? "";
  f.content_md.value = l?.content_md ?? "## Objectif du jour\n\n\n## La leçon\n\n\n## Exercice\n\n";
  f.is_free_preview.checked = !!l?.is_free_preview;
  f.published.checked = l ? l.published : true;
  $("#supprimer-lecon").classList.toggle("cache", !l);
  $("#voir-lecon").classList.toggle("cache", !l);
  $("#voir-lecon").href = l ? `lecon.html?cours=${encodeURIComponent(coursActif.slug)}&jour=${l.position}` : "#";
  f.querySelector(".message").textContent = "";
  basculerOnglet("ecrire");
  afficherListeLecons();
  f.title.focus();
}

async function enregistrerLecon(e) {
  e.preventDefault();
  const f = e.target;
  const msg = f.querySelector(".message");
  const donnees = {
    course_id: coursActif.id,
    position: parseInt(f.position.value, 10),
    title: f.title.value.trim(),
    summary: f.summary.value.trim() || null,
    video_url: f.video_url.value.trim() || null,
    content_md: f.content_md.value,
    is_free_preview: f.is_free_preview.checked,
    published: f.published.checked,
  };
  const requete = leconActive
    ? supabase.from("lessons").update(donnees).eq("id", leconActive.id).select().single()
    : supabase.from("lessons").insert(donnees).select().single();
  const { data, error } = await requete;
  if (error) {
    return afficherMessage(msg, error.code === "23505" ? `Le jour ${donnees.position} existe déjà dans cette formation.` : error.message, "erreur");
  }
  leconActive = data;
  await chargerLecons(data.id);
  afficherMessage($("#form-lecon .message"), "Leçon enregistrée.");
}

async function supprimerLecon() {
  if (!leconActive || !confirm(`Supprimer définitivement « ${leconActive.title} » ?`)) return;
  const { error } = await supabase.from("lessons").delete().eq("id", leconActive.id);
  if (error) return afficherMessage($("#form-lecon .message"), error.message, "erreur");
  leconActive = null;
  await chargerLecons();
}

function basculerOnglet(onglet) {
  const apercu = onglet === "apercu";
  $("#editeur").classList.toggle("cache", apercu);
  $("#apercu").classList.toggle("cache", !apercu);
  if (apercu) $("#apercu").innerHTML = DOMPurify.sanitize(marked.parse($("#editeur").value));
  document.querySelectorAll("[data-onglet]").forEach((b) =>
    b.classList.toggle("btn-secondaire", b.dataset.onglet !== onglet));
}
