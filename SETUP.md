# Mise en place de la base cloud (Supabase, gratuit)

Le code est prêt : schéma, sécurité par utilisateur, fichiers, connexion et synchronisation.
Il reste la création du projet Supabase, qui se fait à ton nom (environ 5 minutes).

## 1. Créer le projet
1. https://supabase.com → **Start your project** → connecte-toi avec GitHub.
2. **New project** : nom `coffre`, région **Europe (Paris / Frankfurt)**, choisis un mot de passe de base de données et garde-le pour toi.

## 2. Créer les tables (une seule fois)
**Option simple :** dans Supabase, ouvre **SQL Editor → New query**, colle tout le contenu de
[`supabase/schema.sql`](supabase/schema.sql), puis clique sur **Run**.

**Option automatique** (sur ton PC) :
```powershell
npm install
$env:SUPABASE_DB_URL = "<chaîne Session pooler : Supabase → Connect → Session pooler>"
npm run db:setup
```

## 3. Brancher le site
Dans Supabase, va dans **Project Settings → API** et copie **Project URL** et la clé **anon / publishable**.
Crée le fichier `web/.env.local` :
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=<clé anon>
```
Ne mets **jamais** la clé `service_role` / secret dans ce fichier : il est lu par le navigateur.

## 4. Lancer
```powershell
cd web
npm install
npm run dev
```
Ouvre http://localhost:5173 → **Créer un compte** → confirme ton email → connecte-toi.

## Bon à savoir (plan gratuit)
- Limites : 500 Mo de base, 1 Go de fichiers, 2 projets.
- Le projet se met en pause après environ 7 jours sans activité. Pour le réveiller : tableau de bord Supabase → **Restore**. Les données sont conservées.
- Pour une mise en ligne (Vercel, par exemple) : dans **Authentication → URL Configuration**, ajoute l'adresse du site dans *Site URL* et *Redirect URLs*.
