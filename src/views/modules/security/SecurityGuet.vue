<script setup >
/*
  imports
*/
  import { ref, reactive } from "vue";

/*
  datas
*/
  const loading = reactive({
    value: false
  })
  const list_yesterday = ref()
  const list_today = ref()
  const array_today = reactive({
    value: []
  })
  const outputs = reactive({
    value: []
  })
  const inputs = reactive({
    value: []
  })
  const result_press_papier = reactive({
    value: ""
  })

/* result */
  function transform(list) {
    let list_array = list._rawValue.split("\n")
    let list_pseudos = []
    for (let el in list_array) {
      let pseudo_temp = list_array[el].split("\t", 1)
      let pseudo = pseudo_temp[0].split(" ", 1)
      if(pseudo[0].length > 0) {
        list_pseudos.push(pseudo[0])
      }
    }
    return list_pseudos
  }

  function result() {
    let array_yesterday = transform(list_yesterday)
    array_today.value = transform(list_today)
    outputs.value = array_yesterday.filter(x => !array_today.value.includes(x))
    inputs.value = array_today.value.filter(x => !array_yesterday.includes(x))
    loading.value = true
  }

  function to_export() {
    result_press_papier.value = "[size=15][color=blue][i]Liste des villageois (" + (array_today.value.length) + ")[/i][/color][/size][quote]"
    for (let index in array_today.value) {
      index ==='0' ? 
        result_press_papier.value += "[url=https://www.lesroyaumes.com/FichePersonnage.php?login=" + array_today.value[index] + "]" + array_today.value[index] + "[/url]" :
        result_press_papier.value += "\n[url=https://www.lesroyaumes.com/FichePersonnage.php?login=" + array_today.value[index] + "]" + array_today.value[index] + "[/url]"
    }
    result_press_papier.value += "[/quote]\n"
    result_press_papier.value += "[size=15][color=blue][i]Entrées (" + inputs.value.length + ")[/i][/color][/size]\n[quote]"
    for (let input in inputs.value) {
      input ==='0' ? result_press_papier.value += "[char]" + inputs.value[input] + "[/char]" : result_press_papier.value += "\n[char]" + inputs.value[input] + "[/char]"
    }
    result_press_papier.value += "[/quote]\n[size=15][color=blue][i]Sorties (" + outputs.value.length + ")[/i][/color][/size]\n[quote]"
    for (let output in outputs.value) {
      output ==='0' ? result_press_papier.value += "[char]" + outputs.value[output] + "[/char]" : result_press_papier.value += "\n[char]" + outputs.value[output] + "[/char]"
    }
    result_press_papier.value += "[/quote]"
    navigator.clipboard.writeText(result_press_papier.value)
  }
</script>

<template>
  <div class="w-full grid grid-cols-3 gap-4">
    <div>
      <label class="w-full font-bold text-center">Liste des villageois d'hier :</label>
      <textarea v-model="list_yesterday" rows="18" class="textarea-autoresize w-full rounded-xl p-2"></textarea>
    </div>
    <div>
      <label class="w-full font-bold text-center">Liste des villageois d'aujourd'hui :</label>
      <textarea v-model="list_today" rows="18" class="textarea-autoresize w-full rounded-xl p-2"></textarea>
    </div>
    <div class="flex flex-col items-center justify-start mt-7">
      <button @click="result" class="h-12 btn btn-create">G&eacute;n&eacute;rer les entr&eacute;es/sorties</button>
      <div v-if="loading.value" class="w-full mt-2">
        <div class="font-bold text-center">
          Entr&eacute;es <span class="bg-blue-400 rounded-2xl px-1.5 pb-0.5 font-bold text-gray-200">{{ inputs.value.length }}</span> :
        </div>
        <div class="flex flex-wrap max-h-36 overflow-y-scroll">
          <div v-for="(input, index) in inputs.value" :key="index" class="mx-1 my-2">
            <a class="py-1 px-2 bg-blue-400 hover:bg-blue-600 hover:text-gray-200 rounded-xl"
               :href="'https://www.renaissancekingdoms.com/FichePersonnage.php?login=' + input"
               target="_blank" rel="noopener noreferrer">
              <v-icon name="fa-user-tag" scale="1"/>
              {{ input }}
            </a>
          </div>
        </div>
      </div>
      <div v-if="loading.value" class="mt-2">
        <div class="font-bold text-center">
          Sorties <span class="bg-blue-400 rounded-2xl px-1.5 pb-0.5 font-bold text-gray-200">{{ outputs.value.length }}</span> :
        </div>
        <div class="flex flex-wrap max-h-36 overflow-y-scroll">
          <div v-for="(output, index) in outputs.value" :key="index" class="mx-1 my-2">
            <a class="py-1 px-2 bg-blue-400 hover:bg-blue-600 hover:text-gray-200 rounded-xl"
                :href="'https://www.renaissancekingdoms.com/FichePersonnage.php?login=' + output"
                target="_blank" rel="noopener noreferrer">
              <v-icon name="fa-user-tag" scale="1"/>
              {{ output }}
            </a>
          </div>
        </div>
      </div>
      <button v-if="loading.value" @click="to_export" class="h-12 btn btn-primary mt-3">Exporter</button>
    </div>
  </div>
</template>

<style scoped>
  .invisible {
    display: none;
  }
</style>