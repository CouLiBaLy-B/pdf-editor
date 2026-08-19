# PDFPro — Plan du MVP à la production

> Mise à jour : 19 août 2026  
> Objectif : livrer un éditeur PDF payant, fiable et exploitable sans surconstruire le produit.

## 1. Définition du MVP

Le MVP est considéré comme **fonctionnellement complet** lorsque ce parcours fonctionne de bout en bout :

1. créer un compte et récupérer son mot de passe ;
2. importer puis retrouver un PDF ;
3. modifier du texte, surligner, insérer une image et signer ;
4. pivoter, supprimer et réordonner des pages ;
5. fusionner, séparer, compresser, exporter ou OCRiser un document ;
6. télécharger ou partager le résultat ;
7. acheter des crédits et consulter son historique ;
8. supprimer un fichier ou son compte.

### État au 19 août 2026

| Domaine | État MVP | Notes |
|---|---:|---|
| Authentification et récupération | ✅ | Routes et écrans présents, limitation de débit activée |
| Stockage et téléchargement | ✅ | Local en développement, R2 en environnement hébergé |
| Édition essentielle | ✅ | Coordonnées liées au zoom, validations et erreurs explicites |
| Pages | ✅ | Rotation groupée, suppression confirmée, ordre complet |
| Fusion / séparation | ✅ | Résultats désormais persistés dans la bibliothèque utilisateur |
| Partage | ✅ | Compatible R2, expiration à 7 jours et révocation côté API |
| Crédits / Stripe | ✅ MVP | Webhook idempotent et configuration absente signalée proprement |
| Robustesse UI | ✅ | État de chargement, notifications et écran d'erreur global |
| Tests automatisés | 🟡 | Tests backend critiques et build frontend ; E2E à ajouter |
| Exploitation production | 🟡 | Monitoring partiel ; sauvegardes, alertes et runbooks à finaliser |

## 2. Critères de sortie MVP (staging)

Tous les critères suivants doivent être validés avant une ouverture à des utilisateurs pilotes :

- [ ] CI verte sur `main` : tests backend, build et audit npm ;
- [ ] test manuel du parcours complet sur un environnement staging ;
- [ ] Stripe en mode test : achat, webhook, rejeu du webhook sans double crédit ;
- [ ] R2 : import, modification, partage public et suppression vérifiés ;
- [ ] PostgreSQL migré jusqu'à la dernière révision Alembic ;
- [ ] aucune variable avec une valeur d'exemple ou un secret par défaut ;
- [ ] politiques de sauvegarde PostgreSQL et restauration testée ;
- [ ] pages légales minimales : CGU, confidentialité, cookies et mentions légales ;
- [ ] support : adresse de contact et procédure de remboursement définies ;
- [ ] test sur Chrome, Firefox, Safari et mobile pour les parcours principaux.

## 3. Roadmap vers la production

### Phase 0 — Stabilisation staging (2 à 4 jours)

**Priorité P0**

- créer des environnements Railway distincts `staging` et `production` ;
- configurer PostgreSQL, R2, Resend, Stripe et Sentry avec des secrets séparés ;
- exécuter `alembic upgrade head` pendant le déploiement ;
- ajouter des tests API pour propriété des fichiers, crédits, fusion, séparation et partage ;
- ajouter 5 scénarios Playwright : inscription, import, texte, pages, achat simulé ;
- tester des PDF réels : scanné, 100 pages, rotation, polices intégrées, mot de passe ;
- définir une limite produit explicite : 50 Mo, 300 pages et 20 fichiers par fusion.

**Gate** : aucun bug bloquant, aucun accès croisé entre utilisateurs, 100 % des scénarios E2E verts.

### Phase 1 — Bêta privée (1 semaine)

