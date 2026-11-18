import axios from 'axios';
import { BYPASS_HEADER, getBypass, isMaintenanceError, reportMaintenance } from '@/use/useMaintenance';

let API_URL = "";
if(import.meta.env.PROD) {
    API_URL = import.meta.env.VITE_API_ENDPOINT_PROD
} else if(import.meta.env.DEV) {
    API_URL = import.meta.env.VITE_API_ENDPOINT_DEV
}

// Délai d'attente borné : axios n'en a aucun par défaut, et une requête sans réponse laissait un
// bouton tourner indéfiniment. Cas réel (29/09/2026) : en prod, la couche d'hébergement retient
// les réponses 429 du limiteur Laravel sans jamais les rendre. Au-delà du délai, l'appelant
// reçoit une erreur sans `response` et affiche son message réseau habituel.
export const HTTP_TIMEOUT_MS = 20000

export const http = axios.create({
    baseURL: API_URL,
    timeout: HTTP_TIMEOUT_MS,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
})

// Mode maintenance (use/useMaintenance.js) : l'API répond 503 `maintenance` à tout appel quand
// l'Office est fermé. Le site affiche alors sa page de maintenance. Un administrateur qui a ouvert
// `/maintenance/<secret>` présente ce secret à chaque appel pour essayer une mise à jour avant la
// réouverture (en-tête, car aucun cookie ne part vers l'API).
http.interceptors.request.use((config) => {
    const secret = getBypass()
    if (secret) config.headers[BYPASS_HEADER] = secret
    return config
})

http.interceptors.response.use(
    (response) => response,
    (error) => {
        if (isMaintenanceError(error)) reportMaintenance(error)
        return Promise.reject(error)
    }
)

// Le panneau d'administration Blade est servi par le même backend que l'API,
// juste sans le préfixe /api/v1 (ex. https://odc-admin.creacube.be/dashboard).
export const ADMIN_ORIGIN = API_URL ? new URL(API_URL).origin : ''