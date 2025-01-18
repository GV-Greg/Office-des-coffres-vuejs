import { http } from "./http-common.js"
import authHeader from './auth-header.js'

class AuthService {
    register(user) {
        return http.post('register', {
            username: user.username,
            email: user.email,
            password: user.password,
            confirmation: user.confirmation
        }).then(response => {
            if(response.data.success === true) {
                localStorage.setItem('auth_is_validated', 'false');
            }
            return response.data
        })
    }

    login(user) {
        return http.post('login', {
            username: user.username,
            password: user.password
        }).then(response => {
            if(response.data.success === true) {
                localStorage.setItem('auth_username', JSON.stringify(response.data.data.username));
                localStorage.setItem('auth_token', JSON.stringify(response.data.data.token));
                localStorage.removeItem('auth_is_validated');
            }
            return response.data
        })
    }

    logout(user) {
        return http.post('logout', {
            username: user,
        }, {
            headers: authHeader()
        }).then(response => {
            if(response.data.success === true) {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('auth_username');
            }
            return response.data
        })
    }
}

export default new AuthService()