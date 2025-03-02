<script setup>
/*
  imports
*/
  import { reactive } from 'vue'
  import { RouterLink, useRouter } from 'vue-router'
  import InputText from "@/components/forms/InputText.vue"
  import InputEmail from "@/components/forms/InputEmail.vue"
  import InputPassword from "@/components/forms/InputPassword.vue"
  import InputConfirm from "@/components/forms/InputConfirm.vue"
  import DefaultSubmitButton from "@/components/buttons/DefaultSubmitButton.vue"
  import validation from '@/directives/validation'
  import { useAuthStore } from "@/stores/authStore"
  import { push } from 'notivue'

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
            push.error(error.response.data.message)
          })
    }
  }
</script>

<template>
  <div class="page-container">
    <h1 >Office des coffres</h1>
    <div class="page-content grid grid-cols-3 gap-0 justify-items-center">
      <div class="w-full col-start-2 col-span-1">
          <!-- Bouton retour -->
          <div class="w-full flex justify-center">
            <div class="w-6/12 mb-1 grid grid-cols-1 text-center text-white text-3xl font-black hover:text-gray-800 transform hover:translate-y-px hover:translate-x-px shadow-inner">
              <RouterLink to="/login" class="pb-2.5 pt-1.5 font-bold bg-gradient-to-br from-red-600 to-orange-400 rounded-xl">
                <v-icon name="fa-arrow-alt-circle-left" scale="2" class="mb-1" />
                <span class="ml-2">Retour</span>
              </RouterLink>
            </div>
          </div>

        <div class="w-12/12 my-5 bg-gray-200 flex flex-col items-center justify-center border-2 border-gray-300 border-dashed rounded-xl">
          <div class="w-full mt-2 md:mt-5 px-7 overflow-y-auto">
            <h2>Cr&eacute;ation votre compte</h2>
            <form class="mt-6" v-on:submit.prevent="register">
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
  </div>
</template>