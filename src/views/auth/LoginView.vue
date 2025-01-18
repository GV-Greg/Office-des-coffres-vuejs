<script setup>
/*
  imports
*/
  import { reactive } from 'vue'
  import { RouterLink, useRouter } from 'vue-router'
  import InputText from '../../components/forms/InputText.vue'
  import InputPassword from '../../components/forms/InputPassword.vue'
  import DefaultSubmitButton from '../../components/buttons/DefaultSubmitButton.vue'
  import { useAuthStore } from '../../stores/authStore'
  import validation from '../../modules/SubmitValidator'
  import Toast from '../../directives/toast'

/*
  form data
*/
  let user = reactive({
    username: '',
    password: '',
  })

  const is_validated = localStorage.getItem('auth_is_validated');
  const error_message = reactive({
    value: ''
  })
/*
  submit form
*/
  const router = useRouter()
  const authStore = useAuthStore()

  const connect = () => {
    if(validation(!user.username || !user.password, "Vous n'avez pas rempli les champs requis !")) {
    } else if(validation(user.username.length > 190, "Le pseudo doit contenir - de 190 caractères !")) {
    } else if(validation(user.password.length < 8, "Le mot de passe doit contenir + de 8 caractères !")) {
    } else if(validation(user.password.length > 190, "Le mot de passe doit contenir - de 190 caractères !")) {
    } else {
      authStore.login(user)
          .then(() => {
            router.push('/app/')
          })
          .catch(error => {
            error_message.value = error.response.data.message
            Toast(350, 'error', 'top-right', error.response.data.message)
          })
    }
  }
</script>

<template>
  <div class="page-container">
    <h1 class="page-title">Office des coffres</h1>
    
    <div class="page-content grid grid-cols-3 gap-0 justify-items-center">
      <div class="col-start-2 col-span-1">
        <!-- Bouton d'entrée sans compte -->
        <div class="w-full mb-4">
          <RouterLink to="/app/" class="btn btn-primary block">
            Entrez sans compte
          </RouterLink>
        </div>

        <!-- Formulaire de connexion -->
        <div class="form-container">
          <h2>Connectez-vous</h2>
          <form class="mt-6" @submit.prevent="connect">
            <div class="form-group">
              <InputText 
                v-model="user.username" 
                name="username" 
                label="pseudo" 
                placeholder="Entrez votre pseudo" 
              />
            </div>
            <div class="form-group">
              <InputPassword 
                v-model="user.password" 
                name="password" 
                label="mot de passe" 
                placeholder="Entrez votre mot de passe" 
              />
            </div>
            <DefaultSubmitButton text="Se connecter" />
          </form>

          <!-- Lien d'inscription -->
          <div class="mt-6 text-center">
            <p class="text-gray-500">
              Vous n'avez pas de compte ?
            </p>
            <RouterLink 
              to="/register" 
              class="btn btn-link mt-2 laptop:mt-0"
            >
              Enregistrez-vous!
            </RouterLink>
          </div>
        </div>
      </div>

      <!-- Message de validation -->
      <div 
        v-show="is_validated === 'false' || error_message.value === 'Compte non validé'"
        class="col-start-3 col-span-1 card bg-red-500/80 p-6"
      >
        <div class="text-xl text-white text-justify">
          Si vous venez de vous enregistrer, contactez-moi dans le jeu via mon profil "Artifice" en me demandant de valider votre compte.
          Une fois validé, vous pourrez vous connecter sur votre compte.
        </div>
      </div>
    </div>
  </div>
</template>