import { http } from './http-common.js'
import authHeader from './auth-header.js'

class UserService {
    check(user) {
        return http.get('check-auth/' + user, {
            headers: authHeader()
        }).then(response => {
            return response.data
        })
    }
}

export default new UserService()