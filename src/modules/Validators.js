import i18n from '../i18n/index'
const { t } = i18n.global

export default function useValidators() {
    const isRequired = (fieldName, fieldValue) => {
        return !fieldValue ? 'Le champ "' + t(fieldName) + '" est requis' : ""
    }

    const minLength = (fieldName, fieldValue, min) => {
        return fieldValue.length < min ? "Le " + t(fieldName) + " doit être composé de + " + min + " caractères." : ""
    }

    const maxLength = (fieldName, fieldValue, max) => {
        return fieldValue.length > max ? "Le " + t(fieldName) + " doit être composé de - " + max + " caractères." : "";
    }

    const isEmail = (fieldValue) => {
        let re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        return !re.test(fieldValue) ? "Un email valide est requis" : ""
    }

    const isConfirmed = (fieldValue, confirmField, confirmValue) => {
        return fieldValue !== confirmValue ? "n'est pas identique à " + t(confirmField) : ""
    }

    return { isRequired, minLength, maxLength, isEmail, isConfirmed }
}