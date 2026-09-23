-- =====================================================================
-- Seed : la formation « Coder avec l'IA en 30 jours »
-- Le prix (price_cents) et le stripe_price_id sont à ajuster.
-- Le contenu de chaque leçon est un squelette à compléter depuis /admin.html
-- =====================================================================

insert into public.courses (slug, title, subtitle, description_md, price_cents, currency, published)
values (
  'coder-avec-ia-30-jours',
  'Coder avec l''IA en 30 jours',
  'De zéro à ta première application en ligne, 30 minutes par jour — pensé pour les profs et les grands débutants.',
  E'Tu n''as jamais codé ? Parfait.\n\nEn 30 jours, tu apprends à piloter une IA pour construire de vrais outils : un site, un formulaire, une petite application, un outil pour ta classe. Chaque jour : une leçon courte, une capsule vidéo et un exercice concret.',
  4900,            -- 49 € : à ajuster
  'eur',
  true
)
on conflict (slug) do nothing;

with c as (select id from public.courses where slug = 'coder-avec-ia-30-jours')
insert into public.lessons (course_id, position, title, summary, content_md, is_free_preview)
select c.id, d.pos, d.title, d.summary,
       E'## Objectif du jour\n\n' || d.summary || E'\n\n## La leçon\n\n_À rédiger._\n\n## Exercice\n\n_À rédiger._\n\n## Le prompt du jour\n\n```\nÀ rédiger\n```',
       d.pos <= 2
from c, (values
  -- Semaine 1 — Les bases
  ( 1, 'Bienvenue : ce que l''IA peut (et ne peut pas) coder pour toi', 'Comprendre le rôle de l''IA, fixer ton projet fil rouge et installer ton espace de travail.'),
  ( 2, 'Ton premier prompt qui produit du code', 'Écrire une demande claire et obtenir une page web qui fonctionne en 10 minutes.'),
  ( 3, 'HTML sans douleur', 'Lire le code généré, repérer les balises et modifier une page toi-même.'),
  ( 4, 'CSS : rendre ta page jolie', 'Couleurs, polices, mise en page : demander un style précis et l''ajuster.'),
  ( 5, 'Publier ta page sur Internet', 'Mettre ta première page en ligne gratuitement avec GitHub Pages.'),
  ( 6, 'Le bon réflexe : itérer avec l''IA', 'Décrire un bug, donner du contexte, demander une correction ciblée.'),
  ( 7, 'Bilan semaine 1', 'Ta page perso en ligne + checklist des acquis.'),
  -- Semaine 2 — Rendre interactif
  ( 8, 'JavaScript : faire réagir la page', 'Boutons, clics, messages : ton premier script expliqué ligne par ligne.'),
  ( 9, 'Un quiz pour ta classe', 'Construire un quiz interactif avec score, réutilisable en cours.'),
  (10, 'Les formulaires', 'Collecter des réponses sans serveur avec un service de formulaire.'),
  (11, 'Stocker des données dans le navigateur', 'Sauvegarder une liste ou des préférences avec localStorage.'),
  (12, 'Lire des données : JSON et API', 'Afficher des données externes (météo, citations…) dans ta page.'),
  (13, 'Déboguer avec la console', 'Lire une erreur, la donner à l''IA et comprendre la correction.'),
  (14, 'Bilan semaine 2', 'Un mini-outil interactif publié + auto-évaluation.'),
  -- Semaine 3 — Outils pro
  (15, 'Git et GitHub sans peur', 'Sauvegarder, versionner et revenir en arrière.'),
  (16, 'Coder dans le navigateur avec Codespaces', 'Un environnement de dev complet sans rien installer.'),
  (17, 'Un assistant IA dans l''éditeur', 'Travailler avec un assistant de code directement dans tes fichiers.'),
  (18, 'Organiser un projet en plusieurs fichiers', 'Séparer HTML, CSS et JS, et faire comprendre la structure à l''IA.'),
  (19, 'Responsive : ton site sur téléphone', 'Adapter l''affichage aux écrans de tes élèves.'),
  (20, 'Accessibilité et bonnes pratiques', 'Contrastes, textes alternatifs, navigation clavier.'),
  (21, 'Bilan semaine 3', 'Ton projet fil rouge versionné sur GitHub.'),
  -- Semaine 4 — Une vraie application
  (22, 'Une base de données avec Supabase', 'Créer une table et lire/écrire des données depuis ta page.'),
  (23, 'Des comptes utilisateurs', 'Ajouter une connexion par e-mail à ton application.'),
  (24, 'Sécuriser les données', 'Qui a le droit de voir quoi : les règles d''accès expliquées simplement.'),
  (25, 'Héberger avec Firebase', 'Déployer une application complète avec un nom de domaine.'),
  (26, 'Transformer ton site en application mobile', 'PWA : installable sur téléphone, utilisable hors ligne.'),
  (27, 'Automatiser avec l''IA', 'Scripts pour gagner du temps : corrections, listes, documents.'),
  (28, 'Relire le code de l''IA', 'Repérer les erreurs, les failles et le code inutile.'),
  (29, 'Finaliser ton projet', 'Derniers réglages, tests et mise en ligne définitive.'),
  (30, 'Et après ?', 'Présenter ton projet, continuer à progresser et aller plus loin.')
) as d(pos, title, summary)
on conflict (course_id, position) do nothing;
