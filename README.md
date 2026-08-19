# PDFPro — Éditeur PDF SaaS

![Stack](https://img.shields.io/badge/React-18-61DAFB?logo=react) ![Stack](https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi) ![Stack](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss) ![Stack](https://img.shields.io/badge/Railway-Deploy-0B0D0E?logo=railway)

Éditeur PDF professionnel en ligne, modèle pay-as-you-go (0,25€ par opération via crédits prépayés).

## Fonctionnalités

| Outil | Description |
|-------|-------------|
| **Texte** | Édition de texte inline sur le PDF |
| **Surlignage** | Annotation jaune sur sélection |
| **Image** | Insertion d'image à la position souhaitée |
| **Signature** | Signature électronique dessinée |
| **Pages** | Rotation, suppression, réorganisation |
| **Combiner** | Fusion de plusieurs PDFs |
| **Séparer** | Division par plages de pages |
| **Compresser** | Réduction du poids du PDF |
| **Exporter** | Export de chaque page en PNG (ZIP) |
| **OCR** | Extraction de texte depuis PDFs scannés |

## Modèle économique

- **1 crédit = 1 opération = 0,25€**
- Achat de crédits en lot : 5€ (20 cr.) / 10€ (44 cr.) / 20€ (100 cr.)
- Paiement via Stripe Checkout (one-time payment)

## Stack technique

**Frontend** — React 18 + Vite + Tailwind CSS + pdf.js + Fabric.js

**Backend** — FastAPI + PyMuPDF + PostgreSQL + SQLAlchemy + Alembic

**Infra** — Railway (backend + frontend + PostgreSQL) + Cloudflare R2 (stockage)

## Lancement local (Docker)

```bash
cp .env.example .env
# Remplir les variables dans .env
docker compose up --build
```

Application disponible sur **http://localhost:5173**

## Variables d'environnement

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | Clé secrète JWT (générer avec `openssl rand -hex 32`) |
| `DATABASE_URL` | URL PostgreSQL (ex: `postgresql://user:pass@host:5432/db`) |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Secret webhook Stripe (`whsec_...`) |
| `R2_ACCOUNT_ID` | ID de compte Cloudflare |
| `R2_ACCESS_KEY` | Access key R2 |
| `R2_SECRET_KEY` | Secret key R2 |
| `R2_BUCKET` | Nom du bucket R2 |
| `R2_PUBLIC_URL` | URL publique du bucket R2 |
| `RESEND_API_KEY` | Clé API Resend pour les emails |
| `FROM_EMAIL` | Expéditeur des emails (ex: `PDFPro <noreply@pdfpro.app>`) |
| `FRONTEND_URL` | URL du frontend (ex: `https://pdfpro.app`) |
| `ALLOWED_ORIGINS` | CORS origins séparées par virgule |
| `SENTRY_DSN` | DSN Sentry pour le monitoring (optionnel) |

## Déploiement Railway

1. Créer un projet Railway avec 3 services : `backend`, `frontend`, `postgres`
2. Ajouter toutes les variables d'environnement ci-dessus dans chaque service
3. Configurer le webhook Stripe : `https://<backend-url>/api/billing/webhook`
4. Ajouter `RAILWAY_TOKEN` dans les secrets GitHub pour le CI/CD automatique

Le déploiement se fait automatiquement à chaque push sur `main`.

## API

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/auth/register` | Inscription |
| `POST` | `/api/auth/login` | Connexion |
| `GET` | `/api/auth/me` | Profil + solde crédits |
| `GET` | `/api/files/` | Lister les fichiers |
| `POST` | `/api/files/upload` | Uploader un PDF |
| `GET` | `/api/files/{id}/download` | Télécharger |
| `DELETE` | `/api/files/{id}` | Supprimer |
| `POST` | `/api/files/{id}/add-text` | Ajouter texte (1 crédit) |
| `POST` | `/api/files/{id}/add-image` | Insérer image (1 crédit) |
| `POST` | `/api/files/{id}/highlight` | Surligner (1 crédit) |
| `POST` | `/api/files/{id}/sign` | Signer (1 crédit) |
| `POST` | `/api/files/{id}/rotate-page` | Rotation page (1 crédit) |
| `POST` | `/api/files/{id}/rotate-all` | Rotation toutes pages (1 crédit) |
| `POST` | `/api/files/{id}/rotate-pages` | Rotation d'une sélection de pages (1 crédit) |
| `POST` | `/api/files/{id}/delete-pages` | Supprimer pages (1 crédit) |
| `POST` | `/api/files/{id}/reorder-pages` | Réorganiser pages (1 crédit) |
| `POST` | `/api/files/{id}/compress` | Compresser (1 crédit) |
| `POST` | `/api/files/{id}/export-images` | Exporter en PNG (1 crédit) |
| `POST` | `/api/files/{id}/ocr` | OCR (1 crédit) |
| `POST` | `/api/merge` | Fusionner (1 crédit) |
| `POST` | `/api/files/{id}/split` | Diviser (1 crédit) |
| `POST` | `/api/billing/topup` | Acheter des crédits |
| `GET` | `/api/billing/balance` | Solde de crédits |
| `GET` | `/api/billing/history` | Historique transactions |
| `POST` | `/api/billing/webhook` | Webhook Stripe |

Documentation interactive : **http://localhost:8000/docs**

## Limites du MVP

- PDF importé : **50 Mo et 300 pages maximum**
- Fusion : **20 fichiers et 500 pages maximum**
- OCR : **30 pages maximum par opération**
- Export PNG : **100 pages maximum**
- Image insérée : **10 Mo maximum**

La feuille de route d'exploitation est détaillée dans [`PLAN_MVP_VERS_PRODUCTION.md`](./PLAN_MVP_VERS_PRODUCTION.md).

## Tests

```bash
# Backend tests
cd backend
pip install pytest
pytest tests/

# Frontend (Playwright)
cd frontend
npm install
npx playwright install
npx playwright test
```

## Sécurité

- ✅ Validation taille fichier (max 50MB)
- ✅ Validation magic bytes PDF
- ✅ Sanitization filename
- ✅ Rate limiting sur auth
- ✅ Security headers (CSP, X-Frame-Options, etc.)
- ✅ Timing-attack safe comparison
- ✅ JWT avec expiration 7 jours

## Édition de texte

| Interaction | Action |
|-------------|--------|
| Clic sur une zone de texte | Ouvrir l'édition inline |
| `Entrée` | Sauvegarder le texte |
| `Échap` | Annuler l'édition |

Les modifications sont inscrites directement dans le PDF. L'ancien contenu texte est réellement supprimé (rédaction PDF), et non simplement masqué visuellement.
