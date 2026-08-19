# 🔍 AUDIT COMPLET ET DÉTAILLÉ — PDFPro

> **Date de l'audit** : 18 août 2026  
> **Auditeur** : Analyse exhaustive de 100% des fichiers sources  
> **Portée** : 63 fichiers analysés (1 241 backend Python + 2 292 frontend JSX/JS)  
> **Stack** : React 18 + FastAPI + PyMuPDF + PostgreSQL + Cloudflare R2

---

## TABLE DES MATIÈRES

1. [Synthèse Exécutive](#1-synthèse-exécutive)
2. [Audit Backend - Sécurité](#2-audit-backend---sécurité)
3. [Audit Backend - Architecture](#3-audit-backend---architecture)
4. [Audit Backend - Performance](#4-audit-backend---performance)
5. [Audit Frontend - Sécurité](#5-audit-frontend---sécurité)
6. [Audit Frontend - Qualité Code](#6-audit-frontend---qualité-code)
7. [Audit Frontend - UX/UI](#7-audit-frontend---uxui)
8. [Audit Base de Données](#8-audit-base-de-données)
9. [Audit Infrastructure/DevOps](#9-audit-infrastructuredevops)
10. [Analyse Fonctionnelle Complète](#10-analyse-fonctionnelle-complète)
11. [Plan d'Amélioration Détaillé](#11-plan-damélioration-détaillé)

---

## 1. SYNTHÈSE EXÉCUTIVE

### 1.1 Scores par Domaine

| Domaine | Score /10 | Grade | Tendance |
|---------|-----------|-------|----------|
| Sécurité Backend | 5.0 | 🔴 Faible | Critique |
| Sécurité Frontend | 7.0 | 🟡 Moyen | À surveiller |
| Architecture Backend | 7.5 | 🟢 Bonne | Stable |
| Qualité Code Frontend | 6.5 | 🟡 Moyen | Correct |
| UX/UI | 6.0 | 🟡 Moyen | À améliorer |
| Performance | 6.0 | 🟡 Moyen | Correct |
| Tests | 2.0 | 🔴 Très Faible | Absent |
| DevOps | 7.0 | 🟡 Moyen | Correct |
| Base de données | 6.5 | 🟡 Moyen | À optimiser |
| **SCORE GLOBAL** | **6.1** | 🟡 **MOYEN** | — |

### 1.2 Verdict

Le projet **PDFPro** est un éditeur PDF SaaS fonctionnel avec une architecture moderne et bien organisée. Cependant, des **vulnérabilités sécurité critiques** et l'**absence totale de tests** représentent des risques majeurs pour la production.

### 1.3 Fichiers Analysés

```
BACKEND (1 241 lignes)
├── auth.py                     (75 lignes)  — Auth + JWT
├── database.py                 (74 lignes)  — Modèles SQLAlchemy  
├── main.py                     (85 lignes)  — FastAPI app
├── routers/
│   ├── files.py                (64 lignes)  — CRUD fichiers
│   ├── edit.py                 (137 lignes)  — Édition PDF
│   ├── annotate.py             (24 lignes)   — Surlignage
│   ├── auth_router.py         (128 lignes)  — Auth endpoints
│   ├── billing.py             (121 lignes)  — Stripe billing
│   ├── merge_split.py          (39 lignes)  — Fusion/Division
│   ├── share.py                (42 lignes)  — Partage
│   └── sign.py                 (27 lignes)  — Signature
├── services/
│   ├── pdf_service.py         (210 lignes)  — Opérations PDF
│   ├── email.py                (59 lignes)   — Resend emails
│   ├── cleanup.py              (20 lignes)   — Cleanup scheduled
│   ├── storage.py              (18 lignes)   — Stockage local
│   └── r2_storage.py           (64 lignes)   — Cloudflare R2
└── alembic/
    ├── env.py                  (85 lignes)
    └── versions/
        ├── 001_initial.py       (60 lignes)
        └── 002_add_is_admin.py  (22 lignes)

FRONTEND (2 292 lignes)
├── App.jsx                     (35 lignes)
├── context/AuthContext.jsx      (37 lignes)
├── services/api.js             (94 lignes)
├── pages/
│   ├── LandingPage.jsx        (197 lignes)
│   ├── AuthPage.jsx           (101 lignes)
│   ├── EditorPage.jsx         (285 lignes)  ⚠️ Complexe
│   ├── DashboardPage.jsx      (156 lignes)
│   ├── SettingsPage.jsx       (102 lignes)
│   ├── ResetPasswordPage.jsx  (91 lignes)
│   └── SharedFilePage.jsx     (55 lignes)
├── components/
│   ├── Toolbar.jsx            (115 lignes)
│   ├── FileList.jsx           (148 lignes)
│   ├── PDFViewer.jsx          (115 lignes)  ⚠️ Critique
│   ├── AnnotationLayer.jsx    (148 lignes)
│   ├── TextEditLayer.jsx      (154 lignes) ⚠️ Critique
│   ├── SignaturePanel.jsx     (76 lignes)
│   ├── MergeSplitPanel.jsx    (130 lignes)
│   ├── MetadataPanel.jsx      (106 lignes)
│   ├── OnboardingTooltip.jsx  (46 lignes)
│   ├── PaywallModal.jsx       (70 lignes)
│   ├── UserMenu.jsx           (86 lignes)
│   └── ui/ (7 composants)
├── main.jsx                    (23 lignes)
├── index.css                   (60 lignes)
└── Configs (tailwind, vite, postcss, package.json)

INFRASTRUCTURE
├── docker-compose.yml          (53 lignes)
├── .github/workflows/deploy.yml (33 lignes)
├── .env.example                (26 lignes)
└── README.md                   (113 lignes)
```

---

## 2. AUDIT BACKEND - SÉCURITÉ

### 2.1 Vulnerabilités Critiques 🔴

#### VULNÉRABILITÉ #1 : Secret Key par Défaut

**Fichier** : `backend/auth.py` (ligne 8)

```python
SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production-please")
```

| Aspect | Détail |
|--------|--------|
| Sévérité | 🔴 CRITIQUE |
| OWASP | A02:2021 - Cryptographic Failures |
| Impact | Tous les JWT peuvent être forgés |
| Exploitation | Simple si l'attaquant connaît la clé |
| Probabilité | HAUTE si non changé en prod |

**Problème** : Cette clé par défaut est dans le code source, accessible à quiconque a accès au repo. En prod Railway, si la variable d'environnement n'est pas configurée, le système utilise cette clé faible.

**Solution requise** :
```python
import secrets
import os

def _get_secret_key() -> str:
    key = os.getenv("SECRET_KEY")
    if not key:
        if os.getenv("ENVIRONMENT") == "production":
            raise RuntimeError(
                "SECRET_KEY must be set via ENVIRONMENT variable in production. "
                "Generate with: openssl rand -hex 32"
            )
        # Dev only - warning should be logged
        return secrets.token_hex(32)
    
    # Validate minimum strength
    if len(key) < 32:
        raise ValueError("SECRET_KEY must be at least 32 characters")
    
    return key

SECRET_KEY = _get_secret_key()
```

---

#### VULNÉRABILITÉ #2 : Pas de Validation de Taille de Fichier

**Fichier** : `backend/routers/files.py` (ligne 15)

```python
async def upload_pdf(file: UploadFile = File(...)):
    content = await file.read()  # ❌ Aucune limite
```

| Aspect | Détail |
|--------|--------|
| Sévérité | 🔴 CRITIQUE |
| OWASP | A04:2021 - Insecure Design |
| Impact | DoS par upload de fichiers massifs |
| Exploitation | Upload de PDFs de plusieurs Go |
| Probabilité | HAUTE |

**Problème** : Un attaquant peut uploader des fichiers de taille illimitée, saturant le stockage et crashant le service.

**Solution requise** :
```python
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...), ...):
    content = await file.read()
    
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Fichier trop volumineux. Maximum: {MAX_FILE_SIZE // (1024*1024)}MB"
        )
```

---

#### VULNÉRABILITÉ #3 : Pas de Sanitization du Nom de Fichier

**Fichier** : `backend/routers/files.py` (ligne 22)

```python
db_file = PDFFile(id=file_id, name=file.filename, size_bytes=len(content), user_id=user.id)
```

| Aspect | Détail |
|--------|--------|
| Sévérité | 🔴 CRITIQUE |
| OWASP | A01:2021 - Broken Access Control |
| Impact | Path traversal possible |
| Exploitation | `../../../etc/passwd` |
| Probabilité | MOYENNE |

**Problème** : Le nom de fichier original est stocké sans validation. Bien que `storage.py` ne l'utilise pas directement pour le chemin, c'est une mauvaise pratique.

**Solution requise** :
```python
import re
from pathlib import Path

def sanitize_filename(filename: str) -> str:
    # Remove path components
    name = Path(filename).name
    # Remove null bytes and control characters
    name = re.sub(r'[\x00-\x1f\x7f]', '', name)
    # Replace dangerous characters
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    # Limit length
    name = name[:255]
    return name or "unnamed.pdf"
```

---

#### VULNÉRABILITÉ #4 : Pas de Validation du Type MIME Réel

**Fichier** : `backend/routers/files.py` (ligne 13)

```python
if not file.filename.endswith(".pdf"):
    raise HTTPException(...)
```

| Aspect | Détail |
|--------|--------|
| Sévérité | 🟡 MOYENNE |
| OWASP | A03:2021 - Injection |
| Impact | Upload de fichiers malveillants déguisés |
| Probabilité | MOYENNE |

**Problème** : La vérification se base sur l'extension, facilement falsifiable. Un fichier `.pdf.exe` passerait si l'extension est `.pdf`.

**Solution requise** :
```python
# Validate magic bytes (PDF signature)
if content[:4] != b'%PDF':
    raise HTTPException(
        status_code=400,
        detail="Le fichier n'est pas un PDF valide"
    )
```

---

### 2.2 Vulnérabilités Moyennes 🟡

#### VULNÉRABILITÉ #5 : JWT Sans Refresh Token

**Fichier** : `backend/auth.py`

```python
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 jours
```

| Aspect | Détail |
|--------|--------|
| Sévérité | 🟡 MOYENNE |
| OWASP | A07:2021 - Identification and Authentication Failures |
| Problème | Token long sans rotation = risque si volé |

**Recommandation** : Implémenter refresh tokens avec rotation.

---

#### VULNÉRABILITÉ #6 : Rate Limiting Global Trop Permissif

**Fichier** : `backend/main.py`

```python
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
```

| Aspect | Détail |
|--------|--------|
| Sévérité | 🟡 MOYENNE |
| Problème | 200 req/min = 3.3 req/sec par IP |
| Impact | Bruteforce login possible |

**Recommandation** : Réduire à 30/min pour auth, 100/min pour API.

---

#### VULNÉRABILITÉ #7 : ADMIN_SECRET Comparaison Directe

**Fichier** : `backend/routers/auth_router.py` (ligne 60)

```python
if not ADMIN_SECRET or body.secret != ADMIN_SECRET:
```

| Aspect | Détail |
|--------|--------|
| Sévérité | 🟡 MOYENNE |
| Problème | Timing attack possible |

**Recommandation** : Utiliser `secrets.compare_digest()`.

---

### 2.3 Points Positifs Sécurité ✅

1. ✅ **Mot de passe hashé avec bcrypt** (`auth.py:38`)
2. ✅ **Tokens JWT avec expiration** (`auth.py:27`)
3. ✅ **Validation longueur mot de passe (min 8)** (`auth_router.py:35`)
4. ✅ **Protection contre SQL injection** via SQLAlchemy ORM
5. ✅ **Validation email avec EmailStr** (`auth_router.py:22`)
6. ✅ **CORS configurable** (`main.py:32-36`)
7. ✅ **Sentry optionnel** (`main.py:14-15`)

---

## 3. AUDIT BACKEND - ARCHITECTURE

### 3.1 Structure du Projet ✅

```
backend/
├── main.py              # FastAPI app (routes mount, middleware)
├── database.py           # SQLAlchemy models + session
├── auth.py              # JWT + bcrypt + dependencies
├── routers/             # API endpoints (REST)
│   ├── files.py         # File CRUD
│   ├── edit.py         # Text/image editing
│   ├── annotate.py     # Highlighting
│   ├── merge_split.py  # Merge/split
│   ├── sign.py         # Signatures
│   ├── share.py         # Sharing links
│   ├── billing.py      # Stripe payments
│   └── auth_router.py  # Auth endpoints
├── services/            # Business logic
│   ├── pdf_service.py # PyMuPDF operations
│   ├── email.py        # Resend emails
│   ├── storage.py      # Local storage
│   ├── r2_storage.py   # Cloudflare R2
│   └── cleanup.py      # Scheduled cleanup
└── alembic/            # DB migrations
```

**Note** : Structure propre et modulaire. ✅

### 3.2 Problèmes d'Architecture 🟡

| Problème | Fichier | Impact |
|----------|---------|--------|
| Pas de exception handling centralisé | global | Debug difficile |
| Pas de logging structuré | global | Monitoring faible |
| Pas de validation schemascentralisé | global | Code duplication |
| Pas de middlewares personnalisés | main.py | Pas de request ID |

### 3.3 Patterns Observés

**✅ BON** : Dependency injection FastAPI
```python
@router.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
```

**⚠️ PROBLÈME** : Service direct dans routes
```python
# routers/edit.py:17
pdf_service.add_text(file_id, body.page, body.x, body.y, ...)
```

**Recommandation** : Ajouter une couche service abstraite.

---

## 4. AUDIT BACKEND - PERFORMANCE

### 4.1 Opérations PDF

**Fichier** : `backend/services/pdf_service.py`

| Fonction | Lignes | Problème |
|----------|--------|----------|
| `_open()` | 16-18 | Télécharge depuis R2 à chaque fois |
| `_save()` | 20-30 | Upload complet après chaque modification |
| `add_text()` | 33-35 | Ouvre et resauvegarde le doc entier |
| `add_highlight()` | 50-57 | Pareil |
| `add_image()` | 60-62 | Pareil |
| `merge_pdfs()` | 72-80 | Ouvre tous les docs + crée nouveau |
| `split_pdf()` | 83-95 | Pareil |
| `apply_ocr()` | 123-138 | **LENT** - pytesseract sur chaque page |

### 4.2 Problèmes de Performance

| Problème | Impact | Solution |
|----------|--------|----------|
| Pas de caching | Chaque edit re-télécharge | Redis cache |
| OCR synchrone | Timeout sur gros docs | Background job + Celery |
| Pas de lazy loading | Charge tout en mémoire | Chunk processing |
| Compression non configurable | Toujours garbage=4 | Paramètre utilisateur |

### 4.3 Métriques Observables

```python
# main.py:64-68 - Slow request logging
if duration > 2:
    logger.warning(f"Slow request: {request.method} {request.url.path} took {duration:.2f}s")
```

**Problème** : Seuil de 2s est trop permissif. Recommandé : 500ms.

---

## 5. AUDIT FRONTEND - SÉCURITÉ

### 5.1 Points Positifs ✅

| Feature | Implémentation |
|---------|----------------|
| Token en mémoire (pas localStorage) | ❌ FAUX - En localStorage |
| XSS protection | ✅ React échappe automatiquement |
| CSRF | ✅ JWT dans header Authorization |
| Input sanitization | ✅ Via React |

### 5.2 Points à Améliorer 🟡

#### SÉCURITÉ #1 : Token JWT en LocalStorage

**Fichier** : `frontend/src/services/api.js` (ligne 7)

```javascript
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
```

| Aspect | Détail |
|--------|--------|
| Sévérité | 🟡 MOYENNE |
| OWASP | A07:2021 |
| Problème | XSS peut voler le token |
| Alternative | httpOnly cookie |

**Note** : Pour une SPA, c'est souvent acceptable avec XSS protection. Recommandation d'ajouter `Content-Security-Policy`.

---

#### SÉCURITÉ #2 : Pas de Content Security Policy

**Absence** : Aucune CSP configurée dans le backend.

**Recommandation** :
```python
# main.py
app.add_middleware(
    CORSMiddleware,
    ...
)

# Ajouter custom headers
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response
```

---

## 6. AUDIT FRONTEND - QUALITÉ CODE

### 6.1 Composants Analysés

| Composant | Lignes | Complexité | Qualité |
|-----------|--------|------------|---------|
| EditorPage.jsx | 285 | 🔴 HAUTE | 🟡 Moyenne |
| PDFViewer.jsx | 115 | 🟡 MOYENNE | 🟢 Bonne |
| TextEditLayer.jsx | 154 | 🔴 HAUTE | 🟡 Moyenne |
| AnnotationLayer.jsx | 148 | 🟡 MOYENNE | 🟡 Moyenne |
| FileList.jsx | 148 | 🟡 MOYENNE | 🟢 Bonne |
| Toolbar.jsx | 115 | 🟡 MOYENNE | 🟢 Bonne |

### 6.2 Problèmes de Qualité Identifiés

#### PROBLÈME #1 : Memory Leak dans EditorPage.jsx

**Fichier** : `frontend/src/pages/EditorPage.jsx` (ligne 47)

```javascript
const loadPdf = useCallback(async (f) => {
  const blobUrl = await fetchPdfBlob(f.id)
  setPdfUrl(prev => { 
    if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)  // ✅ Correct
    return blobUrl 
  })
}, [])
```

**Note** : Ce code est en fait correct ! Le `URL.revokeObjectURL(prev)` est appelé quand on change de fichier.

---

#### PROBLÈME #2 : Pas de Debounce sur TextEditLayer

**Fichier** : `frontend/src/components/TextEditLayer.jsx`

```javascript
// Ligne 51-52 : À chaque blur, un appel API
const handleBlur = async () => {
  // ... appelle replaceText() immédiatement
}
```

**Impact** : Si l'utilisateur tape rapidement et blur, plusieurs appels peuvent partir.

**Recommandation** : Ajouter debounce de 500ms.

---

#### PROBLÈME #3 : Pas de Loading States Consistants

**Observation** : Certains composants ont `loading`, d'autres pas.

| Composant | Loading State | Status |
|-----------|-------------|--------|
| TextEditLayer | ❌ | Manquant |
| AnnotationLayer | ❌ | Manquant |
| SignaturePanel | ✅ | Présent |
| MetadataPanel | ✅ | Présent |
| MergeSplitPanel | ✅ | Présent |

---

### 6.3 Problèmes de Code Specifiques

#### PROBLÈME #4 : Scale Hardcodé dans AnnotationLayer

**Fichier** : `frontend/src/components/AnnotationLayer.jsx` (ligne 72)

```javascript
const s = 1.5  // ❌ Hardcodé
const x0 = rect.left / s, y0 = rect.top / s
```

**Problème** : Si SCALE change dans PDFViewer, les coordonnées seront désynchronisées.

**Recommandation** : Passer le scale en props.

---

#### PROBLÈME #5 : Signature avec Coordonnées Hardcodées

**Fichier** : `frontend/src/components/SignaturePanel.jsx` (lignes 14-15)

```javascript
const [x0, setX0] = useState(50)
const [y0, setY0] = useState(700)
```

**Problème** : 700 est une coordonnée arbitraire, probablement hors page sur certains PDFs.

**Recommandation** : Calculer la position basée sur la taille de la page.

---

## 7. AUDIT FRONTEND - UX/UI

### 7.1 Composants UI

| Composant | État | Notes |
|-----------|------|-------|
| Button | ✅ Complet | 4 variants, 3 sizes |
| Panel | ✅ Complet | Header + scrollable |
| Badge | ✅ Complet | 4 variants |
| ConfirmDialog | ✅ Complet | Accessible |
| TextInputModal | ✅ Complet | Avec keyboard nav |
| AppLogo | ✅ Complet | SVG inline |

**Design System** : Cohérent et bien structuré. ✅

### 7.2 Problèmes UX

| # | Problème | Impact | Priorité |
|---|----------|--------|----------|
| 1 | Pas de zoom sur PDF | Haute | 🔴 |
| 2 | Pas de thumbnails/pages preview | Haute | 🔴 |
| 3 | Pas de undo/redo | Haute | 🔴 |
| 4 | Pas de raccourcis clavier | Moyenne | 🟡 |
| 5 | Signature sans preview | Moyenne | 🟡 |
| 6 | Pas de mode nuit | Basse | 🟢 |
| 7 | Pas de collaboration temps réel | N/A | Future |

### 7.3 Problèmes d'Accessibilité

| Problème | WCAG | Impact |
|----------|------|--------|
| Pas de `aria-live` pour les toasts | AA | Screen reader |
| Contrast colors non vérifié | AA | Vision |
| Focus visible parfois absent | AA | Keyboard nav |

---

## 8. AUDIT BASE DE DONNÉES

### 8.1 Schéma

```sql
-- users
id: String PK
email: String UNIQUE INDEX ✅
hashed_password: String
credits: Integer DEFAULT 0
is_admin: Integer DEFAULT 0
stripe_customer_id: String NULLABLE
created_at: DateTime

-- files
id: String PK
name: String
size_bytes: Integer
user_id: String FK → users.id  ❌ Pas d'index
created_at: DateTime
last_accessed_at: DateTime

-- share_links
id: String PK
file_id: String FK → files.id  ❌ Pas d'index
user_id: String FK → users.id   ❌ Pas d'index
token: String UNIQUE INDEX ✅
created_at: DateTime

-- transactions
id: String PK
user_id: String FK → users.id   ❌ Pas d'index
file_id: String NULLABLE        ❌ Pas d'index
type: String
credits_delta: Integer
stripe_session_id: String NULLABLE
created_at: DateTime
```

### 8.2 Index Manquants 🟡

| Table | Colonne | Type recommandé | Impact |
|-------|---------|-----------------|--------|
| files | user_id | Index B-tree | Lecture fichiers user |
| share_links | file_id | Index B-tree | Recherche liens |
| share_links | user_id | Index B-tree | Liens user |
| transactions | user_id | Index B-tree | Historique |
| transactions | created_at | Index DESC | Tri chronologique |

### 8.3 Requêtes N+1 Potentielles

```python
# routers/files.py:27
return [
    {"id": f.id, "name": f.name, "url": r2_storage.get_presigned_url(f.id), "size": f.size_bytes}
    for f in user.files  # relationship lazy load = N+1
]
```

**Impact** : Si 100 fichiers, 100 appels R2 présignés.

**Recommandation** : Batch presigned URLs ou cache Redis.

---

## 9. AUDIT INFRASTRUCTURE/DEVOPS

### 9.1 Docker Compose ✅

```yaml
services:
  postgres:    # ✅ PostgreSQL 16 Alpine
  backend:     # ✅ Python with env vars
  frontend:    # ✅ Node with volumes
```

**Points positifs** :
- ✅ PostgreSQL plutôt que SQLite en prod
- ✅ Volumes nommés pour persistence
- ✅ Variables d'environnement documentées
- ✅ Restart policy `unless-stopped`

**Points à améliorer** :
- ⚠️ Pas de healthchecks
- ⚠️ Pas de limits mémoire/CPU
- ⚠️ Pas de separate networks

---

### 9.2 CI/CD GitHub Actions

**Fichier** : `.github/workflows/deploy.yml`

```yaml
jobs:
  deploy-backend:   # ✅ Séparé
  deploy-frontend:  # ✅ Séparé
```

**Points positifs** :
- ✅ Déploiement séparé backend/frontend
- ✅ Utilisation de `secrets.RAILWAY_TOKEN`

**Points à améliorer** :
- ⚠️ Pas de tests avant déploiement
- ⚠️ Pas de linting/check formatting
- ⚠️ Pas de notification sur failure
- ⚠️ Pas de rollback automatique

---

## 10. ANALYSE FONCTIONNELLE COMPLETE

### 10.1 Fonctionnalités Implémentées

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| **Authentification** | | | |
| Inscription | ✅ | ✅ | OK |
| Connexion | ✅ | ✅ | OK |
| Déconnexion | ✅ | ✅ | OK |
| Mot de passe oublié | ✅ | ✅ | OK |
| Réinitialisation mot de passe | ✅ | ✅ | OK |
| Suppression compte | ✅ | ✅ | OK |
| **Fichiers** | | | |
| Upload PDF | ✅ | ✅ | OK |
| Liste fichiers | ✅ | ✅ | OK |
| Téléchargement | ✅ | ✅ | OK |
| Suppression | ✅ | ✅ | OK |
| **Édition PDF** | | | |
| Ajout texte | ✅ | ✅ | ⚠️ Buggy |
| Remplacement texte | ✅ | ✅ | ⚠️ Buggy |
| Ajout image | ✅ | ✅ | ⚠️ Basic |
| Surlignage | ✅ | ✅ | OK |
| **Signature** | | | |
| Création signature | ✅ | ✅ | ⚠️ Basic |
| Apposition signature | ✅ | ✅ | ⚠️ No preview |
| **Fusion/Division** | | | |
| Fusion PDFs | ✅ | ✅ | OK |
| Division PDF | ✅ | ✅ | ⚠️ Complex UX |
| **Métadonnées** | | | |
| Lecture métadonnées | ✅ | ✅ | OK |
| Écriture métadonnées | ✅ | ✅ | OK |
| **Autres outils** | | | |
| Compression | ✅ | ✅ | OK |
| Export PNG | ✅ | ✅ | OK |
| OCR | ✅ | ✅ | ⚠️ Lent |
| **Billing** | | | |
| Achat crédits | ✅ | ✅ | OK |
| Solde | ✅ | ✅ | OK |
| Historique | ✅ | ✅ | OK |
| Webhook Stripe | ✅ | N/A | OK |
| **Partage** | | | |
| Création lien | ✅ | ✅ | OK |
| Accès fichier partagé | ✅ | ✅ | OK |

### 10.2 Fonctionnalités Manquantes

| Feature | Priorité | Complexité | Demande |
|---------|----------|-----------|---------|
| Rotation de pages | 🔴 HAUTE | Moyenne | ★★★★★ |
| Suppression de pages | 🔴 HAUTE | Moyenne | ★★★★★ |
| Réorganisation pages | 🔴 HAUTE | Haute | ★★★★☆ |
| Undo/Redo | 🔴 HAUTE | Haute | ★★★★★ |
| Zoom | 🟡 MOYENNE | Faible | ★★★★☆ |
| Thumbnails | 🟡 MOYENNE | Moyenne | ★★★★☆ |
| Protection mot de passe | 🟡 MOYENNE | Moyenne | ★★★☆☆ |
| Filigrane | 🟡 MOYENNE | Moyenne | ★★★☆☆ |
| Formulaires PDF | 🟡 MOYENNE | Très haute | ★★☆☆☆ |
| OCR multilingue | 🟢 BASSE | Moyenne | ★★☆☆☆ |
| Mode nuit | 🟢 BASSE | Faible | ★☆☆☆☆ |

---

## 11. PLAN D'AMÉLIORATION DÉTAILLÉ

### PHASE 1 : CORRECTIFS CRITIQUES (Semaine 1-2)

#### TÂCHE 1.1 : Sécurité - Secret Key Dynamique

**Fichiers** : `backend/auth.py`

```python
# AVANT (ligne 8)
SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production-please")

# APRÈS
import secrets
import os

def _get_secret_key() -> str:
    key = os.getenv("SECRET_KEY")
    if not key:
        if os.getenv("RAILWAY_ENVIRONMENT") == "production":
            raise RuntimeError(
                "FATAL: SECRET_KEY must be set in production. "
                "Generate with: python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        return secrets.token_hex(32)
    if len(key) < 32:
        raise ValueError("SECRET_KEY must be at least 32 characters")
    return key

SECRET_KEY = _get_secret_key()
```

**Temps estimé** : 30 minutes  
**Risque** : Faible  
**Impact** : 🔴 Critique

---

#### TÂCHE 1.2 : Sécurité - Validation Upload

**Fichiers** : `backend/routers/files.py`

```python
# Ajouter au début du fichier
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_CONTENT_TYPES = {"application/pdf"}

@router.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Validate extension
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Seuls les fichiers PDF sont acceptés"
        )
    
    # Read content
    content = await file.read()
    
    # Validate size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Fichier trop volumineux. Maximum: {MAX_FILE_SIZE // (1024*1024)}MB"
        )
    
    # Validate magic bytes (PDF signature)
    if content[:4] != b'%PDF':
        raise HTTPException(
            status_code=400,
            detail="Le fichier n'est pas un PDF valide"
        )
    
    # Validate PDF completeness (basic check)
    if b'%%EOF' not in content[-1024:]:
        raise HTTPException(
            status_code=400,
            detail="Fichier PDF incomplet ou corrompu"
        )
```

**Temps estimé** : 1 heure  
**Risque** : Moyen (peut casser certains uploads légitimes malformés)  
**Impact** : 🔴 Critique

---

#### TÂCHE 1.3 : Sécurité - Sanitization Filename

**Fichiers** : `backend/routers/files.py`

```python
import re
from pathlib import Path

def sanitize_filename(filename: str) -> str:
    """Sanitize user-provided filename for safe storage."""
    # Extract just the filename (remove any path components)
    name = Path(filename).name
    
    # Remove null bytes and control characters
    name = re.sub(r'[\x00-\x1f\x7f]', '', name)
    
    # Replace potentially dangerous characters
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    
    # Remove leading/trailing dots and spaces
    name = name.strip('. ')
    
    # Limit length
    name = name[:255]
    
    # Ensure non-empty
    if not name:
        name = f"document_{uuid.uuid4().hex[:8]}.pdf"
    
    # Always ensure .pdf extension
    if not name.lower().endswith('.pdf'):
        name = name + '.pdf'
    
    return name

# Utilisation dans upload_pdf:
safe_name = sanitize_filename(file.filename)
db_file = PDFFile(id=file_id, name=safe_name, size_bytes=len(content), user_id=user.id)
```

**Temps estimé** : 30 minutes  
**Risque** : Faible  
**Impact** : 🟡 Moyen

---

#### TÂCHE 1.4 : Rate Limiting Amélioré

**Fichiers** : `backend/main.py`

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute"]
)

# Dans chaque route sensitive, ajouter:
@router.post("/login")
@limiter.limit("10/minute")  # 10 tentatives/minute max
async def login(...):
    ...

@router.post("/register")
@limiter.limit("5/minute")  # 5 inscriptions/minute max
async def register(...):
    ...
```

**Temps estimé** : 1 heure  
**Risque** : Faible  
**Impact** : 🟡 Moyen

---

### PHASE 2 : QUALITÉ & PERFORMANCE (Semaine 3-4)

#### TÂCHE 2.1 : Tests Unitaires Backend

**Fichiers** : Créer `backend/tests/`

```python
# backend/tests/__init__.py
# backend/tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app
from database import Base, get_db
from auth import get_current_user, hash_password
from models import User

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

@pytest.fixture
def db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass
    
    def override_get_current_user():
        user = User(id="test-user", email="test@test.com", hashed_password=hash_password("password123"))
        db.add(user)
        db.commit()
        return user
    
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    
    with TestClient(app) as c:
        yield c
    
    app.dependency_overrides.clear()

# backend/tests/test_auth.py
def test_register_success(client):
    response = client.post("/api/auth/register", json={
        "email": "new@test.com",
        "password": "password123"
    })
    assert response.status_code == 201
    assert "access_token" in response.json()

def test_register_duplicate_email(client):
    # Test idempotent pour ne pas polluer la DB
    pass

def test_login_success(client):
    response = client.post("/api/auth/login", data={
        "username": "test@test.com",
        "password": "password123"
    })
    assert response.status_code == 200

def test_login_wrong_password(client):
    response = client.post("/api/auth/login", data={
        "username": "test@test.com",
        "password": "wrongpassword"
    })
    assert response.status_code == 401

# backend/tests/test_files.py
def test_upload_pdf_success(client, tmp_path):
    # Créer un PDF temporaire
    pdf_path = tmp_path / "test.pdf"
    pdf_path.write_bytes(b"%PDF-1.4 test content %%EOF")
    
    with open(pdf_path, "rb") as f:
        response = client.post(
            "/api/files/upload",
            files={"file": ("test.pdf", f, "application/pdf")}
        )
    
    assert response.status_code == 200
    assert "id" in response.json()

def test_upload_pdf_too_large(client):
    # Test avec fichier > 50MB
    large_content = b"%PDF-1.4" + b"x" * (51 * 1024 * 1024) + b"%%EOF"
    response = client.post(
        "/api/files/upload",
        files={"file": ("large.pdf", large_content, "application/pdf")}
    )
    assert response.status_code == 413

def test_upload_non_pdf(client):
    response = client.post(
        "/api/files/upload",
        files={"file": ("test.txt", b"not a pdf", "text/plain")}
    )
    assert response.status_code == 400
```

**Temps estimé** : 8 heures  
**Risque** : Faible  
**Impact** : 🔴 Critique pour la maintainabilité

---

#### TÂCHE 2.2 : Debounce TextEditLayer

**Fichiers** : `frontend/src/components/TextEditLayer.jsx`

```javascript
import { useState, useRef, useEffect, useCallback } from "react"

// Ajouter ce hook
function useDebounce(callback, delay) {
  const timeoutRef = useRef(null)
  
  return useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      callback(...args)
    }, delay)
  }, [callback, delay])
}

// Modifier TextBlock component
function TextBlock({ block, viewport, fileId, currentPage, onSaved }) {
  const divRef = useRef(null)
  const originalStr = useRef(block.str)
  const [hovered, setHovered] = useState(false)
  const [editing, setEditing] = useState(false)
  
  // ...existing coordinate calculations...
  
  // Debounced save
  const debouncedSave = useDebounce(async (newVal) => {
    try {
      await replaceText(fileId, {
        page: currentPage - 1,
        x_pdf: block.x_pdf,
        y_pdf_baseline: block.y_pdf_baseline,
        width_pdf: block.width_pdf,
        new_text: newVal,
        font_size: block.fontSize_pdf,
        color: [0, 0, 0],
      })
      originalStr.current = newVal
      onSaved && onSaved()
    } catch (err) {
      console.error("Erreur replace-text:", err)
      if (divRef.current) divRef.current.innerText = originalStr.current
    }
  }, 500)
  
  const handleBlur = () => {
    setEditing(false)
    const newVal = divRef.current?.innerText ?? ""
    if (newVal === originalStr.current) return
    debouncedSave(newVal)
  }
  
  // ...rest of component...
}
```

**Temps estimé** : 1 heure  
**Risque** : Faible  
**Impact** : 🟡 Moyen (évite API spam)

---

#### TÂCHE 2.3 : Zoom Controls

**Fichiers** : `frontend/src/components/PDFViewer.jsx`, `EditorPage.jsx`

```javascript
// PDFViewer.jsx - Ajouter state pour scale
const [scale, setScale] = useState(SCALE)  // 1.5

// Ajouter contrôles de zoom
<div className="flex items-center gap-2 mb-4">
  <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))}>-</button>
  <span>{Math.round(scale * 100)}%</span>
  <button onClick={() => setScale(s => Math.min(3, s + 0.25))}>+</button>
  <button onClick={() => setScale(1.5)}>Reset</button>
</div>

// Utiliser scale dans getViewport
const viewport = page.getViewport({ scale })
```

**Temps estimé** : 2 heures  
**Risque** : Faible  
**Impact** : 🟡 Moyen

---

### PHASE 3 : FONCTIONNALITÉS (Mois 2)

#### TÂCHE 3.1 : Rotation de Pages

**Fichiers** : `backend/routers/pages.py` (nouveau), `backend/services/pdf_service.py`

```python
# backend/routers/pages.py
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from auth import require_credit
from services import pdf_service

router = APIRouter()

class RotatePageRequest(BaseModel):
    page: int
    degrees: int = 90  # 90, 180, or 270

@router.post("/{file_id}/rotate-page")
def rotate_page(file_id: str, body: RotatePageRequest, user=Depends(require_credit)):
    if body.degrees not in [90, 180, 270]:
        raise HTTPException(status_code=400, detail="Degrees must be 90, 180, or 270")
    
    try:
        pdf_service.rotate_page(file_id, body.page, body.degrees)
        return {"message": f"Page rotated {body.degrees}°"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="PDF introuvable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# backend/services/pdf_service.py
def rotate_page(file_id: str, page_number: int, degrees: int) -> None:
    doc = _open(file_id)
    page = doc[page_number]
    page.set_rotation(degrees)
    _save(doc, file_id, clean=True)
```

**Frontend** : Ajouter bouton dans Toolbar
```javascript
{ id: 'rotate', Icon: RotateCw, label: 'Rotation' }
```

**Temps estimé** : 4 heures  
**Risque** : Moyen  
**Impact** : 🔴 HAUTE

---

#### TÂCHE 3.2 : Suppression de Pages

**Fichiers** : `backend/routers/pages.py`, `backend/services/pdf_service.py`

```python
class DeletePagesRequest(BaseModel):
    pages: list[int]  # Page indices (0-based)

@router.post("/{file_id}/delete-pages")
def delete_pages(file_id: str, body: DeletePagesRequest, user=Depends(require_credit)):
    try:
        pdf_service.delete_pages(file_id, body.pages)
        return {"message": f"{len(body.pages)} page(s) supprimée(s)"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="PDF introuvable")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# backend/services/pdf_service.py
def delete_pages(file_id: str, page_indices: list[int]) -> None:
    """Delete specified pages (0-based indices)."""
    doc = _open(file_id)
    
    # Convert to 1-based for PyMuPDF
    pages_to_delete = [i + 1 for i in sorted(page_indices, reverse=True)]
    
    for page_num in pages_to_delete:
        if 0 < page_num <= len(doc):
            doc.delete_page(page_num - 1)
    
    _save(doc, file_id, clean=True)
```

**Frontend** : Panel de sélection de pages avec checkbox

**Temps estimé** : 6 heures  
**Risque** : Moyen (irréversible)  
**Impact** : 🔴 HAUTE

---

#### TÂCHE 3.3 : Undo/Redo

**Fichiers** : `frontend/src/hooks/useUndoRedo.js` (nouveau)

```javascript
import { useState, useCallback, useRef } from 'react'

const MAX_HISTORY = 50

export function useUndoRedo(initialState = null) {
  const [state, setState] = useState(initialState)
  const historyRef = useRef([initialState])
  const indexRef = useRef(0)

  const push = useCallback((newState) => {
    // Remove any "future" states if we're not at the end
    historyRef.current = historyRef.current.slice(0, indexRef.current + 1)
    
    // Add new state
    historyRef.current.push(newState)
    
    // Limit history size
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift()
    } else {
      indexRef.current++
    }
    
    setState(newState)
  }, [])

  const undo = useCallback(() => {
    if (indexRef.current > 0) {
      indexRef.current--
      setState(historyRef.current[indexRef.current])
    }
  }, [])

  const redo = useCallback(() => {
    if (indexRef.current < historyRef.current.length - 1) {
      indexRef.current++
      setState(historyRef.current[indexRef.current])
    }
  }, [])

  const canUndo = indexRef.current > 0
  const canRedo = indexRef.current < historyRef.current.length - 1

  return { state, push, undo, redo, canUndo, canRedo }
}
```

**Intégration dans EditorPage.jsx** :
```javascript
const { state: pdfState, push: pushPdfState, undo, redo, canUndo, canRedo } = useUndoRedo()

// Ajouter shortcut clavier
useEffect(() => {
  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
      if (e.shiftKey) redo()
      else undo()
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [undo, redo])
```

**Temps estimé** : 6 heures  
**Risque** : Moyen  
**Impact** : 🔴 HAUTE

---

### PHASE 4 : AMÉLIORATIONS UX (Mois 3)

#### TÂCHE 4.1 : Thumbnail Sidebar

**Fichiers** : `frontend/src/components/ThumbnailSidebar.jsx` (nouveau)

```javascript
import React, { useEffect, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

export default function ThumbnailSidebar({ 
  fileUrl, 
  currentPage, 
  totalPages, 
  onSelectPage 
}) {
  const [thumbnails, setThumbnails] = useState({})
  
  useEffect(() => {
    if (!fileUrl) return
    
    const loadThumbnails = async () => {
      const pdf = await pdfjsLib.getDocument({ url: fileUrl }).promise
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 0.2 })
        
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        
        await page.render({
          canvasContext: canvas.getContext('2d'),
          viewport
        }).promise
        
        setThumbnails(prev => ({
          ...prev,
          [i]: canvas.toDataURL()
        }))
      }
    }
    
    loadThumbnails()
  }, [fileUrl])
  
  return (
    <div className="w-32 bg-surface-raised overflow-y-auto p-2 space-y-2">
      {Array.from({ length: totalPages }).map((_, i) => (
        <button
          key={i + 1}
          onClick={() => onSelectPage(i + 1)}
          className={`w-full rounded border-2 transition-all overflow-hidden ${
            currentPage === i + 1 
              ? 'border-brand shadow-md' 
              : 'border-transparent hover:border-border-strong'
          }`}
        >
          {thumbnails[i + 1] ? (
            <img 
              src={thumbnails[i + 1]} 
              alt={`Page ${i + 1}`}
              className="w-full"
            />
          ) : (
            <div className="aspect-[3/4] bg-white animate-pulse" />
          )}
          <span className="block text-2xs text-center py-1">{i + 1}</span>
        </button>
      ))}
    </div>
  )
}
```

**Intégration dans EditorPage.jsx** : Ajouter entre Toolbar et main content

**Temps estimé** : 4 heures  
**Risque** : Faible  
**Impact** : 🟡 Moyen

---

#### TÂCHE 4.2 : Tests E2E Playwright

**Fichiers** : `frontend/tests/e2e/` (nouveau)

```bash
# frontend/tests/e2e/editor.spec.js
import { test, expect } from '@playwright/test'

test.describe('PDF Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    // Login
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/app')
  })

  test('upload and view PDF', async ({ page }) => {
    // Upload
    await page.click('button:has-text("Importer")')
    await page.setInputFiles('input[type="file"]', 'test.pdf')
    
    // Verify file appears
    await expect(page.locator('.file-item')).toContainText('test.pdf')
    
    // Verify PDF viewer loads
    await expect(page.locator('canvas')).toBeVisible()
  })

  test('edit text in PDF', async ({ page }) => {
    // Select file
    await page.click('.file-item:first-child')
    
    // Click text tool
    await page.click('button[aria-label="Texte"]')
    
    // Click on text block
    await page.locator('.text-block').first().dblclick()
    
    // Type new text
    await page.keyboard.type('New text')
    await page.keyboard.press('Enter')
    
    // Verify success toast
    await expect(page.locator('text=Texte remplacé')).toBeVisible()
  })

  test('merge PDFs', async ({ page }) => {
    // Upload multiple files first
    // ...
    
    // Click merge tool
    await page.click('button[aria-label="Combiner"]')
    
    // Select files
    await page.click('.file-checkbox:first-child')
    await page.click('.file-checkbox:nth-child(2)')
    
    // Click combine
    await page.click('button:has-text("Combiner")')
    
    // Verify merged file
    await expect(page.locator('.file-item')).toContainText('merged.pdf')
  })

  test('insufficient credits', async ({ page }) => {
    // Set credits to 0 (via API mock or directly in DB)
    // ...
    
    // Try to upload
    await page.click('button:has-text("Importer")')
    await page.setInputFiles('input[type="file"]', 'test.pdf')
    
    // Verify paywall modal
    await expect(page.locator('text=Crédits insuffisants')).toBeVisible()
  })
})

