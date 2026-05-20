# Face Signature — Plateforme complète

Site vitrine + réservations + admin mobile-first.
Vraies emails, vraie base de données, déployable gratuitement.

---

## 🎯 Ce que tu obtiens

- **Site public** : accueil, tarifs, réservation, adresse
- **Système de réservation** : avec calendrier, anti-double-booking
- **Emails automatiques** : à la cliente + à Mariam à chaque résa
- **Admin séparé** sur `/admin` : protégé par login, mobile-first
- **App installable** sur l'iPhone de Mariam (PWA, "Ajouter à l'écran d'accueil")
- **Notifications temps réel** dans l'admin quand quelqu'un réserve

---

## 🚀 Déploiement (30 minutes la première fois)

Tu vas avoir besoin de **3 comptes gratuits** :

| Service | À quoi ça sert | Lien |
|---|---|---|
| **Vercel** | Hébergement du site | [vercel.com](https://vercel.com) |
| **Supabase** | Base de données + login admin | [supabase.com](https://supabase.com) |
| **Resend** | Envoi d'emails | [resend.com](https://resend.com) |

Tous gratuits, plans suffisants pour Face Signature toute l'année.

---

### Étape 1 — Supabase (base de données)

1. Va sur [supabase.com](https://supabase.com) → **New project**
2. Nom : `face-signature` · choisis un mot de passe DB (note-le)
3. Région : **West EU (Paris/Frankfurt)** pour la rapidité
4. Une fois le projet créé, va dans **SQL Editor** (icône `</>`) → **New Query**
5. Ouvre le fichier `supabase-schema.sql` de ce projet, copie-colle tout, clique **Run** ✅
6. Va dans **Authentication → Users → Add user → Create new user**
   - Email : celui de Mariam (ex: `mariam@facesignature.paris`)
   - Mot de passe : choisis-en un solide, donne-le à Mariam
   - ✅ Auto Confirm User
7. Va dans **Project Settings → API** et note 3 valeurs :
   - `Project URL` → `https://xxx.supabase.co`
   - `anon public` (clé)
   - `service_role` (clé secrète — garde-la secrète)

---

### Étape 2 — Resend (envoi des emails)

1. Va sur [resend.com](https://resend.com) → crée un compte
2. **API Keys → Create API Key** → nom `face-signature` → copie la clé (`re_...`)
3. Pour les emails de test, tu peux utiliser `onboarding@resend.dev` comme expéditeur
4. **Pour la production**, ajoute le domaine (ex: `facesignature.paris`) dans **Domains → Add Domain** et suis les instructions DNS. Sinon Resend n'enverra qu'à toi-même en mode test.

---

### Étape 3 — Vercel (déploiement)

#### A. Mets le projet sur GitHub

```bash
cd face-signature
git init
git add .
git commit -m "initial"
# crée un repo sur github.com puis :
git remote add origin https://github.com/TOI/face-signature.git
git push -u origin main
```

#### B. Déploie sur Vercel

1. Va sur [vercel.com](https://vercel.com) → **Add New → Project**
2. Import le repo GitHub `face-signature`
3. Avant de cliquer **Deploy**, ouvre **Environment Variables** et ajoute :

| Nom | Valeur |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | l'URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la clé `anon public` |
| `SUPABASE_SERVICE_ROLE_KEY` | la clé `service_role` |
| `RESEND_API_KEY` | la clé Resend (`re_...`) |
| `ADMIN_EMAIL` | email de Mariam où les notifs arrivent |
| `FROM_EMAIL` | `onboarding@resend.dev` (ou ton domaine vérifié) |

4. Clique **Deploy**. Attends 1-2 min. ✨

Tu reçois une URL `face-signature-xxx.vercel.app`. Si t'achètes un domaine après (genre `facesignature.paris` ~10€/an), tu le branches en 30 secondes dans Vercel.

---

## 📱 Pour Mariam : installer l'admin sur l'iPhone

Une fois déployé, envoie-lui ce message :

> Hello, voici ton espace admin Face Signature 💛
>
> 1. Ouvre ce lien sur ton iPhone avec **Safari** : `https://face-signature.vercel.app/admin/login`
> 2. Connecte-toi avec ton email et le mot de passe
> 3. Une fois connectée, tape sur l'icône **Partager** (carré avec flèche) → **Sur l'écran d'accueil**
> 4. Ça crée une icône Face Signature comme une vraie app
>
> À partir de là, tu lances l'app comme Instagram, tu vois toutes les résa en temps réel, tu confirmes / appelles / WhatsApp tes clientes en un tap.

---

## 🏃 Lancer en local (pour développer)

```bash
cd face-signature
cp .env.local.example .env.local
# remplis .env.local avec tes vraies clés
npm install
npm run dev
# ouvre http://localhost:3000
```

Pages disponibles :
- `/` accueil
- `/prices` tarifs
- `/book` réservation
- `/location` adresse
- `/admin/login` login admin
- `/admin` dashboard (protégé)

---

## 🛠️ Modifier les tarifs

Va dans Supabase → **Table Editor → services** → modifie directement. Aucun redéploiement nécessaire.

Pour ajouter un nouveau soin :
- **Insert row** dans la table `services`
- Remplis `id` (court, unique, ex: `lip1`), `category`, `name`, `price`, `duration` (en minutes)
- Le site le récupère automatiquement

---

## 🔧 Comment ça marche

```
                    ┌──────────────┐
                    │   CLIENTE    │
                    │  (mobile)    │
                    └──────┬───────┘
                           │ réserve sur /book
                           ▼
              ┌──────────────────────────┐
              │  Next.js sur VERCEL      │
              │  /api/bookings (POST)    │
              └──────┬───────────────────┘
                     │
            ┌────────┴────────┐
            ▼                 ▼
    ┌──────────────┐    ┌──────────────┐
    │  SUPABASE    │    │   RESEND     │
    │  (database)  │    │  (emails)    │
    └──────┬───────┘    └──────┬───────┘
           │                   │
           │ realtime          │ envoie 2 emails
           │ push              │
           ▼                   ▼
    ┌──────────────┐    ┌──────────────┐
    │  ADMIN       │    │ CLIENTE      │
    │  (Mariam)    │    │ + ADMIN      │
    │  /admin      │    │ (boîte mail) │
    └──────────────┘    └──────────────┘
```

---

## ❓ FAQ

**Combien ça coûte ?**
Zéro. Tant que tu restes sous : 500MB DB Supabase, 100 emails/jour Resend (3000/mois), trafic Vercel raisonnable (gratuit jusqu'à 100GB/mois).

**Et si je dépasse ?**
Tu te poses la question quand tu auras 100 résa par jour. Pour l'instant, t'es très très large.

**Comment changer le mot de passe admin ?**
Supabase → Authentication → Users → clique sur Mariam → Send password recovery (un lien lui est envoyé).

**Comment ajouter une autre personne admin ?**
Supabase → Authentication → Users → Add user. Tout user connecté a accès à `/admin`.

**Les emails partent vraiment ?**
Oui, dès que tu ajoutes la clé Resend dans Vercel. Vérifie ton dashboard Resend pour voir les envois.

**Comment voir les logs si quelque chose foire ?**
Vercel → ton projet → Logs. Tu verras chaque appel API en temps réel.

---

## 📁 Structure du projet

```
face-signature/
├── app/
│   ├── page.tsx              # Accueil
│   ├── prices/page.tsx       # Tarifs
│   ├── book/                 # Réservation
│   ├── confirm/page.tsx      # Confirmation post-réservation
│   ├── location/page.tsx     # Adresse
│   ├── admin/                # Espace admin (protégé)
│   │   ├── page.tsx
│   │   ├── AdminDashboard.tsx
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   └── api/bookings/route.ts # API : crée résa + envoie emails
├── components/               # Composants partagés
├── lib/
│   ├── supabase-browser.ts   # Client DB côté navigateur
│   ├── supabase-server.ts    # Client DB côté serveur
│   └── email.ts              # Templates + envoi Resend
├── public/                   # Icônes, manifest PWA
├── supabase-schema.sql       # Script de création BD
└── README.md                 # Ce fichier
```

---

Made with ❤️ for Face Signature.
