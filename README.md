# Coffre

Un seul endroit pour ranger, par sujet : liens (reels Instagram/Facebook, YouTube, articles), notes, documents, images, vidéos, tâches avec rappels, et favoris importés depuis le navigateur.

- `web/` : site (Vite + React + TypeScript).
- `supabase/schema.sql` : base cloud (Supabase) avec tables, sécurité par utilisateur et stockage des fichiers.
- **Configuration de la base cloud : voir [SETUP.md](SETUP.md).** Si Supabase n'est pas configuré, le site fonctionne en mode local (IndexedDB, dans le navigateur).
- Application mobile : prévue ensuite.

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
- Export / restauration d'une sauvegarde JSON (fichiers inclus)
- Comptes (email + mot de passe) et synchronisation en temps réel entre appareils (mode cloud)
