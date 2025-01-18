import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from "../stores/authStore"
import WelcomeView from '../views/WelcomeView.vue'
import LoginView from '../views/auth/LoginView.vue'
import RegisterView from '../views/auth/RegisterView.vue'
import FestivalHomeView from '../views/modules/festival/FestivalHome.vue'
import FestivalGridView from '../views/modules/festival/FestivalGrid.vue'
import FestivalDecodeView from '../views/modules/festival/FestivalDecode.vue'
import FestivalRaceView from '../views/modules/festival/FestivalRaceChicks.vue'
import SecurityGuetView from '../views/modules/security/SecurityGuet.vue'
import Toast from "../directives/toast"

const redirectToHomeIfNotLoggedIn = (to, from, next) => {
  if (!useAuthStore().getIsLoggedIn) {
      Toast(350,'error', 'top-right', "Accès non autorisé")
      next({ name: "login" })
  } else {
      next()
  }
};

// lazy-loaded
const Nav = () => import('../components/NavBar.vue')

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
        default: () => import('../views/HomeView.vue')
      },
    },
    {
      path: '/app/eco',
      name: 'economy',
      components: {
        Nav,
        default: () => import('../views/modules/economy/MainEconomy.vue'),
      },
    },
    {
      path: '/app/secu',
      name: 'security',
      components: {
        Nav,
        default: () => import('../views/modules/security/MainSecurity.vue'),
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
        default: () => import('../views/modules/company/MainCompany.vue'),
      },
    },
    {
      path: '/app/festival',
      name: 'festival',
      components: {
        Nav,
        default: () => import('../views/modules/festival/MainFestival.vue'),
      },
      children: [
        {
          path: '',
          name: 'festival-home',
          component: FestivalHomeView,
        },
        {
          path: 'grid',
          name: 'festival-grid',
          component: FestivalGridView,
        },
        {
          path: 'decode',
          name: 'festival-decode',
          component: FestivalDecodeView,
        },
        {
          path: 'race-chicks',
          name: 'festival-race-chicks',
          component: FestivalRaceView,
        }
      ]
    },
    {
      path: '/app/profil',
      name: 'profil',
      components: {
        Nav,
        default: () => import('../views/auth/ProfilView.vue'),
      },
      beforeEnter: redirectToHomeIfNotLoggedIn,
    },
    {
      path: "/:pathMatch(.*)*",
      component: () => import("../views/404.vue"),
  },
  ]
})

export default router
