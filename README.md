# PDFPro — Éditeur PDF

Éditeur PDF professionnel en ligne, conçu pour être autonome et déployable en un seul commande.

![Stack](https://img.shields.io/badge/React-18-61DAFB?logo=react) ![Stack](https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi) ![Stack](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss) ![Stack](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)

---

## Fonctionnalités

| Outil | Description |
|-------|-------------|
| **Texte** | Cliquez sur le PDF pour éditer le texte existant inline |
| **Surlignage** | Sélectionnez une zone pour ajouter un surlignage jaune |
| **Image** | Insérez une image à l'endroit de votre choix |
| **Signature** | Dessinez et apposez une signature électronique |
| **Combiner** | Fusionnez plusieurs PDFs en un seul document |
| **Séparer** | Divisez un PDF en plusieurs parties par plages de pages |

---

## Stack technique

**Frontend**
- React 18 + Vite 5
- Tailwind CSS 3 (design system avec tokens de couleur)
- Lucide React (icônes)
- pdf.js (rendu PDF)
- Fabric.js (canvas d'annotation)
- Sonner (notifications toast)

**Backend**
- FastAPI + Uvicorn
- PyMuPDF (`fitz`) — manipulation PDF
- Pillow — traitement image
- Stockage fichier local (`/uploads`)

---

## Lancement rapide

**Prérequis :** Docker + Docker Compose

```bash
git clone <repo-url>
cd pdf-editor
docker compose up --build
```

L'application est disponible sur **http://localhost:5173**

---

## Structure du projet

```
pdf-editor/
├── backend/                  # API FastAPI
│   ├── main.py               # Point d'entrée
│   ├── routers/
│   │   ├── files.py          # Upload / download / delete
│   │   ├── edit.py           # Ajout texte & image
│   │   ├── annotate.py       # Surlignage
│   │   ├── merge_split.py    # Fusion & division
│   │   └── sign.py           # Signature électronique
│   ├── services/
│   │   ├── pdf_service.py    # Logique PyMuPDF
│   │   └── storage.py        # Gestion fichiers
│   └── requirements.txt
│
├── frontend/                 # Application React
│   ├── src/
│   │   ├── pages/
│   │   │   └── EditorPage.jsx     # Page principale
│   │   ├── components/
│   │   │   ├── ui/                # Primitives (Button, Panel, Badge…)
│   │   │   ├── Toolbar.jsx        # Barre d'outils
│   │   │   ├── FileList.jsx       # Sidebar fichiers
│   │   │   ├── PDFViewer.jsx      # Rendu pdf.js
│   │   │   ├── AnnotationLayer.jsx # Canvas Fabric.js
│   │   │   ├── TextEditLayer.jsx  # Édition texte inline
│   │   │   ├── SignaturePanel.jsx # Panneau signature
│   │   │   └── MergeSplitPanel.jsx # Panneau fusion/division
│   │   └── services/
│   │       └── api.js             # Client Axios
│   ├── tailwind.config.js    # Design tokens
│   └── package.json
│
└── docker-compose.yml
```

---

## API

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/files/` | Lister les fichiers |
| `POST` | `/api/files/upload` | Uploader un PDF |
| `GET` | `/api/files/{id}/download` | Télécharger un fichier |
| `DELETE` | `/api/files/{id}` | Supprimer un fichier |
| `POST` | `/api/files/{id}/add-text` | Ajouter du texte |
| `POST` | `/api/files/{id}/add-image` | Insérer une image |
| `POST` | `/api/files/{id}/highlight` | Ajouter un surlignage |
| `POST` | `/api/files/{id}/sign` | Apposer une signature |
| `POST` | `/api/merge` | Fusionner des PDFs |
| `POST` | `/api/files/{id}/split` | Diviser un PDF |

Documentation interactive : **http://localhost:8000/docs**

---

## Développement local

```bash
# Backend uniquement
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend uniquement
cd frontend
npm install
npm run dev
```

---

## Variables d'environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `PYTHONUNBUFFERED` | `1` | Logs Python non bufférisés |

Les fichiers uploadés sont persistés dans le volume Docker `uploads_data`.
