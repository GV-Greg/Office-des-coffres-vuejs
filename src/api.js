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