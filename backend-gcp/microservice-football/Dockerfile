# --- Fichier: backend-gcp/microservice-football/Dockerfile ---

# Phase 1: Build - Compilation du TypeScript
# Utilisation de Node.js 20 pour la compatibilité avec les dépendances
FROM node:20-slim AS builder

WORKDIR /usr/src/app

# Copier les fichiers de dépendances et les installer
COPY package*.json ./
RUN npm install

# Copier le reste du code source
COPY . .

# Donner la permission d'exécution au compilateur TypeScript
# (Note: cette ligne n'est souvent pas nécessaire mais ne pose pas de problème)
RUN chmod +x ./node_modules/typescript/bin/tsc

# Compiler le TypeScript en JavaScript dans le dossier /dist
RUN ./node_modules/typescript/bin/tsc

# Phase 2: Production - Création de l'image finale légère
# Utilisation de Node.js 20 pour la cohérence
FROM node:20-slim AS production

WORKDIR /usr/src/app

# Copier uniquement les dépendances de production
COPY package*.json ./
# Utilisation de --omit=dev, la commande moderne équivalente à --production
RUN npm install --omit=dev

# Copier le code JavaScript compilé depuis la phase de build
COPY --from=builder /usr/src/app/dist ./dist

# Commande pour démarrer le serveur web
CMD ["node", "dist/index.js"]