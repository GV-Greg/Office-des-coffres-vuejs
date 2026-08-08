<script setup>
/*
  imports
*/
  import { ref, computed, onMounted } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { http } from '@/api.js'
  import { push } from 'notivue'
  import { translateKingdomName } from '@/modules/kingdomTranslations'

  const { t, locale } = useI18n()

  const props = defineProps({
    modelValue: {
      type: [Number, String],
      default: '',
    },
  })
  const emit = defineEmits(['update:modelValue'])

/*
  données
*/
  const kingdoms = ref([])
  const selectedKingdomId = ref('')
  const selectedProvinceId = ref('')
  const selectedCityId = ref(props.modelValue || '')
  const loadingMap = ref(true)

  const selectedKingdom = computed(() => kingdoms.value.find(k => k.id === Number(selectedKingdomId.value)))
  const provinces = computed(() => selectedKingdom.value?.provinces ?? [])
  const selectedProvince = computed(() => provinces.value.find(p => p.id === Number(selectedProvinceId.value)))
  const cities = computed(() => selectedProvince.value?.cities ?? [])

  const onKingdomChange = () => {
    selectedProvinceId.value = ''
    selectedCityId.value = ''
    emit('update:modelValue', '')
  }
  const onProvinceChange = () => {
    selectedCityId.value = ''
    emit('update:modelValue', '')
  }
  const onCityChange = () => {
    emit('update:modelValue', selectedCityId.value)
  }

/*
  pré-sélectionner royaume/province à partir d'une ville déjà connue (mode édition)
*/
  function preselectFromCityId(cityId) {
    for (const kingdom of kingdoms.value) {
      for (const province of kingdom.provinces) {
        if (province.cities.some(city => city.id === Number(cityId))) {
          selectedKingdomId.value = kingdom.id
          selectedProvinceId.value = province.id
          selectedCityId.value = Number(cityId)
          return
        }
      }
    }
  }

/*
  charger la carte
*/
  onMounted(async () => {
    try {
      const response = await http.get('map')
      kingdoms.value = response.data.kingdoms
      if (props.modelValue) {
        preselectFromCityId(props.modelValue)
      }
    } catch {
      push.error(t('AddCharacter.MapError'))
    } finally {
      loadingMap.value = false
    }
  })
</script>

<template>
  <div v-if="loadingMap" class="text-center text-sm text-gray-300 dark:text-gray-500 my-4">
    {{ t('AddCharacter.LoadingMap') }}
  </div>
  <template v-else>
    <div class="form-group">
      <label class="form-label">{{ t('AddCharacter.KingdomLabel') }} <span class="text-red-500">*</span></label>
      <div class="relative">
        <select v-model="selectedKingdomId" @change="onKingdomChange" class="form-field appearance-none pr-10 w-full" :class="{ 'text-slate-500': !selectedKingdomId, 'border-green-500': selectedKingdomId, 'border-red-300': !selectedKingdomId }">
          <option value="" disabled>{{ t('AddCharacter.KingdomPlaceholder') }}</option>
          <option v-for="kingdom in kingdoms" :key="kingdom.id" :value="kingdom.id">
            {{ translateKingdomName(kingdom.kingdom_name, locale) }}
          </option>
        </select>
        <v-icon name="fa-chevron-down" scale="0.9" class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">{{ t('AddCharacter.ProvinceLabel') }} <span class="text-red-500">*</span></label>
      <div class="relative">
        <select v-model="selectedProvinceId" @change="onProvinceChange" :disabled="!selectedKingdomId" class="form-field appearance-none pr-10 w-full" :class="{ 'text-slate-500': !selectedProvinceId, 'border-green-500': selectedProvinceId, 'border-red-300': !selectedProvinceId }">
          <option value="" disabled>{{ t('AddCharacter.ProvincePlaceholder') }}</option>
          <option v-for="province in provinces" :key="province.id" :value="province.id">
            {{ province.province_name }}
          </option>
        </select>
        <v-icon name="fa-chevron-down" scale="0.9" class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">{{ t('AddCharacter.CityLabel') }} <span class="text-red-500">*</span></label>
      <div class="relative">
        <select v-model="selectedCityId" @change="onCityChange" :disabled="!selectedProvinceId" class="form-field appearance-none pr-10 w-full" :class="{ 'text-slate-500': !selectedCityId, 'border-green-500': selectedCityId, 'border-red-300': !selectedCityId }">
          <option value="" disabled>{{ t('AddCharacter.CityPlaceholder') }}</option>
          <option v-for="city in cities" :key="city.id" :value="city.id">
            {{ city.city_name }}
          </option>
        </select>
        <v-icon name="fa-chevron-down" scale="0.9" class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
      </div>
    </div>
  </template>
</template>
