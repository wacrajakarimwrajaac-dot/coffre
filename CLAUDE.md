# Coffre : notes de reprise pour Claude

Lis ce fichier en premier. Il résume le projet, les décisions déjà prises et ce qui reste à faire. L'utilisateur parle français :
réponds en français, simplement, sans jargon. Sur son PC Windows, donne toujours les commandes avec le chemin
`C:\Users\anass\Desktop\coffre-v7` (l'ancien dossier `coffre` ne reçoit plus les mises à jour).

## Le produit
**Coffre** : ranger par sujet (dossiers) des liens (reels Instagram/Facebook, YouTube…), notes, vocaux, photos, vidéos et documents.
- **App mobile** (Android + iPhone, Expo) : les données vivent **sur le téléphone** (comme WhatsApp). Sauvegarde dans le Google Drive de la personne.
- **Coffre PC / Coffre Web** : l'ordinateur garde **sa propre copie** locale. Le bouton **Synchroniser** met à jour les deux copies dans les deux sens.
  Le lien téléphone ↔ ordinateur se fait par QR code, chiffré de bout en bout.
- Connexion **Google uniquement**. Design « Épuré » (clair + sombre, icônes Lucide, pas d'emoji).
- Les tâches et habitudes ont été **retirées** : elles feront une app séparée (leurs données restent dans Supabase : tables `habits`, `habit_checks`).

## Organisation du dépôt
| Dossier | Contenu |
|---|---|
| `mobile/` | App Expo SDK 58 / React Native 0.88 / expo-router. Données dans `src/lib/data.ts` (fichier `library.json` + dossier `files/`). |
| `web/` | Site Vite + React + TypeScript = l'interface de Coffre PC / Coffre Web. Copie locale dans `src/library.ts` (IndexedDB). |
| `desktop/` | Application Windows (Electron) qui emballe `web/`. Voir `desktop/README.md`. |
| `supabase/` | `schema.sql` (déjà appliqué au projet) et `functions/payment-webhook/` (webhook de paiement, pas encore déployé). |
| `site/` | Pages statiques (politique de confidentialité `privacy.html`). |
| `scripts/` | `check-link-protocol.mjs` et `tests/` (tests de la synchronisation et du webhook). |
| `.github/workflows/desktop.yml` | Compile le `.exe` Windows sur GitHub (Actions → Coffre PC (Windows) → Run workflow). |

## Comment ça marche (à connaître avant de modifier)
- **Stockage mobile** : `mobile/src/lib/data.ts`. Chaque dossier / élément a `updatedAt` ; une suppression laisse une trace (`deleted`, tombstones).
- **Protocole du lien** : `web/src/link/protocol.ts`. XChaCha20-Poly1305 + x25519/HKDF, messages envoyés par Supabase Realtime (broadcast), qui ne voit que du chiffré.
- **Règles de synchronisation** : `web/src/link/sync.ts`. Le plus récent gagne, à égalité une suppression gagne, un fichier n'est copié que là où il manque.
- ⚠️ `protocol.ts` et `sync.ts` existent en **deux copies identiques** : `web/src/link/` et `mobile/src/lib/link/`.
  Après une modification : copie l'une sur l'autre puis lance `node scripts/check-link-protocol.mjs`.
- **Échange de synchronisation** (le PC commence, le téléphone ne fait que répondre) : `syncStart` (manifeste du PC) → `syncReply` (enregistrements du téléphone, ce qu'il veut, ses fichiers)
  → `syncApply` (ce que le PC envoie) → transferts de fichiers (`get` / `up`). Le téléphone n'envoie rien tout seul.
- **Accès payant** : la fonction SQL `web_access()` donne 7 jours d'essai (qui commencent à la première demande), puis exige un abonnement dans `web_subscriptions`
  (écrite seulement par le webhook). Le **téléphone vérifie lui-même** (`mobile/src/lib/link/access.ts`) avant de servir le PC ; le site affiche la page d'abonnement (`web/src/Account.tsx`).
  L'app mobile n'affiche **jamais** de prix ni de lien de paiement (règles de Google).
- **Connexion Google de l'app Windows** : ouvre le navigateur, revient par `coffre-desktop://auth-callback` (doit être dans les Redirect URLs de Supabase : fait). Mobile : `coffre://auth-callback`.

## Commandes utiles
```
# Vérifications
cd mobile && npx tsc --noEmit
cd web && npx tsc --noEmit && npm run build
node scripts/check-link-protocol.mjs
cd web && npx tsx ../scripts/tests/sync.test.mts      # 2000 scénarios de synchronisation
cd web && npx tsx ../scripts/tests/webhook.test.mts
cd mobile && EXPO_OFFLINE=1 CI=1 npx expo export --platform android   # vérifie que l'app se compile

# APK (compilation chez EAS, plan gratuit limité par mois : le quota se renouvelle le 1er du mois)
cd mobile && EXPO_TOKEN=... npx eas-cli@latest build --profile preview --platform android --non-interactive --no-wait --json

# Site / app Windows en local
cd web && npm run dev        # http://localhost:5173
cd desktop && npm install && npm run build:web && npm start
```

## Identifiants et secrets
- Projet Supabase `gsgfqdtduuepxdkoycof`. L'URL et la clé « publishable » sont publiques et sont dans `web/.env`.
- **Ne jamais** écrire dans le dépôt : clés `service_role` / secrets, mots de passe, le secret du client Google « device » (il est dans EAS : variable `EXPO_PUBLIC_GOOGLE_DEVICE_CLIENT_SECRET`).
- Ne jamais demander à l'utilisateur de coller un mot de passe ou une clé dans le chat.
- Expo : compte `anassaoud1s-team`, projet `coffre`. Bundle / package `com.coffre.app`.

## Pièges déjà rencontrés
- **Modules natifs** : certains bloquent l'app sur l'écran de démarrage (testé dans BlueStacks) : `expo-secure-store`, `expo-network`, `expo-task-manager`, `expo-background-task`, et la publicité AdMob (`react-native-google-mobile-ads`, retirée en v0.9.1). Évite d'en ajouter ; si c'est nécessaire, teste sur un vrai téléphone.
- Supabase refuse les adresses de retour dont l'hôte est une adresse IP.
- Supabase interdit de supprimer des fichiers de stockage par SQL (utiliser l'API ou le tableau de bord).
- Une APK compilée localement serait signée avec une autre clé et ne pourrait pas remplacer l'app installée : toujours compiler avec EAS.
- Windows affiche « Windows a protégé votre ordinateur » pour le `.exe` (non signé).
- Les horloges du PC et du téléphone doivent être à peu près justes (synchro « le plus récent gagne »).

## Ce qui reste à faire
1. **Paiement** : l'utilisateur est au **Maroc**, qui n'est pas supporté par Google Play / Apple pour vendre. Piste choisie : un partenaire à l'étranger crée le compte développeur Google Play (au vrai nom de ce partenaire, avec accord écrit ; l'utilisateur est invité avec un rôle limité, jamais de partage de mot de passe).
   Ensuite : abonnement dans l'app avec Google Play via RevenueCat (module natif : tester sur un vrai téléphone), et un webhook RevenueCat qui écrit dans `web_subscriptions` (même table que le webhook Lemon Squeezy déjà écrit dans `supabase/functions/payment-webhook/`). En attendant, paiement possible sur le site (Lemon Squeezy, à déployer : voir `SETUP.md`).
2. **Supabase (à faire par l'utilisateur)** : désactiver l'inscription par email (Authentication → Providers → Email), vider les 4 anciens fichiers du bucket `files`.
3. **Publicité** : retirée (bloquait le démarrage). Pour la remettre : trouver la cause avec `adb logcat` sur un vrai téléphone, ou choisir une autre source de revenus.
4. **Publication** : Google Play (compte du partenaire, environ 25 $, période de test d'environ 14 jours avec 12 testeurs), éventuellement App Store (99 $/an).
5. **Idées** : miniatures de vidéos générées sur le téléphone, mise à jour automatique de l'app Windows, signature du `.exe`, app séparée tâches/habitudes, révision du modèle de prix.

## Règles de travail avec cet utilisateur
- Fais le travail toi-même quand c'est possible (compilation, tests, corrections) ; dis clairement ce qui n'a **pas** pu être testé (surtout sur vrai téléphone ou Windows).
- Donne les liens des APK / du `.exe` quand c'est fini. Ne dis jamais « c'est fini » sans l'avoir vérifié.
- Ne supprime jamais de données de l'utilisateur sans son accord explicite. Ne contourne pas un refus de sécurité.
- Pour les réglages sensibles de son compte (Supabase, Google, paiements), explique-lui les étapes plutôt que de les faire à sa place.
