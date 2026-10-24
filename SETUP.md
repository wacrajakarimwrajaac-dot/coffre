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
Déjà fait pour le projet `gsgfqdtduuepxdkoycof` dans `web/.env`. Pour un autre projet, crée `web/.env.local` :
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

# Google : sauvegarde Google Drive et « Continuer avec Google »

Les deux fonctions utilisent le même client OAuth Google (gratuit).

## 1. Projet Google Cloud
1. https://console.cloud.google.com → **Nouveau projet** → nom `Coffre`.
2. **API et services → Bibliothèque** → recherche **Google Drive API** → **Activer**.

## 2. Écran de consentement (Google Auth Platform)
1. **Branding** : nom de l'application `Coffre`, ton email d'assistance.
2. **Audience** : type **Externe**. En mode **Test**, ajoute ton Gmail (et ceux de tes testeurs) dans **Utilisateurs test**.
3. **Accès aux données** → **Ajouter des champs d'application** : `.../auth/drive.file`
   (Coffre ne voit que les fichiers qu'il a lui-même créés dans le Drive).

## 3. Client OAuth
**Clients → Créer un client → Application Web**
- Origines JavaScript autorisées : `http://localhost:5173` (plus tard, ajoute l'adresse du site en ligne)
- URI de redirection autorisés : `https://gsgfqdtduuepxdkoycof.supabase.co/auth/v1/callback`

Copie l'**ID client** (`xxxx.apps.googleusercontent.com`) dans `web/.env` :
```
VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
```
L'ID client est public. Le **code secret du client** ne va **jamais** dans ce fichier ni dans le chat.

## 4. Connexion Google dans Supabase
Supabase → **Authentication → Sign In / Providers → Google** → active-le, puis colle l'**ID client** et le **code secret du client** → **Save**.

## Fonctionnement de la sauvegarde
- Menu **☁️ Sauvegarde Google Drive** → **Connecter mon compte Google** → choisis **Quotidienne** ou **Hebdomadaire**.
- Dans le Drive, un dossier **Coffre** reprend tes dossiers, avec les vrais fichiers (photos, vidéos, documents),
  plus `coffre-sauvegarde.json` (dossiers, notes, liens, tâches).
- Seuls les nouveaux fichiers sont envoyés. Un élément supprimé dans Coffre part dans la corbeille du Drive (récupérable pendant 30 jours).
- Sur le site, la sauvegarde automatique se fait quand le site est ouvert. L'app mobile pourra la faire en arrière-plan.
- **Restaurer** (sur un nouvel appareil) : même menu → connecte le même Gmail → **Restaurer**.

# Sauvegarde Google Drive dans l'app mobile

L'app utilise un client OAuth Google de type **« TV et appareils à saisie limitée »** (l'app affiche un code, tu le confirmes sur google.com/device).
1. https://console.cloud.google.com/auth/clients/create?project=coffre-512516 → type **TV et appareils à saisie limitée** → nom `Coffre Mobile`.
2. Copie l'**ID client** et le **code secret** dans `mobile/.env` (`EXPO_PUBLIC_GOOGLE_DEVICE_CLIENT_ID` / `EXPO_PUBLIC_GOOGLE_DEVICE_CLIENT_SECRET`).
   Pour ce type de client, Google ne considère pas le code secret comme confidentiel (il est intégré à l'app).
3. https://console.cloud.google.com/auth/audience?project=coffre-512516 → **Publier l'application** (état « En production »).
   Le champ `drive.file` n'est pas sensible : aucune validation Google n'est nécessaire. Sans ça, en mode « Test », l'accès expire après 7 jours.
4. Recompiler l'app (`eas build --profile preview --platform android`).
