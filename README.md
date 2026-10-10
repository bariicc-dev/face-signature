# Face Signature

Site vitrine, reservation publique et app admin mobile-first pour Face Signature.

## Fonctionnalites

- Pages publiques : accueil, tarifs, reservation, confirmation, adresse.
- Reservations stockees dans Supabase.
- Jusqu'à deux clientes en même temps, avec contrôle de capacité sur toute la durée du RDV.
- Plusieurs prestations par RDV : en même temps (durée du soin le plus long) ou à la suite (durées additionnées), avec prix cumulés.
- Blocage de créneaux ou de périodes de congés depuis l'admin.
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

### Mise à jour d'un projet existant

Avant de déployer la version avec deux clientes, prestations multiples et absences :

1. Ouvrir le **SQL Editor** du projet Supabase existant.
2. Exécuter `supabase/migrations/20261010_scheduling.sql` en entier.
3. Déployer le code de cette version.

La migration conserve les RDV existants et leur durée. `supabase-schema.sql` inclut déjà la même migration pour les nouveaux projets. Les prix et intitulés des prestations d'un nouveau RDV sont enregistrés dans `bookings.service_items` ; le champ historique `service_id` reste renseigné pour les anciens écrans et relations.

Le contrôle est appliqué par des triggers PostgreSQL : créations, reprogrammations, modifications de durée et restauration d'un RDV annulé respectent la capacité et les fermetures. Les écritures du planning partagent un verrou de transaction pour éviter que des requêtes simultanées dépassent deux clientes. Une cliente avec plusieurs prestations occupe une place ; le mode choisi définit la durée de son RDV.

Les disponibilités publiques passent par `/api/availability` et une fonction SQL qui renvoie uniquement des plages horaires. Les coordonnées clientes et les motifs d'absence restent privés. Si la migration manque ou que le chargement échoue, le formulaire ne propose pas de créneaux à réserver.

### Retrouver l'accès admin

- La connexion est sur `/admin/login` et utilise un utilisateur **Supabase Auth**.
- Dans le projet Supabase, ouvrir **Authentication → Users** pour retrouver l'adresse email du compte admin.
- Le mot de passe n'est pas conservé dans ce dépôt et ne peut pas être récupéré depuis son hash. En cas d'oubli, utiliser la réinitialisation de mot de passe du compte dans Supabase.
- `ADMIN_EMAIL` désigne le destinataire des notifications ; il ne définit pas l'identifiant de connexion.

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
- `Absences` : bloquer des heures, une journée ou une période de congés, puis les débloquer.

Dans `Absences`, les congés incluent le premier et le dernier jour choisis. Le blocage ferme les deux places. Les RDV déjà présents doivent être déplacés ou annulés avant de bloquer leur période. Dans `Agenda`, les fermetures apparaissent hachurées et les RDV simultanés s'affichent côte à côte.

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

1. Lancer `npm test` puis `npm run build` avec les variables d'environnement configurées.
2. Ouvrir `/prices` et verifier les tarifs.
3. Ouvrir `/book` et creer une reservation publique.
4. Verifier que la reservation apparait dans `/admin`.
5. Ouvrir `Agenda` et verifier le bloc horaire du RDV.
6. Creer un RDV manuel depuis `Ajouter`.
7. Tester la recherche/autofill cliente.
8. Tester un conflit de creneau.
9. Marquer un RDV termine et verifier le CA realise.
10. Annuler un RDV et verifier qu'il ne compte pas dans le CA.
11. Réserver deux clientes qui se chevauchent, puis vérifier qu'une troisième est refusée.
12. Bloquer quelques heures puis des journées de congés ; vérifier les indisponibilités publiques et le déblocage.
13. Réserver deux prestations ensemble puis à la suite ; vérifier les noms, le prix et la durée dans l'admin, la confirmation et l'email.

`npm test` couvre les calculs de durée/prix, les chevauchements, les changements d'heure à Paris, les colonnes de l'agenda et les règles SQL avec un moteur PostgreSQL local en mémoire. Il ne remplace pas une vérification sur le projet Supabase de production.

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
