# PDFPro — Runbook de production

## 1. Pré-requis

- Deux environnements isolés : `staging` et `production`.
- PostgreSQL avec sauvegardes automatiques.
- Redis pour le rate limiting partagé.
- Bucket Cloudflare R2 privé.
- Comptes Stripe, Resend et Sentry dédiés à l'environnement.
- Domaine HTTPS validé.

Le backend refuse désormais de démarrer avec `ENVIRONMENT=production` si un secret ou un service obligatoire manque, si PostgreSQL n'est pas utilisé, ou si une origine locale/wildcard est configurée.

## 2. Variables obligatoires en production

```text
ENVIRONMENT=production
SECRET_KEY=<64 caractères aléatoires minimum>
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
FRONTEND_URL=https://app.example.com
ALLOWED_ORIGINS=https://app.example.com
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY=...
R2_SECRET_KEY=...
R2_BUCKET=...
RESEND_API_KEY=re_...
FROM_EMAIL=PDFPro <noreply@example.com>
SENTRY_DSN=...
FILE_RETENTION_DAYS=30
VITE_PROXY_TARGET=https://api.example.com
VITE_LEGAL_NAME=<raison sociale>
VITE_LEGAL_EMAIL=<contact légal/support>
VITE_FILE_RETENTION_DAYS=30
```

Génération de la clé :

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

## 3. Déploiement

1. Créer un snapshot PostgreSQL.
2. Construire les images depuis le commit validé en staging.
3. Le backend exécute `alembic upgrade head` avant Uvicorn.
4. Vérifier `GET /health/live`, puis `GET /health/ready`.
5. Déployer le frontend et vérifier la CSP ainsi que le proxy `/api`.
6. Tester inscription, import, modification, téléchargement et paiement test.
7. Surveiller erreurs et latence pendant 30 minutes.

### Rollback

- Revenir à l'image applicative précédente.
- Ne lancer `alembic downgrade` qu'après validation explicite de la migration concernée.
- Restaurer PostgreSQL uniquement en cas de corruption ou migration irréversible.
- Les objets R2 ne doivent jamais être écrasés manuellement pendant un rollback.

## 4. Probes et alertes

- `/health/live` : processus HTTP actif.
- `/health/ready` : base et stockage initialisé.
- Alerter après 3 échecs consécutifs de readiness.
- Alerter si taux HTTP 5xx > 2 % sur 5 minutes.
- Alerter si P95 > 5 secondes hors OCR/export.
- Alerter immédiatement sur les webhooks Stripe en échec.

Chaque réponse contient `X-Request-ID`. Les logs sont structurés et permettent de rechercher ce même identifiant. Ne jamais ajouter le contenu PDF, les JWT ou les tokens de partage aux logs.

## 5. Sauvegarde et restauration

- Sauvegarde PostgreSQL quotidienne, rétention 30 jours.
- Point-in-time recovery si l'offre PostgreSQL le permet.
- Test de restauration mensuel dans un projet isolé.
- R2 : versioning ou réplication selon le niveau de service visé.
- Consigner date, durée, taille et résultat de chaque test de restauration.

Test minimal après restauration : nombre d'utilisateurs/fichiers, connexion d'un compte de test, téléchargement d'un PDF, cohérence des crédits et transactions.

## 6. Stripe

Webhook : `POST https://<api>/api/billing/webhook`

Événement requis : `checkout.session.completed`.

Le traitement est idempotent grâce à l'unicité de `stripe_session_id`. En cas de rejeu, aucun crédit supplémentaire n'est ajouté. Pour un remboursement, corriger les crédits avec une procédure support auditée avant d'automatiser le flux.

## 7. Incident

1. Nommer un responsable d'incident.
2. Identifier le premier `request_id` affecté.
3. Si confidentialité ou facturation : suspendre immédiatement la fonction concernée.
4. Préserver les logs et la chronologie.
5. Communiquer l'état, sans exposer de donnée personnelle.
6. Corriger en staging, tester, puis déployer progressivement.
7. Rédiger un post-mortem avec actions et responsables.

## 8. Suppression et rétention

- Suppression utilisateur : immédiate depuis l'interface.
- Suppression de compte : fichiers R2 supprimés avant les métadonnées.
- Documents inactifs : nettoyage quotidien après `FILE_RETENTION_DAYS`.
- Le job de rétention utilise un verrou PostgreSQL pour ne s'exécuter que sur un réplica.
- Liens de partage : expiration cryptographique après 7 jours et révocation API.

## 9. Vérification avant ouverture publique

- [ ] Raison sociale et contact légal configurés.
- [ ] CGU et confidentialité validées par le responsable juridique.
- [ ] Domaine d'envoi Resend avec SPF, DKIM et DMARC.
- [ ] Stripe live et webhook vérifié.
- [ ] Restauration PostgreSQL testée.
- [ ] Alertes Sentry et disponibilité reçues par une personne identifiée.
- [ ] Procédure remboursement/support testée.
- [ ] Aucun secret de test dans l'environnement production.
