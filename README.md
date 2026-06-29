# Tournee Snack Express

Application de gestion de livraisons pour snacks et restaurants. Gestion des commandes, des tournees, du stock, et suivi GPS en temps reel.

## Demarrage rapide

### Prerequis

- Node.js 18+
- PostgreSQL 14+

### Installation en 3 etapes

```bash
# 1. Copier la config et creer la base de donnees
cp server/.env.example server/.env
createdb tournee_snack

# 2. Installer, initialiser le schema et charger les donnees de demo
npm run setup

# 3. Lancer l'application
npm run dev
```

Le frontend demarre sur **http://localhost:5173** et le backend sur **http://localhost:3001**.

### Comptes de demonstration

| Role | Utilisateur | Mot de passe |
|------|-------------|--------------|
| Gestionnaire | `admin` | `admin123` |
| Livreur 1 | `karim.b` | `livreur123` |
| Livreur 2 | `sara.m` | `livreur123` |

### Donnees de demo

- 1 commerce (Snack El Baraka)
- 5 produits (3 snacks + 2 boissons)
- 3 commandes (CMD-1001 a CMD-1003)
- 1 code promo `BIENVENUE` (10% des 10 EUR)

### Pages publiques

- **Commander** : `http://localhost:5173/commander/00000000-0000-0000-0000-000000000001`
- **Suivi commande** : `http://localhost:5173/suivi/CMD-1001`

## Scripts

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lance le frontend et le backend |
| `npm run dev:client` | Lance uniquement le frontend |
| `npm run dev:server` | Lance uniquement le backend |
| `npm run db:init` | Initialise le schema PostgreSQL |
| `npm run db:seed` | Charge les donnees de demo |
| `npm run setup` | Installe + init DB + seed (tout-en-un) |

## Architecture

```
client/          React 18 + Tailwind CSS + Vite
  src/pages/     Pages principales (Login, Dashboard, Livreur, Client, Suivi)
  src/pages/tabs/  Onglets du dashboard (Tournees, Stats, Stock, Equipe, Historique)
  src/stores/    Zustand (auth, notifications)
  src/utils/     API client avec token JWT en memoire

server/          Express + Socket.IO + PostgreSQL
  src/routes/    API REST (auth, products, orders, tours, promos, stats)
  src/config/    Base de donnees, schema SQL, seed
  src/middleware/ Authentification JWT
  src/utils/     Generateur de numeros, optimiseur de routes
```

## Variables d'environnement

Voir `server/.env.example` pour la configuration complete.

| Variable | Description | Defaut |
|----------|-------------|--------|
| `DATABASE_URL` | URL PostgreSQL | `postgresql://postgres:postgres@localhost:5432/tournee_snack` |
| `JWT_SECRET` | Secret JWT | `tse-dev-secret-key-change-in-production` |
| `PORT` | Port du backend | `3001` |
