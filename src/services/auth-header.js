export default function authHeader() {
    let token = JSON.parse(localStorage.getItem('auth_token'));
    if(token) {
        return {
            Authorization: 'Bearer ' + token
        };
    } else {
        return {};
    }
}