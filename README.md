# Office des Coffres - Frontend

Application web moderne pour la gestion de coffres-forts virtuels, développée avec Vue 3 et Tailwind CSS.

## 🚀 Technologies

- Vue 3 avec Composition API
- Vite pour le bundling
- Tailwind CSS pour le styling
- Pinia pour la gestion d'état
- Axios pour les requêtes HTTP
- Docker pour le développement et la production

## 🛠️ Installation

### Prérequis

- Docker et Docker Compose
- Git

### Configuration

1. Clonez le dépôt :
```bash
git clone https://github.com/GV-Greg/Office-des-coffres-vuejs.git
cd office-des-coffres-vuejs
```

2. Copiez le fichier d'environnement :
```bash
cp .env.example .env
```

3. Configurez les variables d'environnement dans `.env`

## 🔧 Développement

Démarrer l'environnement de développement :
```bash
docker compose up
```
L'application sera disponible sur `http://localhost:5173`

## 🏗️ Production

1. Build de l'image de production :
```bash
docker compose -f docker-compose.prod.yml build
```

2. Démarrer le conteneur de production :
```bash
docker compose -f docker-compose.prod.yml up -d
```
L'application sera disponible sur `http://localhost:80`

## 📦 Déploiement

Pour déployer sur un serveur de production via Git bash :
```bash
./deploy.sh
```

## 🧪 Tests

Les tests sont exécutés dans le conteneur Docker :
```bash
docker compose exec app npm run test
```

## 📚 Documentation

- [Vue 3 Documentation](https://vuejs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Vite](https://vitejs.dev/)
- [Pinia](https://pinia.vuejs.org/)

## 🤝 Contribution

1. Fork le projet
2. Créez votre branche (`git checkout -b feature/AmazingFeature`)
3. Committez vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push sur la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

## 📝 License

[MIT](LICENSE)
