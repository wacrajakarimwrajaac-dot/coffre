# Coffre

> Tout ton sujet, au même endroit.

![Logo](brand/preview.png)

Un seul endroit pour ranger, par sujet : liens (reels Instagram/Facebook, YouTube, articles), notes, documents, images, vidéos, tâches avec rappels, et favoris importés depuis le navigateur.

- `web/` : site (Vite + React + TypeScript).
- `supabase/schema.sql` : base cloud (Supabase) avec tables, sécurité par utilisateur et stockage des fichiers.
- **Configuration de la base cloud : voir [SETUP.md](SETUP.md).** Si Supabase n'est pas configuré, le site fonctionne en mode local (IndexedDB, dans le navigateur).
- `mobile/` : application Android + iPhone (Expo), même compte et même base. Voir [mobile/README.md](mobile/README.md).

## Lancer le site

```bash
cd web
npm install
npm run dev      # http://localhost:5173
npm run build    # vérification des types + build de production dans dist/
```

## Fonctions (V1)

- Dossiers et sous-dossiers par sujet, avec icône
- Liens avec détection de plateforme (Instagram Reel, vidéo Facebook, YouTube, TikTok, X…) et miniature YouTube
- Notes
- Fichiers : documents, images, vidéos (glisser-déposer possible)
- Tâches avec date de rappel : notification du navigateur + son, tant que la page est ouverte
- Recherche globale et filtres par type
- Import des favoris du navigateur (fichier HTML exporté depuis Chrome/Edge/Firefox/Safari)
- Sauvegarde automatique dans Google Drive, façon WhatsApp (dossier « Coffre » visible, fichiers inclus), et restauration
- Export / restauration d’un fichier de sauvegarde JSON (fichiers inclus)
- Connexion « Continuer avec Google »
- Enregistrement vocal
- Signalement de problèmes depuis l'app et le site (table `reports`, lisible dans Supabase → Table Editor)
- Suppression de compte depuis l'app et le site (exigée par Google Play / App Store)
- Formules Gratuit / Plus / Premium avec quota de stockage contrôlé côté serveur (voir [TARIFS.md](TARIFS.md))
- Comptes (email + mot de passe) et synchronisation en temps réel entre appareils (mode cloud)
