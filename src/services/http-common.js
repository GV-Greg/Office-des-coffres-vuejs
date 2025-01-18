import axios from 'axios'

let API_URL = "";
if(import.meta.env.PROD) {
    API_URL = "https://odc-admin.creacube.be/api/"
} else if(import.meta.env.DEV) {
    API_URL = "http://odc.local/odc-api-back/public/api/"
}

export const http = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
})