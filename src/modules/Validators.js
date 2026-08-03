import i18n from '../i18n/index'
const { t } = i18n.global

export default function useValidators() {
    const isRequired = (fieldName, fieldValue) => {
        return !fieldValue ? t('Validation.Required', { field: t(fieldName) }) : ""
    }

    const minLength = (fieldName, fieldValue, min) => {
        return fieldValue.length < min ? t('Validation.MinLength', { field: t(fieldName), min }) : ""
    }

    const maxLength = (fieldName, fieldValue, max) => {
        return fieldValue.length > max ? t('Validation.MaxLength', { field: t(fieldName), max }) : "";
    }

    const isEmail = (fieldValue) => {
        let re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        return !re.test(fieldValue) ? t('Validation.InvalidEmail') : ""
    }

    const isConfirmed = (fieldValue, confirmField, confirmValue) => {
        return fieldValue !== confirmValue ? t('Validation.NotConfirmed', { field: t(confirmField) }) : ""
    }

    return { isRequired, minLength, maxLength, isEmail, isConfirmed }
}