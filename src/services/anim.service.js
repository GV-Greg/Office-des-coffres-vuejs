import { http } from './http-common.js'

class AnimService {
    gridRewards(grid) {
        return http.get('anim-public/grid-rewards/show/' + grid)
            .then(response => {
            return response.data
        })
    }

    activityDecode(name) {
        return http.get('anim-public/decode/show/' + name)
            .then(response => {
            return response.data
        })
    }

    raceChicks(race) {
        return http.get('anim-public/race-chicks/show/' + race)
            .then(response => {
            return response.data
        })
    }
}

export default new AnimService()