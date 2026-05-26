# API Smart Academy of Congo — Backend sécurisé

Serveur Node.js/Express pour gérer authentification, inscriptions, documents et fichiers avec protections anti-intrusion.

## Démarrage rapide

```bash
cd backend
npm install
copy .env.example .env
npm start
```

Ouvrez **http://localhost:3000** (site + API sur le même port).

## Comptes de démonstration

| Rôle | E-mail | Mot de passe |
|------|--------|--------------|
| Étudiant | `etu.demo@unikin.cd` | `Demo2025!` |
| Professeur | `prof.demo@unikin.cd` | `Demo2025!` |
| Assistant | `assist.demo@unikin.cd` | `Demo2025!` |

## Sécurité implémentée

| Mesure | Description |
|--------|-------------|
| **Mots de passe** | Hachage bcrypt (12 rounds), politique 8+ caractères avec lettre et chiffre |
| **Sessions** | JWT court (15 min) en cookie `httpOnly` + jeton de rafraîchissement opaque rotatif (7 j) |
| **Anti brute-force** | Verrouillage temporaire après 5 échecs de connexion |
| **Rate limiting** | 300 req / 15 min global, 20 / 15 min sur `/api/auth` |
| **Helmet** | En-têtes HTTP sécurisés (CSP, HSTS en production, etc.) |
| **CORS** | Origines autorisées uniquement (`ALLOWED_ORIGINS`) |
| **XSS** | Nettoyage des textes (bibliothèque `xss`) |
| **SQL** | Requêtes préparées SQLite (pas d'injection SQL) |
| **Fichiers** | Types vérifiés par magic bytes, 5 Mo max, extensions dangereuses bloquées |
| **Autorisation** | Chaque route vérifie le rôle ; documents filtrés par classe côté serveur |
| **Erreurs** | Messages génériques en production, pas de fuite de stack |

## Production

1. Définir `NODE_ENV=production`
2. Générer des secrets JWT longs et uniques dans `.env`
3. Mettre `COOKIE_SECURE=true` (HTTPS obligatoire)
4. Restreindre `ALLOWED_ORIGINS` à votre domaine
5. Placer un reverse proxy (nginx) avec TLS devant Node

## Endpoints principaux

- `GET /api/health` — état du service
- `POST /api/auth/register` — inscription
- `POST /api/auth/login` — connexion
- `POST /api/auth/refresh` — renouveler la session
- `POST /api/auth/logout` — déconnexion
- `GET /api/auth/me` — profil connecté
- `GET /api/documents` — liste (filtrée par rôle)
- `POST /api/documents` — publier (JSON ou multipart)
- `PATCH /api/documents/:id` — modifier
- `DELETE /api/documents/:id` — supprimer
- `POST /api/documents/:id/reactions` — réaction étudiant
