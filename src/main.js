import './assets/base.css'
import './assets/style.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import i18n, { setLocale, DEFAULT_LOCALE } from '@/i18n/index'
import { useCookieStore } from '@/stores/cookieStore'
import { createNotivue } from 'notivue'

// Importez le style de Notivue
import 'notivue/notifications.css' // Style de base
import 'notivue/animations.css'   // Animations (optionnel)

import { OhVueIcon, addIcons } from 'oh-vue-icons'
import {
  BiShieldLockFill,
  GiBroadheadArrow,
  FaArrowAltCircleLeft,
  GiMedievalPavilion,
  GiChest,
  GiSwordsEmblem,
  GiRollingDiceCup,
  GiBarbute,
  GiBugleCall,
  GiAnchor,
  RiHomeGearLine,
  FaPowerOff,
  GiTrophyCup,
  RiLockPasswordFill,
  FaKiwiBird,
  FaReply,
  FaUnlockAlt,
  GiCrownCoin,
  FaUserTag,
  RiMoonFill,
  RiSunFill,
  FaChevronDown,
  FaUserPlus,
  FaCheckCircle,
  FaClock,
  FaMapMarkerAlt,
  FaEdit,
  GiScrollUnfurled,
  GiHammerNails,
  FaChevronLeft,
  FaChevronRight,
  FaInfoCircle,
  FaTimes,
  FaExclamationTriangle,
  FaTrashAlt,
  FaHardHat
} from 'oh-vue-icons/icons'

addIcons(
  BiShieldLockFill,
  GiBroadheadArrow,
  FaArrowAltCircleLeft,
  GiMedievalPavilion,
  GiChest,
  GiSwordsEmblem,
  GiRollingDiceCup,
  GiBarbute,
  GiBugleCall,
  GiAnchor,
  RiHomeGearLine,
  FaPowerOff,
  GiTrophyCup,
  RiLockPasswordFill,
  FaKiwiBird,
  FaReply,
  FaUnlockAlt,
  GiCrownCoin,
  FaUserTag,
  RiMoonFill,
  RiSunFill,
  FaChevronDown,
  FaUserPlus,
  FaCheckCircle,
  FaClock,
  FaMapMarkerAlt,
  FaEdit,
  GiScrollUnfurled,
  GiHammerNails,
  FaChevronLeft,
  FaChevronRight,
  FaInfoCircle,
  FaTimes,
  FaExclamationTriangle,
  FaTrashAlt,
  FaHardHat
)

// Configuration de Notivue
const notivue = createNotivue({
  position: 'top-right',
  limit: 4,
  enqueue: true,
  avoidDuplicates: true,
  notifications: {
    global: {
      duration: 10000
    }
  }
})
const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)
app.component('v-icon', OhVueIcon)

app.use(notivue)

// La locale est chargée AVANT le montage : elle était jusqu'ici appliquée dans un
// `onMounted` de SelectorLanguage, donc après un premier rendu en français — un visiteur
// anglophone voyait la page s'afficher en français puis basculer. Charger ici supprime ce
// flash, qui existait déjà, et empêche celui qu'aurait introduit le chargement à la demande.
//
// Enveloppé plutôt qu'en `await` de premier niveau : la cible de build (es2020) ne supporte
// pas le top-level await, et l'élever changerait la compatibilité navigateur du site pour
// une commodité d'écriture. `finally` garantit que l'application se monte même si le
// chargement des messages échoue — une page affichant ses clés reste préférable à une page
// blanche.
// La langue mémorisée est relue via cookieStore, jamais par un accès direct au stockage :
// c'est la règle du projet (une seule porte d'entrée vers localStorage), tenue par
// tests/enforcement/storage-usage.unit.test.js. `initializeCookies()` est idempotente et
// sera rappelée par App.vue au montage — l'avancer ici ne fait que rendre la préférence
// disponible avant le premier rendu.
const cookieStore = useCookieStore()
cookieStore.initializeCookies()

setLocale(cookieStore.getComfortData('locale', DEFAULT_LOCALE))
  .catch(() => setLocale(DEFAULT_LOCALE))
  .finally(() => app.mount('#app'))
