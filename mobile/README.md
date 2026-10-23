# Coffre — application mobile (Android + iPhone)

Expo / React Native, même base Supabase et même compte que le site.

## Fonctions
- Connexion (email + mot de passe), synchronisation en temps réel avec le site
- Dossiers et sous-dossiers, icônes, recherche globale, filtres
- Liens (Instagram, Facebook, YouTube…) : le lien copié est collé automatiquement
- Notes, tâches avec **alarme qui sonne même app fermée** (notification locale, mode « réveil » sur Android)
- 🎤 Vocaux, photos et vidéos (galerie ou appareil photo), documents
- Lecture des images, vidéos et vocaux, partage et enregistrement sur le téléphone
- Barre d'espace utilisé selon la formule (Gratuit / Plus / Premium)

## Tester sur ton téléphone
Les modules natifs (micro, notifications, vidéo) demandent une **development build** (Expo Go ne suffit pas).

**Android (gratuit)** : compile en ligne avec EAS, puis installe l'APK sur le téléphone.
```powershell
cd mobile
npm install
npx eas-cli@latest login        # compte gratuit sur expo.dev
npx eas-cli@latest build --profile development --platform android
npx expo start                  # puis ouvre l'app installée
```
Pour une APK autonome à partager : `npx eas-cli@latest build --profile preview --platform android`.

**iPhone** : il faut un compte Apple Developer (99 $/an), puis
`npx eas-cli@latest build --profile development --platform ios`.

## Vérifications
```powershell
npm run typecheck
npx expo export --platform android --platform ios
```
