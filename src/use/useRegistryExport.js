import { useI18n } from 'vue-i18n'
import { push } from 'notivue'
import { useAuthStore } from '@/stores/authStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { suggestCategory, orderCategoryKeys, CATEGORY_KEYS, CATEGORY_LABELS_FR } from '@/modules/inventoryCategories'
import { exportInventoryToBBCode, EXPORT_DEFAULT_COLOR } from '@/modules/inventoryBBcode'
import { exportBalanceToBBCode } from '@/modules/inventoryBalanceBBcode'
import { fetchItemIcons } from '@/use/itemIconsApi'

/*
  Les exports BBCode du Registre des stocks (PR 3b) : une inscription, un bilan de mandat, la comparaison libre. Mêmes règles que le Bilan et La
  Balance : les CATÉGORIES sont celles du niveau (ville ou province, `store.doc(level)`), les OPTIONS d'export (format des quantités, trésor, cadre,
  icônes) sont celles du joueur (niveau personnel) ; le contenu forum est en français fixe. Rien n'est enregistré ni gardé : le BBCode part au
  presse-papiers. Les icônes ne se demandent à l'Office qu'au moment d'exporter, connecté seulement ; une panne ne bloque pas l'export.
*/
export default function useRegistryExport() {
  const { t } = useI18n()
  const store = useInventoryStore()
  const authStore = useAuthStore()

  /** Les réglages du niveau (catégories) et du joueur (options) — chargés à la demande, une fois. */
  async function settings(level) {
    if (store.serverMode) {
      await store.load('personal')
      if (level !== 'personal') await store.load(level)
    }
    const doc = store.doc(level)
    const personal = store.doc('personal')
    const customCatsList = doc.custom ?? []
    const hidden = new Set(doc.hiddenBuiltIn ?? [])
    return {
      customCats: doc.itemCategories,
      categoryKeys: orderCategoryKeys([...CATEGORY_KEYS.filter(k => !hidden.has(k)), ...customCatsList.map(c => c.key)], doc.order),
      // Libellé FR fixe pour le BBCode forum (indépendant de la langue de l'interface)
      getCategoryLabel: key => customCatsList.find(c => c.key === key)?.fr ?? CATEGORY_LABELS_FR[key] ?? key,
      options: {
        qtyFormat: personal.exportQtyFormat,
        showEcus: personal.exportShowEcus,
        wrapper: personal.exportWrapper,
        color: (authStore.isLoggedIn ? doc.exportColor : undefined) ?? EXPORT_DEFAULT_COLOR,
      },
      wantsIcons: store.serverMode && personal.exportShowIcons,
    }
  }

  async function iconsFor(wanted, names) {
    if (!wanted) return {}
    try {
      return await fetchItemIcons(names)
    } catch {
      push.warning(t('EconomyInventory.Icons.Unavailable'))
      return {}
    }
  }

  /** Le BBCode d'une inscription : le même que celui du Bilan des stocks. `inventory` = { totalEcus, items } (déjà lu et fusionné), `raw` = le collage inscrit. */
  async function inscriptionBBcode(level, inventory, raw) {
    const s = await settings(level)
    const icons = await iconsFor(s.wantsIcons, inventory.items.map(item => item.name))
    return exportInventoryToBBCode(inventory.items, name => suggestCategory(name, s.customCats), {
      categoryKeys: s.categoryKeys,
      getCategoryLabel: s.getCategoryLabel,
      options: { ...s.options, totalEcus: inventory.totalEcus, icons },
      sources: [raw],
    })
  }

  /** Le BBCode annoté d'une évolution (bilan de mandat, comparaison libre) : le même que celui de La Balance. `result` = compareInventories(...). */
  async function evolutionBBcode(level, result, currentTotalEcus) {
    const s = await settings(level)
    const icons = await iconsFor(s.wantsIcons, [...result.rows, ...result.disappeared].map(item => item.name))
    return exportBalanceToBBCode(result.rows, result.disappeared, name => suggestCategory(name, s.customCats), {
      categoryKeys: s.categoryKeys,
      getCategoryLabel: s.getCategoryLabel,
      options: {
        ...s.options,
        ecus: result.ecus ? { after: result.ecus.after, diff: result.ecus.diff } : null,
        totalEcus: currentTotalEcus,
        icons,
      },
    })
  }

  async function copy(bbcode) {
    try {
      await navigator.clipboard.writeText(bbcode)
      push.success(t('EconomyInventory.CopiedToast'))
    } catch {
      // presse-papiers indisponible (contexte non sécurisé, iframe…) : rien de plus à faire
    }
  }

  return { inscriptionBBcode, evolutionBBcode, copy }
}
