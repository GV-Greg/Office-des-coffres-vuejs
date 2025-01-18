<script setup>
/*
  imports
*/
  import { reactive } from 'vue'
  import { RouterLink, useRouter } from 'vue-router'
  import InputText from "../../components/forms/InputText.vue"
  import InputEmail from "../../components/forms/InputEmail.vue"
  import InputPassword from "../../components/forms/InputPassword.vue"
  import InputConfirm from "../../components/forms/InputConfirm.vue"
  import DefaultSubmitButton from "../../components/buttons/DefaultSubmitButton.vue"
  import validation from "../../modules/SubmitValidator";
  import { useAuthStore } from "../../stores/authStore";
  import Toast from "../../directives/toast";

/*
  form data
*/
  let user = reactive({
    username: "",
    email: "",
    password: "",
    confirmation: "",
  })

/*
  submit form
*/
  const router = useRouter()
  const authStore = useAuthStore()

  const register = async () => {
    if(validation(!user.username || !user.email || !user.password || !user.confirmation, "Vous n'avez pas rempli les champs requis !")) {
    } else if(validation(user.username.length > 190, "Le pseudo doit contenir - de 190 caractères !")) {
    } else if(validation(user.email.length > 190, "L'email doit contenir - de 190 caractères !")) {
    } else if(validation(user.password.length < 8, "Le mot de passe doit contenir + de 8 caractères !")) {
    } else if(validation(user.password.length > 190, "Le mot de passe doit contenir - de 190 caractères !")) {
    } else if(validation(user.password !== user.confirmation, "La confirmation du mot de passe n'est pas identique à celui-ci !")) {
    } else {
      authStore.register(user)
          .then(() => {
            router.push('/login/')
          })
          .catch(error => {
            Toast(400,'error', 'top-right', error.response.data.message)
          })
    }
  }
</script>

<template>
  <div class="mx-0 w-full tablet:w-1/3 flex flex-col text-white">
    <h1 class="mb-0 text-4xl laptop:text-5xl text-center text-transparent bg-clip-text bg-gradient-to-br from-orange-400 to-red-600">
      Office des coffres
    </h1>
    <div class="flex flex-col items-center">
      <div class="w-1/3 px-3 grid grid-cols-1 justify-items-center text-white text-2xl font-bold hover:text-gray-800 transform hover:translate-y-px hover:translate-x-px shadow-md">
        <RouterLink to="/login" class="w-full flex justify-center items-center pb-2.5 pt-2 text-center font-bold bg-gradient-to-br from-red-600 to-orange-400 rounded-md align-middle">
          <v-icon name="fa-arrow-alt-circle-left" scale="2" />
          <span class="ml-2 mb-0.5">Retour</span>
        </RouterLink>
      </div>
      <div class="w-11/12 laptop:w-12/12 my-2 pb-2 bg-gray-200 flex flex-col items-center justify-center border-2 border-gray-300 border-dashed rounded-xl">
        <div class="w-full mt-2 md:mt-3 px-7 overflow-y-auto">
          <h2>Cr&eacute;ation votre compte</h2>
          <form class="mb-2" v-on:submit.prevent="register">
            <InputText v-model="user.username" name="username" label="pseudo" placeholder="Entrez votre pseudo" />
            <InputEmail v-model="user.email" name="email" label="email" placeholder="Entrez votre email" />
            <InputPassword v-model="user.password" name="password" label="mot de passe" placeholder="Entrez votre mot de passe"/>
            <InputConfirm v-model="user.confirmation" confirmField="password" :confirmValue="user.password"
                          name="confirmation" label="confirmation mot de passe" placeholder="Confirmez votre mot de passe"/>
            <DefaultSubmitButton text="S'enregistrer" />
          </form>
        </div>
      </div>
    </div>
  </div>
</template>