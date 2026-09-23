# Coder avec l'IA en 30 jours — site, tunnel de vente, espace membre et newsletter

Stack : **Firebase Hosting** (site statique) + **Supabase** (comptes, formations, accès) + **Stripe** (paiement) + **Brevo** (newsletter et liste clients).
Aucun abonnement mensuel à une plateforme : tout est gratuit à ton échelle, hors frais Stripe par vente.

## Ce que contient le projet

| Page | Rôle |
|---|---|
| `index.html` | Site vitrine « prof le jour, développeur le soir » + inscription newsletter |
| `formation.html` | Page de vente (tunnel) : promesse → pour qui → programme → formateur → offre → FAQ |
| `merci.html` | Après paiement : envoi du lien d'accès |
| `connexion.html` | Connexion sans mot de passe (lien magique par e-mail) |
| `espace.html` | Espace élève : les 30 jours, progression, bouton « Continuer » |
| `lecon.html?jour=N` | Une leçon : Markdown + vidéo + « J'ai terminé ce jour » |
| `admin.html` | **Création de formation** : formations, prix, leçons, éditeur Markdown avec aperçu, ventes |
| `newsletter-confirmee.html` | Page de retour du double opt-in Brevo |
| `mentions-legales.html` | Mentions légales, CGV, confidentialité (**modèle à compléter**) |

Côté serveur (`supabase/`) :
- `migrations/…_init.sql` : tables `profiles`, `courses`, `lessons`, `purchases`, `progress` + règles d'accès (RLS).
- `seed.sql` : la formation et ses 30 jours (titres et résumés, contenus à rédiger).
- `functions/create-checkout` : crée la page de paiement Stripe.
- `functions/stripe-webhook` : enregistre l'achat, ajoute l'acheteur dans Brevo, gère les remboursements.
- `functions/newsletter-subscribe` : inscription newsletter en double opt-in.

### Le parcours d'un acheteur
1. `formation.html` → il saisit son e-mail, coche l'accès immédiat, paie sur Stripe.
2. Stripe appelle le webhook → ligne dans `purchases` + contact dans la liste « clients » de Brevo.
3. `merci.html` → il reçoit un lien de connexion → `espace.html` avec les 30 jours débloqués.

L'accès est lié à **l'e-mail du paiement** : même s'il crée son compte après, l'achat lui est rattaché automatiquement.

---

## Mise en route (≈ 1 h la première fois)

Prérequis sur ton Lubuntu ou dans un Codespace : Node.js, puis
```bash
npm i -g supabase firebase-tools
```

### 1. Supabase
1. Crée un projet sur supabase.com (région **EU**, par exemple Paris ou Francfort).
2. Dans le dossier du projet :
   ```bash
   supabase login
   supabase link --project-ref TON_REF
   supabase db push                       # applique la migration
   ```
   Puis colle le contenu de `supabase/seed.sql` dans **SQL Editor** et exécute-le.
3. **Authentication → URL Configuration** : mets `Site URL` = l'adresse de ton site et ajoute `https://ton-site/*` dans *Redirect URLs*.
4. Recopie l'URL du projet et la clé `anon` dans `public/assets/js/config.js`.

### 2. Stripe (commence en mode test)
1. Crée un produit « Coder avec l'IA en 30 jours » avec un prix unique → copie l'identifiant `price_…`.
2. Réglages → Factures : ajoute la mention **« TVA non applicable, art. 293 B du CGI »** et ton SIRET.
3. Développeurs → Webhooks → ajoute l'URL
   `https://TON_REF.supabase.co/functions/v1/stripe-webhook`
   avec les événements `checkout.session.completed` et `charge.refunded` → copie le secret `whsec_…`.

### 3. Brevo
1. Crée deux listes : **Newsletter** et **Clients** (note leurs numéros).
2. Crée un modèle d'e-mail de **confirmation double opt-in** (bouton avec le lien `{{ doubleoptin }}`) → note son numéro.
3. Crée les attributs de contact `PRENOM` (texte) et `FORMATION` (texte).
4. Copie ta clé API v3.

### 4. Secrets et déploiement des fonctions
```bash
cp supabase/.env.example supabase/.env      # puis remplis les valeurs
supabase secrets set --env-file supabase/.env
supabase functions deploy create-checkout --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy newsletter-subscribe --no-verify-jwt
```
(`--no-verify-jwt` : ces fonctions sont appelées par des visiteurs non connectés et par Stripe.)

### 5. Firebase Hosting
```bash
firebase login
cp .firebaserc.example .firebaserc          # mets l'ID de ton projet Firebase
firebase deploy --only hosting
```
Ajoute ton nom de domaine dans la console Firebase si tu en as un, puis mets à jour `SITE_URL` (secrets Supabase) et les URL d'authentification.

### 6. Devenir admin
Connecte-toi une fois sur `connexion.html`, puis dans l'éditeur SQL de Supabase :
```sql
update public.profiles set is_admin = true where email = 'ton@email.fr';
```
Ensuite, `admin.html` te permet de régler le prix, coller le `price_…` Stripe, rédiger les 30 leçons et suivre les ventes.

### 7. Tester le tunnel
Avec Stripe en mode test, paie avec la carte `4242 4242 4242 4242` (date future, n'importe quel CVC), puis vérifie :
- une ligne dans la table `purchases` ;
- le contact dans la liste Clients de Brevo ;
- l'accès aux 30 jours dans `espace.html`.

Passe Stripe en mode live (nouvelles clés, nouveau webhook, nouveau `price_…`) seulement quand tout fonctionne.

---

## Avant de vendre
- Complète tous les **[À COMPLÉTER]** de `mentions-legales.html` (adresse, SIRET, e-mail, **médiateur de la consommation**, obligatoire pour vendre à des particuliers) et fais relire les CGV : c'est un modèle, pas un conseil juridique.
- Ajuste le prix (49 € dans le seed) depuis `admin.html`.
- Rédige les leçons : chaque jour a déjà un squelette Objectif / Leçon / Exercice / Prompt du jour.

## Aller plus loin avec Claude Code
Ouvre le dossier et demande par exemple :
- « Ajoute une séquence de bienvenue Brevo déclenchée par la liste Clients » ;
- « Ajoute un blog en Markdown avec une page par article » ;
- « Ajoute une offre établissement avec plusieurs licences ».

Limites actuelles : l'espace élève affiche une formation (celle de `COURSE_SLUG` dans `config.js`) ; `admin.html` en gère déjà plusieurs, et `lecon.html?cours=slug&jour=N` fonctionne pour toutes.
