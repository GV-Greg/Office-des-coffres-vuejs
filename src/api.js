import axios from 'axios';

let API_URL = "";
if(import.meta.env.PROD) {
    API_URL = import.meta.env.VITE_API_ENDPOINT_PROD
} else if(import.meta.env.DEV) {
    API_URL = import.meta.env.VITE_API_ENDPOINT_DEV
}

export const http = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
})

// Le panneau d'administration Blade est servi par le même backend que l'API,
// juste sans le préfixe /api/v1 (ex. https://odc-admin.creacube.be/dashboard).
export const ADMIN_ORIGIN = API_URL ? new URL(API_URL).origin : ''