# Coffre PC (Windows)

Le site Coffre dans sa propre fenêtre, avec **la copie de ta bibliothèque sur l'ordinateur** (dossiers, liens, notes, fichiers).
Rien n'est hébergé : le site est dans l'application. Le bouton **Synchroniser** met à jour l'ordinateur et le téléphone dans les deux sens.

## Obtenir l'installateur (.exe)
1. Sur GitHub : **Actions → Coffre PC (Windows) → Run workflow** (ou pousse un tag `pc-v0.10.0` pour publier une release).
2. À la fin, télécharge `Coffre-PC-Setup-<version>.exe` dans les *Artifacts* (ou dans *Releases*).
3. Au premier lancement, Windows peut afficher « Windows a protégé votre ordinateur » (le programme n'est pas signé) :
   **Informations complémentaires → Exécuter quand même**.

## Lancer en développement (sur ton PC)
```
cd desktop
npm install
npm run build:web      # construit le site et le copie dans desktop/web-dist
npm start
```

## Connexion Google
La connexion s'ouvre dans ton navigateur habituel, puis revient dans l'application par l'adresse `coffre-desktop://auth-callback`.
**À ajouter une fois** dans Supabase → Authentication → URL Configuration → Redirect URLs : `coffre-desktop://auth-callback`.

## Où sont les données
Dans le stockage local de l'application (dossier `%APPDATA%\Coffre`). Se déconnecter ou déconnecter le téléphone supprime cette copie ;
le contenu reste sur le téléphone.
