#!/bin/bash

# Couleurs pour les messages
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Vérifier si le fichier .env existe
if [ ! -f .env ]; then
    echo -e "${RED}Erreur: Fichier .env manquant${NC}"
    exit 1
fi

# Charger les variables d'environnement
source .env

# Vérifier les variables requises
if [ -z "$FTP_SERVER" ] || [ -z "$FTP_USERNAME" ] || [ -z "$FTP_PASSWORD" ]; then
    echo -e "${RED}Erreur: Variables FTP manquantes dans .env${NC}"
    echo "Ajoutez FTP_SERVER, FTP_USERNAME et FTP_PASSWORD dans votre fichier .env"
    exit 1
fi

# Build de production avec Docker
echo -e "${GREEN}🔨 Construction de l'application...${NC}"
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Attendre que le build soit terminé et copier les fichiers
echo -e "${GREEN}📦 Préparation des fichiers pour le déploiement...${NC}"
docker cp $(docker compose -f docker-compose.prod.yml ps -q app):/app/dist ./dist_prod

# Déployer via FTP
echo -e "${GREEN}🚀 Déploiement vers O2Switch...${NC}"
lftp -c "
open ftp://$FTP_USERNAME:$FTP_PASSWORD@$FTP_SERVER
mirror -R --parallel=4 --delete ./dist_prod/ /
bye
"

# Nettoyage
echo -e "${GREEN}🧹 Nettoyage...${NC}"
rm -rf ./dist_prod
docker compose -f docker-compose.prod.yml down

echo -e "${GREEN}✅ Déploiement terminé !${NC}"