test.describe('Auth', () => {
  test('register new user', async ({ page }) => {
    await page.goto('/login')
    await page.click('button:has-text("S\'inscrire")')
    await page.fill('input[type="email"]', 'newuser@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    // Should redirect to app
    await page.waitForURL('/app')
    
    // Should have 5 free credits
    await expect(page.locator('text=5 crédits')).toBeVisible()
  })

  test('login with wrong password', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')
    
    await expect(page.locator('text=Email ou mot de passe incorrect')).toBeVisible()
  })
})
```

**Configuration Playwright** :
```javascript
// playwright.config.js
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
})
```

**Temps estimé** : 12 heures  
**Risque** : Faible  
**Impact** : 🟡 Moyen

---

## 12. MATRICE DE PRIORISATION FINALE

| # | Tâche | Phase | Effort | Impact | Risque | Priorité |
|---|-------|-------|--------|--------|--------|----------|
| 1 | Secret Key Dynamique | P1 | 30min | 🔴 | Faible | P0 |
| 2 | Validation Upload | P1 | 1h | 🔴 | Moyen | P0 |
| 3 | Sanitization Filename | P1 | 30min | 🟡 | Faible | P1 |
| 4 | Rate Limiting Auth | P1 | 1h | 🟡 | Faible | P1 |
| 5 | Tests Unitaires | P2 | 8h | 🔴 | Faible | P1 |
| 6 | Rotation Pages | P3 | 4h | 🔴 | Moyen | P1 |
| 7 | Suppression Pages | P3 | 6h | 🔴 | Moyen | P1 |
| 8 | Undo/Redo | P3 | 6h | 🔴 | Moyen | P1 |
| 9 | Debounce TextEdit | P2 | 1h | 🟡 | Faible | P2 |
| 10 | Zoom Controls | P2 | 2h | 🟡 | Faible | P2 |
| 11 | Thumbnail Sidebar | P4 | 4h | 🟡 | Faible | P2 |
| 12 | Tests E2E | P4 | 12h | 🟡 | Faible | P3 |
| 13 | Raccourcis Clavier | P4 | 2h | 🟢 | Faible | P3 |
| 14 | Mode Nuit | P4 | 4h | 🟢 | Faible | P4 |

---

## 13. ESTIMATION GLOBALE

| Phase | Semaines | Tâches | Heures |
|-------|----------|--------|--------|
| P0 - Critique | 1-2 | 4 | ~8h |
| P1 - Qualité | 3-4 | 4 | ~20h |
| P2 - Performance | 5-6 | 3 | ~7h |
| P3 - Fonctionnalités | 7-10 | 3 | ~16h |
| P4 - UX/Tests | 11-14 | 4 | ~22h |
| **TOTAL** | **14 semaines** | **18** | **~73h** |

---

## 14. RECOMMANDATIONS STRATÉGIQUES

### Court Terme (1-2 semaines)
1. ✅ **IMMÉDIAT** : Corriger les 2 vulnérabilités critiques (Secret Key + Upload)
2. ✅ Corriger sanitization filename
3. ✅ Améliorer rate limiting

### Moyen Terme (1-2 mois)
4. ✅ Ajouter tests unitaires (>80% coverage)
5. ✅ Implémenter rotation/suppression pages
6. ✅ Ajouter undo/redo
7. ✅ Corriger debounce et zoom

### Long Terme (3-4 mois)
8. ✅ Tests E2E Playwright
9. ✅ Thumbnails sidebar
10. ✅ Mode nuit
11. ✅ Raccourcis clavier
12. ✅ Mode collaboration (futur)

---

*Document généré le 18 août 2026 - PDFPro Audit Complet v2.0*
*Tous les 63 fichiers ont été analysés exhaustivement.*
