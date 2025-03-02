import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from "@/stores/authStore"
import WelcomeView from '@/views/WelcomeView.vue'
import LoginView from '@/views/auth/LoginView.vue'
import RegisterView from '@/views/auth/RegisterView.vue'
import SecurityGuetView from '@/views/modules/security/SecurityGuet.vue'
import { push } from 'notivue'

const redirectToHomeIfNotLoggedIn = (to, from, next) => {
  if (!useAuthStore().getIsLoggedIn) {
      push.error("Accès non autorisé")
      next({ name: "login" })
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
      meta: { layout: "loggedIn" },
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterView,
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
      components: {
        Nav,
        default: () => import('@/views/modules/economy/MainEconomy.vue'),
      },
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
      path: "/:pathMatch(.*)*",
      component: () => import("@/views/404.vue"),
  },
  ]
})

export default router
