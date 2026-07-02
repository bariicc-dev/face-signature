# Face Signature

Site vitrine, reservation publique et app admin mobile-first pour Face Signature.

## Fonctionnalites

- Pages publiques : accueil, tarifs, reservation, confirmation, adresse.
- Reservations stockees dans Supabase.
- Anti-double-booking sur les reservations publiques et les RDV manuels admin.
- Emails Resend pour les reservations publiques.
- App admin protegee par Supabase Auth.
- Agenda admin avec vues jour/semaine, blocs RDV par heure, actions et reprogrammation.
- Ajout manuel de RDV pour les clientes par telephone ou DM.
- Recherche cliente simple derivee de l'historique des bookings.
- Stats mensuelles avec CA realise, CA prevu, RDV termines, annules et ticket moyen.

## Variables d'environnement

Copier `.env.local.example` vers `.env.local`, puis ajouter les memes valeurs dans Vercel.

| Nom | Usage |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cle publique Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Cle serveur Supabase, a garder secrete |
| `RESEND_API_KEY` | Cle API Resend |
| `ADMIN_EMAIL` | Email qui recoit les notifications admin |
| `FROM_EMAIL` | Email expediteur Resend, idealement domaine verifie |

Ne pas commiter `.env.local`.

## Supabase

1. Creer un projet Supabase.
2. Ouvrir **SQL Editor**.
3. Executer `supabase-schema.sql`.
4. Creer un utilisateur admin dans **Authentication > Users**.
5. Recuperer les cles dans **Project Settings > API**.

Aucune table clients separee n'est requise : l'admin derive les fiches clientes depuis les lignes `bookings`.

## Resend

1. Creer une cle API dans Resend.
2. Renseigner `RESEND_API_KEY`.
3. En production, verifier le domaine d'envoi et utiliser ce domaine dans `FROM_EMAIL`.

Les RDV manuels n'envoient pas d'email par defaut. L'admin peut cocher l'envoi d'une confirmation cliente si une adresse email est renseignee.

## Admin mobile

L'espace `/admin` est organise comme une app mobile :

- `Aujourd'hui` : priorite du jour, CA rapide, actions.
- `Agenda` : vues jour/semaine avec blocs horaires.
- `Ajouter` : creation manuelle d'un RDV.
- `Clients` : recherche dans l'historique client.
- `Stats` : CA et volume mensuel.

Actions disponibles :

- confirmer un RDV,
- annuler un RDV,
- marquer termine,
- reprogrammer avec verification de conflit,
- supprimer uniquement via confirmation.

La suppression est volontairement secondaire. Pour garder l'historique et des stats fiables, il vaut mieux annuler un RDV que le supprimer.

## Calcul du CA

- `CA realise` : RDV `completed`, plus RDV `confirmed` dont la date est deja passee.
- `CA prevu` : RDV futurs en `pending` ou `confirmed`.
- Les RDV `cancelled` ne comptent jamais dans le CA.
- Les prix personnalises des RDV manuels sont stockes dans `bookings.total` et comptent dans les stats.

## Lancer en local

```bash
npm install
npm run dev
```

Pages principales :

- `/`
- `/prices`
- `/book`
- `/confirm`
- `/location`
- `/admin/login`
- `/admin`

## Verification avant livraison

1. Lancer `npm run build`.
2. Ouvrir `/prices` et verifier les tarifs.
3. Ouvrir `/book` et creer une reservation publique.
4. Verifier que la reservation apparait dans `/admin`.
5. Ouvrir `Agenda` et verifier le bloc horaire du RDV.
6. Creer un RDV manuel depuis `Ajouter`.
7. Tester la recherche/autofill cliente.
8. Tester un conflit de creneau.
9. Marquer un RDV termine et verifier le CA realise.
10. Annuler un RDV et verifier qu'il ne compte pas dans le CA.

## Structure

```text
app/
  api/bookings/route.ts        reservation publique
  api/admin/bookings/route.ts  creation, reprogrammation et suppression admin
  admin/                       app admin
  book/                        flow public de reservation
components/                    navigation, footer, icones
lib/                           Supabase et emails
public/                        assets PWA
supabase-schema.sql            schema de base
```
