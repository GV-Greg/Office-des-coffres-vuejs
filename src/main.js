import './assets/base.css'
import './assets/style.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { createI18n } from 'vue-i18n'
import messages from '@intlify/unplugin-vue-i18n/messages'
import { createNotivue } from 'notivue'
import VueCookieComply from '@ipaat/vue3-tailwind3-cookie-comply'

import 'notivue/notifications.css'
import 'notivue/animations.css'

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
  RiSunFill
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
  RiSunFill
)

const i18n = createI18n({
  legacy: false,
  locale: 'fr',
  fallbackLocale: 'fr',
  messages
})

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)
app.component('VueCookieComply', VueCookieComply)
app.component('v-icon', OhVueIcon)

app.use(
  createNotivue({
    position: 'top-right',
    limit: 4,
    enqueue: true,
    notifications: {
      global: {
        duration: 3000
      }
    }
  })
)

app.mount('#app')
