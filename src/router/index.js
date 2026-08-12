import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from "@/stores/authStore"
import WelcomeView from '@/views/WelcomeView.vue'
import LoginView from '@/views/auth/LoginView.vue'
import RegisterView from '@/views/auth/RegisterView.vue'
import VerifyEmailView from '@/views/auth/VerifyEmailView.vue'
import SecurityGuetView from '@/views/modules/security/SecurityGuet.vue'
import { push } from 'notivue'
import useNavigationLoading from '@/use/useNavigationLoading'

export const redirectToHomeIfNotLoggedIn = async (to, from, next) => {
  const authStore = useAuthStore()

  if (!authStore.isLoggedIn) {
    push.error("Accès non autorisé")
    next({ name: "login" })
    return
  }

  // Le token peut être présent en local mais invalide côté serveur (session
  // expirée, compte supprimé) : on vérifie réellement avant de laisser passer.
  const stillValid = await authStore.checkAuth()
  if (!stillValid) {
    push.error("Accès non autorisé")
    next({ name: "login" })
  } else {
    next()
  }
};

// Inverse : un compte déjà connecté qui atterrit sur /login ou /register n'a rien à y faire,
// redirigé directement vers l'app. Pas de push.error ici (ce n'est pas un refus d'accès).
export const redirectToHomeIfLoggedIn = async (to, from, next) => {
  const authStore = useAuthStore()

  if (!authStore.isLoggedIn) {
    next()
    return
  }

  const stillValid = await authStore.checkAuth()
  if (stillValid) {
    next({ name: "home" })
  } else {
    next()
  }
};

// lazy-loaded
const Nav = () => import('@/components/NavBar.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'welcome',
      component: WelcomeView,
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      beforeEnter: redirectToHomeIfLoggedIn,
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterView,
      beforeEnter: redirectToHomeIfLoggedIn,
    },
    {
      path: '/verify-email',
      name: 'verify-email',
      component: VerifyEmailView,
    },
    {
      path: '/app/',
      name: 'home',
      components: {
        Nav,
        default: () => import('@/views/HomeView.vue')
      },
    },
    {
      path: '/app/eco',
      name: 'economy',
      redirect: { name: 'economy-mines' },
      components: {
        Nav,
        default: () => import('@/views/modules/economy/MainEconomy.vue'),
      },
      children: [
        {
          path: 'mines',
          name: 'economy-mines',
          component: () => import('@/views/modules/economy/EconomyMines.vue'),
        },
      ],
    },
    {
      path: '/app/secu',
      name: 'security',
      components: {
        Nav,
        default: () => import('@/views/modules/security/MainSecurity.vue'),
      },
      children: [
        {
          path: 'guet',
          name: 'security-guet',
          component: SecurityGuetView,
        },
      ]
    },
    {
      path: '/app/company',
      name: 'company',
      components: {
        Nav,
        default: () => import('@/views/modules/company/MainCompany.vue'),
      },
    },
    {
      path: '/app/anim',
      name: 'animation',
      components: {
        Nav,
        default: () => import('@/views/modules/animation/MainAnimation.vue'),
      },
    },
    {
      path: '/app/profil',
      name: 'profil',
      components: {
        Nav,
        default: () => import('@/views/auth/ProfilView.vue'),
      },
      beforeEnter: redirectToHomeIfNotLoggedIn,
    },
    {
      path: '/app/character/new',
      name: 'character-new',
      component: () => import('@/views/auth/AddCharacterView.vue'),
      beforeEnter: redirectToHomeIfNotLoggedIn,
    },
    {
      path: "/:pathMatch(.*)*",
      component: () => import("@/views/404.vue"),
  },
  ]
})

// Modules "Coffres X" (voir la charte de titres Economy/Security/Animation) — le reste de la
// navigation (Accueil, compte, pages publiques) reste dans le contexte "office".
const CHEST_MODULE_ROUTE_NAMES = new Set([
  'economy', 'economy-mines',
  'security', 'security-guet',
  'animation',
])

const { startNavigationLoading, stopNavigationLoading } = useNavigationLoading()

router.beforeEach((to, from, next) => {
  startNavigationLoading(CHEST_MODULE_ROUTE_NAMES.has(to.name) ? 'chest' : 'office')
  next()
})

router.afterEach(() => {
  stopNavigationLoading()
})

router.onError(() => {
  stopNavigationLoading()
})

export default router
