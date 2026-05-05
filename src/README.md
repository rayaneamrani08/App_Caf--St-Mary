# Compteur de Caisse — Café St. Mary

Application mobile interne pour les employés du Café St. Mary — permet de compter rapidement le contenu d'une caisse, de calculer automatiquement le float à garder (300 $) et de déterminer le montant à déposer en enveloppe.

## Déploiement sur Vercel (5 minutes)

### Option A — Via l'interface Vercel (le plus simple)

1. Va sur [vercel.com](https://vercel.com) → crée un compte gratuit
2. Clique **"Add New Project"**
3. Clique **"Upload"** (pas besoin de GitHub)
4. Glisse le dossier `caisse-app` entier
5. Clique **Deploy** → t'as une URL en 1 minute

### Option B — Via GitHub (recommandé pour les mises à jour)

1. Crée un repo GitHub et pousse ce dossier
2. Va sur [vercel.com](https://vercel.com) → **"Add New Project"** → importe ton repo
3. Deploy → URL automatique

---

## Installer sur iPhone (après déploiement)

1. Ouvre ton URL Vercel dans **Safari** (pas Chrome)
2. Appuie sur l'icône **Partager** (carré avec flèche)
3. Scroll → **"Sur l'écran d'accueil"**
4. Appuie **Ajouter**

L'app apparaît sur ton écran d'accueil comme une vraie app, plein écran, sans barre Safari.

---

## Développement local

```bash
npm install
npm run dev
```
