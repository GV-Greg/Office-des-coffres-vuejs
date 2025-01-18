import { reactive } from "vue"
import useValidators from "../modules/Validators.js"

const errors = reactive({})
const { isRequired, minLength, maxLength, isEmail, isConfirmed } = useValidators()

export default function useFormValidation() {
    const validateMinField = (fieldName, fieldValue, minSize) => {
        errors[fieldName] = !fieldValue ? isRequired(fieldName, fieldValue) : minLength(fieldName, fieldValue, minSize)
    }
    const validateMaxField = (fieldName, fieldValue, maxSize) => {
        errors[fieldName] = !fieldValue ? isRequired(fieldName, fieldValue) : maxLength(fieldName, fieldValue, maxSize)
    }
    const validateMinMaxField = (fieldName, fieldValue, minSize, maxSize) => {
        errors[fieldName] = fieldValue === '' ? isRequired(fieldName, fieldValue) : minLength(fieldName, fieldValue, minSize) || maxLength(fieldName, fieldValue, maxSize)
    }
    const validateEmailField = (fieldName, fieldValue, maxSize) => {
        errors[fieldName] = fieldValue === '' ? isRequired(fieldName, fieldValue) : isEmail(fieldName, fieldValue) || maxLength(fieldName, fieldValue, maxSize)
    }
    const validateConfirmField = (fieldName, fieldValue, confirmField, confirmValue) => {
        errors[fieldName] = fieldValue === '' ? isRequired(fieldName, fieldValue) : isConfirmed(fieldName, fieldValue, confirmField, confirmValue)
    }

    return { errors, validateMinField, validateMaxField, validateMinMaxField, validateEmailField, validateConfirmField }
}