- inviter 10 à 30 utilisateurs pilotes ;
- instrumentation produit : import réussi, outil utilisé, export réussi, erreur et conversion paiement ;
- tableau de bord Sentry avec alertes sur taux d'erreur et latence ;
- logs structurés avec `request_id`, sans contenu PDF ni donnée sensible ;
- mesure des temps P50/P95 par opération ;
- collecte de feedback dans l'application ;
- correction des 5 problèmes les plus fréquents avant d'ajouter des fonctions.

**Objectifs**

- taux d'import réussi ≥ 98 % ;
- taux d'opération PDF réussi ≥ 97 % ;
- P95 édition simple < 3 s ;
- zéro double facturation ;
- zéro incident de confidentialité.

### Phase 2 — Production publique contrôlée (1 à 2 semaines)

- domaine, HTTPS, SPF/DKIM/DMARC et emails transactionnels validés ;
- Stripe en production avec alertes sur webhooks en échec ;
- sauvegarde PostgreSQL quotidienne, rétention 30 jours, test de restauration mensuel ;
- règle de cycle de vie R2 et suppression RGPD documentée ;
- protection anti-abus par utilisateur sur upload et opérations coûteuses ;
- statut de service et procédure d'incident ;
- déploiement progressif avec rollback documenté ;
- support et remboursement testés de bout en bout.

**Gate de lancement** : checklist sécurité signée, restauration prouvée, rollback testé et astreinte identifiée.

### Phase 3 — Industrialisation (semaines 3 à 6)

- déplacer OCR, compression lourde et gros exports dans une file de tâches ;
- afficher progression, annulation et reprise des tâches ;
- verrouillage par document ou versionnement optimiste contre les modifications concurrentes ;
- snapshots/versionnement pour un véritable annuler/rétablir ;
- CDN et cache pour les aperçus, miniatures asynchrones ;
- tests de charge et budgets de coût par opération ;
- rotation des secrets et scan automatique des dépendances ;
- objectifs SLO et suivi disponibilité/latence.

## 4. Backlog priorisé

### P0 — avant production

1. Tests E2E du parcours commercial et des modifications critiques.
2. Migrations automatiques et stratégie de rollback.
3. Sauvegarde/restauration PostgreSQL vérifiée.
4. Limites et timeouts sur OCR/export/fusion.
5. Pages légales et politique de rétention/suppression.
6. Alertes Sentry, Stripe et disponibilité.

### P1 — dans le premier mois

1. Travaux asynchrones avec progression.
2. Miniatures de pages et meilleure navigation des longs documents.
3. Historique de versions et annulation réelle.
4. Révocation des liens de partage dans l'interface.
5. Renommage des documents et recherche.
6. Administration support : utilisateurs, paiements et remboursements.

### P2 — après validation du marché

1. Formulaires PDF.
2. Filigrane et protection par mot de passe.
3. OCR multilingue configurable.
4. Travail en équipe et commentaires.
5. API publique et intégrations.

## 5. Architecture cible raisonnable

```text
Navigateur
   │ HTTPS
Frontend statique / Vite
   │ /api
FastAPI ───── PostgreSQL
   │  ├────── Stripe / Resend / Sentry
   │
   ├───────── Cloudflare R2 (PDF)
   └───────── File de tâches → workers OCR / export / compression
```

Ne pas introduire la file de tâches avant d'avoir mesuré que les opérations synchrones dépassent les timeouts. Ne pas introduire la collaboration temps réel avant validation d'un besoin client.

## 6. Indicateurs à suivre

- activation : compte → premier PDF modifié et téléchargé ;
- succès par outil et code d'erreur ;
- temps de traitement P50/P95 ;
- conversion crédits gratuits → premier achat ;
- coût R2, CPU et email par utilisateur actif ;
- rétention J7/J30 ;
- remboursements et tickets pour 100 opérations ;
- disponibilité API et taux de webhooks Stripe réussis.

## 7. Règle de décision

Pendant la bêta, la priorité est toujours :

1. confidentialité et absence de perte de document ;
2. exactitude de la modification PDF ;
3. exactitude de la facturation ;
4. temps de réponse ;
5. nouvelles fonctionnalités.
