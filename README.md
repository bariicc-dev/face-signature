# Face Signature — Plateforme réservation

Site vitrine + réservation + admin mobile-first pour Face Signature.

Le système enregistre les RDV dans Supabase, envoie les emails via Resend, puis copie automatiquement chaque nouveau RDV dans l'agenda Google de la propriétaire avec l'API Google Calendar.

---

## Fonctionnalités

- Site public : accueil, tarifs, réservation, adresse
- Réservation avec contrôle anti-double-booking basé sur Supabase
- Emails automatiques cliente + admin
- Lien manuel "Ajouter à Google Calendar" pour la cliente
- Copie automatique du RDV dans l'agenda Google propriétaire
- Statut agenda visible dans l'admin : `Agenda OK`, `Agenda erreur`, `Agenda non configuré`
- Admin `/admin` protégé par login Supabase
- Dashboard mobile-first avec notifications temps réel

---

## Architecture

```text
Cliente /book
  -> Next.js /api/bookings
    -> Supabase bookings (source de vérité)
    -> Google Calendar API events.insert (miroir agenda propriétaire)
    -> Resend emails cliente + admin
  -> Admin /admin lit Supabase en temps réel
```

Important : Supabase reste la source de vérité pour les disponibilités publiques. Google Calendar sert à copier les RDV Face Signature dans l'agenda propriétaire. Les événements privés déjà présents dans Google Calendar ne bloquent pas les créneaux publics tant qu'une vraie synchronisation busy/free Google Calendar n'est pas ajoutée.

---

## Variables d'environnement

Copie `.env.local.example` vers `.env.local` en local, puis ajoute les mêmes variables dans Vercel.

| Nom | Usage |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique Supabase anon |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé serveur Supabase, jamais exposée au navigateur |
| `RESEND_API_KEY` | Clé API Resend |
| `ADMIN_EMAIL` | Email qui reçoit les notifications admin |
| `FROM_EMAIL` | Expéditeur Resend, idéalement domaine vérifié |
| `GOOGLE_CALENDAR_ID` | ID de l'agenda Google propriétaire à alimenter |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Email du service account Google Cloud |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Clé privée du service account, avec `\n` conservés |
| `GOOGLE_SERVICE_ACCOUNT_PROJECT_ID` | ID du projet Google Cloud, utile pour l'exploitation |

Aucun secret ne doit être commité. `.env.local` doit rester local.

---

## Étape 1 — Supabase

