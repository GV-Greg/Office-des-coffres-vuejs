import Toast from '../directives/toast'

export default function validation(test, title) {
    if(test === true) {
        Toast(500, 'error', 'top', title)
        return true
    }
    return false
}