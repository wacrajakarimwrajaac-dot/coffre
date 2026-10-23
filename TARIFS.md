# Coffre : formules et rentabilité

Principe : **toutes les fonctions sont gratuites** (liens, notes, tâches, alarmes, vocaux, photos, vidéos, sauvegarde Google Drive).
On paie seulement pour **plus d'espace**. C'est simple à comprendre, ça ne frustre pas, et c'est ce qui coûte réellement.

## Formules

| | **Gratuit** | **Plus** | **Premium** |
|---|---|---|---|
| Prix mensuel | 0 € | **0,99 €** | **2,99 €** |
| Prix annuel | 0 € | **9,99 €** (≈ 0,83 €/mois) | **24,99 €** (≈ 2,08 €/mois) |
| Espace | 500 Mo | 10 Go | 50 Go |
| Taille max d'un fichier | 50 Mo | 500 Mo | 2 Go |
| Liens, notes, tâches, alarmes, vocaux | illimités | illimités | illimités |
| Sauvegarde Google Drive | ✅ | ✅ | ✅ |

Les valeurs d'espace sont déjà appliquées côté serveur (table `plans` dans `supabase/schema.sql`).

## Pour encourager les gens à essayer puis à payer
- **Gratuit généreux** : 500 Mo, c'est environ 8 heures de vocaux, 150 photos ou quelques vidéos courtes. On peut tout essayer sans payer.
- **Prix d'entrée symbolique** : Plus à **0,99 €**, c'est moins qu'un café.
- **Annuel mis en avant** : environ 2 mois offerts.
- **Parrainage** : +500 Mo offerts au parrain et au filleul (plafonné, par exemple à 5 Go).
- **Offre de lancement** : 1 mois de Premium offert, ou −50 % la première année pour les 1 000 premiers inscrits.
- **Aucune suppression** si la personne repasse en Gratuit : elle garde l'accès à tout. Elle ne peut simplement plus ajouter de fichiers tant qu'elle dépasse 500 Mo.

## Coûts (à vérifier sur supabase.com/pricing, Apple et Google)
- Supabase **Free** : 0 € jusqu'à 1 Go de fichiers au total. Suffisant pour la phase de test.
- Supabase **Pro** : environ 25 $/mois, avec 100 Go de stockage et 250 Go de trafic inclus. Ensuite environ 0,021 $/Go/mois de stockage et 0,09 $/Go de trafic.
- **Commission des stores** (App Store / Google Play) : 15 % sous 1 M$ de chiffre d'affaires par an (programme petites entreprises).
- **Paiement web (Stripe)** : environ 1,5 % + 0,25 € par paiement. Sur le web, privilégier l'annuel (0,25 € sur 0,99 € mensuel, c'est trop).

## Marge par abonné (mensuel via les stores)

| | Plus | Premium |
|---|---|---|
| Prix | 0,99 € | 2,99 € |
| Après commission de 15 % | 0,84 € | 2,54 € |
| Coût moyen estimé (≈ 30 % de l'espace utilisé + trafic) | ≈ 0,10 € | ≈ 0,50 € |
| **Marge moyenne** | **≈ 0,74 €** | **≈ 2,00 €** |
| Pire cas (espace 100 % rempli) | ≈ 0,60 € | ≈ 0,90 € |

Un utilisateur gratuit plein (500 Mo) coûte environ 0,01 €/mois.

**Seuil de rentabilité** des 25 $/mois de Supabase Pro : environ **12 Premium** ou **32 Plus**.
Tant que le total des fichiers reste sous 1 Go, le coût est de 0 € (plan Free).

## Étapes suivantes
1. Lancer en Gratuit pour avoir des utilisateurs, puis passer à Supabase Pro dès qu'on approche 1 Go.
2. Paiement : achats intégrés dans l'app mobile (RevenueCat simplifie iOS et Android), Stripe sur le web.
   Le paiement mettra à jour `profiles.plan` (aujourd'hui modifiable seulement par l'admin).
3. Parrainage : bonus d'espace par utilisateur (colonne `bonus_bytes` à ajouter).