1. Crée un projet sur [supabase.com](https://supabase.com).
2. Va dans **SQL Editor → New Query**.
3. Copie-colle `supabase-schema.sql`, puis clique **Run**.
4. Va dans **Authentication → Users → Add user → Create new user**.
5. Crée l'utilisateur admin de Mariam et coche **Auto Confirm User**.
6. Va dans **Project Settings → API** et récupère :
   - `Project URL` -> `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` -> `SUPABASE_SERVICE_ROLE_KEY`

Pour un projet déjà déployé, le fichier SQL est non destructif : il ajoute les colonnes agenda avec `alter table if exists ... add column if not exists`.

---

## Étape 2 — Resend

1. Crée un compte sur [resend.com](https://resend.com).
2. Va dans **API Keys → Create API Key** et copie la clé `re_...`.
3. En test, `FROM_EMAIL=onboarding@resend.dev` fonctionne avec les limites Resend.
4. En production, ajoute le domaine d'envoi dans **Domains → Add Domain** et configure les DNS. Sans domaine vérifié, Resend limite fortement les destinataires.

L'email admin garde `replyTo` sur l'email de la cliente pour répondre directement.

---

## Étape 3 — Google Calendar

Approche implémentée : service account + agenda partagé. C'est le plus simple pour une propriétaire solo, sans flow OAuth public.

1. Va dans [Google Cloud Console](https://console.cloud.google.com/).
2. Crée un projet, par exemple `face-signature-calendar`.
3. Va dans **APIs & Services → Library**.
4. Active **Google Calendar API**.
5. Va dans **IAM & Admin → Service Accounts**.
6. Clique **Create service account**.
7. Donne un nom, par exemple `face-signature-calendar`.
8. Ouvre le service account créé, onglet **Keys**.
9. Clique **Add key → Create new key → JSON**.
10. Dans le JSON téléchargé, récupère :
    - `client_email` -> `GOOGLE_SERVICE_ACCOUNT_EMAIL`
    - `private_key` -> `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
    - `project_id` -> `GOOGLE_SERVICE_ACCOUNT_PROJECT_ID`
11. Dans Google Calendar, ouvre l'agenda propriétaire.
12. Va dans **Settings and sharing**.
13. Copie **Calendar ID** -> `GOOGLE_CALENDAR_ID`.
14. Dans **Share with specific people or groups**, ajoute l'email du service account.
15. Donne la permission **Make changes to events**.

Limitation Google : un service account ne peut écrire dans un agenda personnel que si cet agenda lui est partagé. Si le compte Google de la propriétaire bloque ce partage, crée un agenda secondaire `Face Signature RDV` et partage cet agenda, ou passe à une intégration OAuth refresh token côté serveur.

---

## Étape 4 — Vercel

1. Va sur [vercel.com](https://vercel.com) → **Add New → Project**.
2. Importe le repo GitHub.
3. Dans **Environment Variables**, ajoute toutes les variables listées plus haut.
4. Pour `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, colle la clé complète entre guillemets avec les `\n`, par exemple :

```env
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

5. Déploie.
6. Après modification des variables, redéploie toujours le projet.

---

## Admin mobile

L'espace `/admin` est organise comme une petite app mobile avec 5 onglets :

- `Aujourd'hui` : RDV du jour, actions rapides, CA du mois.
- `Agenda` : vues jour, semaine et mois, avec RDV groupes par date.
- `Ajouter` : creation manuelle d'un RDV telephone/DM.
- `Clients` : recherche simple derivee des anciens RDV.
- `Stats` : CA et volumes par mois.

Les RDV manuels utilisent la meme table `bookings` que le booking public. Aucun paiement n'est gere. Le prix et la duree viennent du soin choisi, mais restent modifiables pour un cas particulier.

Par defaut, un RDV manuel est `confirmed` et n'envoie pas d'email. La case "Envoyer une confirmation a la cliente" envoie seulement l'email cliente si une adresse email est presente. L'email admin n'est pas envoye pour les RDV manuels afin d'eviter le spam.

Le formulaire manuel recherche les clientes existantes dans les anciens RDV par nom, telephone ou email. Il n'y a pas de table `clients` separee : les fiches clientes sont derivees des reservations existantes pour garder le projet simple.

### Calcul CA

- `CA realise` : RDV `completed`, plus RDV `confirmed` dont la date est deja passee.
- `CA prevu` : RDV futurs `pending` ou `confirmed`.
- Les RDV `cancelled` ne sont jamais comptes dans le CA.
- Le prix personnalise d'un RDV manuel est stocke dans `bookings.total` et compte donc dans les stats.

---

## Lancer en local

```bash
cp .env.local.example .env.local
npm install
npm run dev
```

Pages utiles :

- `/` accueil
- `/prices` tarifs
- `/book` réservation
- `/location` adresse
- `/admin/login` login admin
- `/admin` dashboard

---

## Tester avant livraison client

1. Lance `npm install`.
2. Lance `npm run build`.
3. Lance `npm run lint` si le lint est configuré dans l'environnement.
4. Ouvre `/` et vérifie l'accueil.
5. Ouvre `/book`.
6. Choisis un soin, une date et une heure.
7. Soumets une réservation avec une vraie adresse email de test.
8. Vérifie dans Supabase que la ligne `bookings` existe.
9. Vérifie que `calendar_sync_status` vaut `synced`.
10. Ouvre le Google Calendar propriétaire et vérifie l'événement.
11. Vérifie l'email cliente.
12. Vérifie l'email admin, avec le statut agenda.
13. Ouvre `/admin`, connecte-toi, vérifie le RDV et le badge agenda.
14. Ouvre l'onglet `Agenda` et vérifie que le RDV apparait.
15. Ouvre l'onglet `Ajouter`, cree un RDV manuel et verifie qu'il apparait dans Aujourd'hui/Agenda/Clients/Stats.
16. Tente un RDV manuel sur un creneau deja occupe et verifie le message de conflit.
17. Marque un RDV `Termine` et verifie qu'il entre dans le CA realise.
18. Annule un RDV et verifie qu'il ne compte pas dans le CA.

Si `calendar_sync_status=error`, consulte **Vercel → Project → Logs**. Le RDV et les emails restent indépendants de l'échec agenda.

---

## Ce qu'il faut envoyer à la cliente

```text
Hello Mariam, voici ton espace admin Face Signature :
https://TON-DOMAINE/admin/login

1. Ouvre le lien sur iPhone avec Safari.
2. Connecte-toi avec ton email et le mot de passe fourni.
3. Appuie sur Partager puis Sur l'écran d'accueil.
4. Une icône Face Signature sera ajoutée comme une app.

Les nouveaux RDV arrivent dans l'admin, par email, et dans ton agenda Google.
```

---

## Modifier les tarifs

Va dans Supabase → **Table Editor → services**. Modifie les prix, durées ou noms directement. Aucun redéploiement n'est nécessaire.

Pour ajouter un soin, insère une ligne dans `services` avec un `id` unique, une catégorie, un nom, un prix, une durée et un ordre d'affichage.

---

## Limites connues

- Les disponibilités publiques sont calculées depuis les RDV Supabase uniquement.
- Les événements privés déjà présents dans Google Calendar ne bloquent pas encore les créneaux publics.
- L'intégration actuelle est un miroir à sens unique : Supabase -> Google Calendar.
- Une future amélioration peut interroger Google Calendar FreeBusy avant d'afficher les créneaux.
- La suppression ou l'annulation d'un RDV dans l'admin ne supprime pas encore automatiquement l'événement Google Calendar.

---

## Structure

```text
face-signature/
├── app/api/bookings/route.ts   # Creation booking public + sync agenda + emails
├── app/api/admin/bookings/route.ts # Creation RDV manuel admin
├── app/book/                   # Flow réservation public
├── app/admin/                  # Dashboard admin
├── lib/email.ts                # Templates Resend
├── lib/google-calendar.ts      # Google Calendar API server-only
├── lib/supabase-server.ts      # Supabase serveur/admin
├── lib/supabase-browser.ts     # Supabase navigateur
├── public/                     # PWA icons
├── supabase-schema.sql         # Schéma + migration Supabase
└── README.md
```
