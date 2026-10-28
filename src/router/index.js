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
  // Ancres seulement (ex. /legal/data#guet, liens de la politique vers chaque outil) : toute autre
  // navigation garde le comportement d'avant, sans défilement imposé.
  scrollBehavior(to) {
    if (to.hash) return { el: to.hash }
  },
  routes: [
    {
      path: '/',
      name: 'welcome',
      component: WelcomeView,
      meta: { public: true },
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      beforeEnter: redirectToHomeIfLoggedIn,
      meta: { public: true },
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterView,
      beforeEnter: redirectToHomeIfLoggedIn,
      meta: { public: true },
    },
    {
      path: '/verify-email',
      name: 'verify-email',
      component: VerifyEmailView,
      meta: { public: true },
    },
    {
      path: '/legal/cookies',
      name: 'legal-cookies',
      component: () => import('@/views/legal/CookiesPolicyView.vue'),
      meta: { public: true },
    },
    {
      path: '/legal/privacy',
      name: 'legal-privacy',
      component: () => import('@/views/legal/PrivacyPolicyView.vue'),
      meta: { public: true },
    },
    {
      // « Vos données, outil par outil » : le détail propre à chaque outil, dont la politique renvoie
      // ici (brief admin/content/brief-pages-donnees-joueur.md).
      path: '/legal/data',
      name: 'legal-data',
      component: () => import('@/views/legal/DataPageView.vue'),
      meta: { public: true },
    },
    {
      path: '/legal/mentions',
      name: 'legal-mentions',
      component: () => import('@/views/legal/MentionsLegalesView.vue'),
      meta: { public: true },
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
        {
          // Registre des mines : lecture (PR 4) — commissaire aux mines, bailli, dirigeant.
          path: 'registre',
          name: 'economy-registry',
          component: () => import('@/views/modules/economy/EconomyRegistry.vue'),
          beforeEnter: redirectToHomeIfNotLoggedIn,
        },
        {
          // Prix des mines par période (lot 2) : historique, ajout et correction. Le serveur dit qui peut quoi.
          path: 'registre/prix',
          name: 'economy-prices',
          component: () => import('@/views/modules/economy/EconomyPrices.vue'),
          beforeEnter: redirectToHomeIfNotLoggedIn,
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
      // Pas de nom ici : le nom `animation` est celui de l'ACCUEIL (enfant au chemin vide), pour que `{ name: 'animation' }` rende la page.
      components: {
        Nav,
        default: () => import('@/views/modules/animation/MainAnimation.vue'),
      },
      children: [
        {
          // Accueil du module : une carte par activité (nom + descriptif). Chaque module aura le même modèle.
          path: '',
          name: 'animation',
          component: () => import('@/views/modules/animation/AnimationHomeView.vue'),
        },
        {
          // Décode le code : l'ENTRÉE des salles (créer, retrouver, reprendre). La page publique d'une activité, elle, est
          // à partager : elle vit sous `/public/` (route `animation-public`, plus bas). Aucun compte requis.
          path: 'decode',
          name: 'animation-decode',
          component: () => import('@/views/modules/animation/DecodeActivityView.vue'),
        },
        {
          // Organiser une activité SANS COMPTE (D2) : formulaire puis écran de confirmation.
          path: 'decode/creer',
          name: 'animation-create',
          component: () => import('@/views/modules/animation/DecodeCreateAnonymousView.vue'),
        },
        {
          // Retrouver SON activité sans compte : adresse + mot de passe (D3, D10).
          path: 'decode/gerer',
          name: 'animation-manage',
          component: () => import('@/views/modules/animation/DecodeManageView.vue'),
        },
        {
          // Choisir un nouveau mot de passe avec le lien à usage unique, reçu par email ou par message en jeu (D35, D36).
          path: 'decode/reinitialiser',
          name: 'animation-reset',
          component: () => import('@/views/modules/animation/DecodeResetView.vue'),
        },
        {
          // Confirmation de l'adresse email par le lien signé reçu à cette adresse (D29).
          path: 'decode/confirmer-email',
          name: 'animation-confirm-email',
          component: () => import('@/views/modules/animation/DecodeEmailConfirmView.vue'),
        },
        {
          // « Ma salle » (joueur connecté, mode privé) : créer, sceller, inscrire les propositions, clore. Le serveur décide de tout.
          path: 'decode/ma-salle',
          name: 'animation-mine',
          component: () => import('@/views/modules/animation/MyDecodeActivities.vue'),
          beforeEnter: redirectToHomeIfNotLoggedIn,
        },
      ],
    },
    {
      // Page à PARTAGER avec la communauté (le lien de l'export BBCode, D8) : `/public/` pour ce qui se partage, `/app/` pour les pages
      // de l'application. Aucun mot réservé (D14) : le slug est le dernier segment. Pas de NavBar, comme les pages légales.
      path: '/public/activite/decode/:slug',
      name: 'animation-public',
      component: () => import('@/views/modules/animation/DecodePublicView.vue'),
      // Page à partager : ni NavBar ni footer commun (le menu de la page porte logo, thème et langue).
      meta: { public: true, noFooter: true },
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
      // « Ma province » : historique des postes de la province de résidence du personnage actif.
      path: '/app/province',
      name: 'province',
      components: {
        Nav,
        default: () => import('@/views/ProvinceView.vue'),
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
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/404.vue'),
      // Publique : une URL cassée peut être atteinte déconnecté, le footer doit y porter
      // "Gérer mes préférences" et la mention "outil non officiel" comme sur les autres
      // pages hors /app/*.
      meta: { public: true },
    },
  ]
})

// Modules "Coffres X" (voir la charte de titres Economy/Security/Animation) — le reste de la
// navigation (Accueil, compte, pages publiques) reste dans le contexte "office".
const CHEST_MODULE_ROUTE_NAMES = new Set([
  'economy', 'economy-mines', 'economy-registry', 'economy-prices',
  'security', 'security-guet',
  'animation', 'animation-decode', 'animation-public', 'animation-mine', 'animation-create', 'animation-manage', 'animation-reset', 'animation-confirm-email',
])

// Couleur du module (charte §3.3) : la porte de l'overlay et le coffre de la page la reprennent.
const MODULE_ACCENT_BY_ROUTE = {
  economy: 'gold', 'economy-mines': 'gold', 'economy-registry': 'gold', 'economy-prices': 'gold',
  security: 'rose', 'security-guet': 'rose',
  animation: 'teal', 'animation-decode': 'teal', 'animation-public': 'teal', 'animation-mine': 'teal', 'animation-create': 'teal', 'animation-manage': 'teal', 'animation-reset': 'teal', 'animation-confirm-email': 'teal',
}

const { startNavigationLoading, stopNavigationLoading } = useNavigationLoading()

router.beforeEach((to, from, next) => {
  startNavigationLoading(CHEST_MODULE_ROUTE_NAMES.has(to.name) ? 'chest' : 'office', { accent: MODULE_ACCENT_BY_ROUTE[to.name] ?? 'office' })
  next()
})

router.afterEach(() => {
  stopNavigationLoading()
})

router.onError(() => {
  stopNavigationLoading()
})

export default router
