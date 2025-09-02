# Phase 1: Build -- Compilation du TypeScript
FROM node:18-slim AS builder

WORKDIR /usr/src/app

# Copier les fichiers de dépendances et les installer
COPY package*.json ./
RUN npm install

# Copier le reste du code source
COPY . .

# --- LA CORRECTION EST ICI ---
# Donner la permission d'exécution au compilateur TypeScript
RUN chmod +x ./node_modules/typescript/bin/tsc

# Compiler le TypeScript en JavaScript dans le dossier /dist
RUN ./node_modules/typescript/bin/tsc

# Phase 2: Production - Création de l'image finale légère
FROM node:18-slim AS production

WORKDIR /usr/src/app

# Copier uniquement les dépendances de production
COPY package*.json ./
RUN npm install --production

# Copier le code JavaScript compilé depuis la phase de build
COPY --from=builder /usr/src/app/dist ./dist

# Commande pour exécuter le job
# On suppose que dist/index.js est le point d'entrée qui appelle runTicketGenerator()
CMD ["node", "dist/index.js"]