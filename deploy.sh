#!/bin/bash
set -x  # Active le mode debug
set -e  # Quitte en cas d'erreur

# Couleurs pour les messages
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Variables
DOCKER_COMPOSE_FILE="docker-compose.prod.yml"
LOG_FILE="deploy.log"

# Vérifier si Docker et LFTP sont installés
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Erreur: Docker n'est pas installé${NC}"
    exit 1
fi

if ! command -v lftp &> /dev/null; then
    echo -e "${RED}Erreur: LFTP n'est pas installé${NC}"
    exit 1
fi

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
docker compose -f $DOCKER_COMPOSE_FILE build >> $LOG_FILE 2>&1
docker compose -f $DOCKER_COMPOSE_FILE up -d >> $LOG_FILE 2>&1

# Attendre que le build soit terminé et copier les fichiers
echo -e "${GREEN}📦 Préparation des fichiers pour le déploiement...${NC}"
docker cp $(docker compose -f $DOCKER_COMPOSE_FILE ps -q prod):/usr/share/nginx/html/. ./dist_prod

# Dossier source à déployer (local)
LOCAL_DIR="./dist_prod"  # Dossier prod du projet

# Vérifier que le dossier dist_prod existe et contient des fichiers
if [ ! -d "$LOCAL_DIR" ]; then
  echo -e "${RED}Erreur: Le dossier dist_prod n'a pas été créé${NC}"
  exit 1
fi

if [ -z "$(ls -A $LOCAL_DIR)" ]; then
  echo -e "${RED}Erreur: Le dossier dist_prod est vide${NC}"
  exit 1
fi

# Appliquer les permissions AVANT le transfert
echo -e "${GREEN}🔧 Application des permissions locales...${NC}"
find "$LOCAL_DIR" -type d -exec chmod 755 {} \;  # Dossiers -> 755
find "$LOCAL_DIR" -type f -exec chmod 644 {} \;  # Fichiers -> 644
echo -e "${GREEN}✅ Permissions locales appliquées avec succès !${NC}"

# Déployer via FTP
echo -e "${GREEN}🚀 Déploiement vers O2Switch...${NC}"
lftp -c "
set ftp:ssl-allow no;  # Désactive SSL (si possible)
set ssl:verify-certificate no;  # Ignore la vérification du certificat
open ftp://$FTP_USERNAME:$FTP_PASSWORD@$FTP_SERVER
mirror -R --parallel=4 --delete --no-perms --exclude .htaccess $LOCAL_DIR /front/.
chmod 755 /front/ /front/assets/ 
chmod 644 /front/index.html /front/50x.html /front/favicon.ico
cd /front/assets/
cls -1 > deploy-files/file_list.txt
bye
"

# Générer dynamiquement les commandes chmod
echo -e "${GREEN}📝 Génération des commandes chmod pour /front/assets/...${NC}"
chmod_commands=$(lftp -c "
set ftp:ssl-allow no;
set ssl:verify-certificate no;
open ftp://$FTP_USERNAME:$FTP_PASSWORD@$FTP_SERVER
cd /front/assets/
cls -1
bye
" | awk '{print "chmod 644 /front/assets/" $0}' )

# Exécuter les commandes chmod générées
echo -e "${GREEN}🔧 Application des permissions aux fichiers dans assets/...${NC}"
lftp -c "
set ftp:ssl-allow no;
set ssl:verify-certificate no;
open ftp://$FTP_USERNAME:$FTP_PASSWORD@$FTP_SERVER
$chmod_commands
bye
"

# Nettoyage des fichiers temporaires
echo -e "${GREEN}🧹 Nettoyage des fichiers générés...${NC}"
rm -f deploy-files/file_list.txt

# Nettoyage après le déploiement
echo -e "${GREEN}🧹 Nettoyage...${NC}"
rm -rf $LOCAL_DIR
docker compose -f $DOCKER_COMPOSE_FILE down --remove-orphans >> $LOG_FILE 2>&1

echo -e "${GREEN}✅ Déploiement terminé avec succès !${NC}"

