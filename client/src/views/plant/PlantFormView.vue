<script setup>
import Loading from '@/components/Loading.vue'
// PlantFormView: the page around the plant form, used by TWO routes:
//   /plants/new           -> add a plant (no plantId)
//   /plants/:plantId/edit -> edit a plant (plantId from the URL)
// The form itself is the PlantForm component; this page loads the plant
// (when editing) and decides where to go after saving.
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import PlantForm from '@/components/plant/PlantForm.vue'
import { usePlantsStore } from '@/stores/plants'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const { show: toast } = useToast()

// route.params.plantId comes from ":plantId" in the route (undefined on /plants/new)
const plantId = computed(() => route.params.plantId)
const isEdit = computed(() => !!plantId.value) // !! turns it into true/false
// Editing returns to the plant's own page; adding returns to the list.
const backTo = computed(() => (isEdit.value ? `/plants/${plantId.value}` : '/plants'))

const plantsStore = usePlantsStore()
// The plant being edited, taken from the store (null when adding a new one)
const plant = computed(() => (isEdit.value ? (plantsStore.findPlant(plantId.value) ?? null) : null))
// Start in "loading" when editing so the empty form never flashes up first
const loading = ref(isEdit.value)
const loadError = ref('')

async function load() {
  if (!isEdit.value) return
  try {
    await plantsStore.fetchPlant(plantId.value)
  } catch (err) {
    loadError.value = err.message
  } finally {
    loading.value = false
  }
}
// App.vue's <RouterView :key="route.path"> rebuilds this page when the URL
// changes (e.g. edit -> add), so loading once on mount is enough.
onMounted(load)

// PlantForm emits 'saved' after the server accepts the plant:
// show a toast, then router.push() to go back (programmatic navigation)
function onSaved(saved) {
  toast(isEdit.value ? 'Changes saved' : `${saved.plantName} added`)
  router.push(backTo.value)
}
</script>

<template>
  <main class="form-page">
    <RouterLink :to="backTo" class="back">
      <span class="arrow">←</span> {{ isEdit ? 'Back to plant' : 'My Plants' }}
    </RouterLink>
    <!-- The form shows its own title (with Save beside it); this one is for loading/errors -->
    <h1 v-if="loading || loadError">{{ isEdit ? 'Edit plant' : 'Add a plant' }}</h1>

    <!-- Wait for the saved plant before showing its editable fields. -->
    <Loading v-if="loading" label="Loading plant…" />
    <div v-else-if="loadError" class="load-error" role="alert">
      <p>{{ loadError }}</p>
      <RouterLink to="/plants" class="btn">Back to My Plants</RouterLink>
    </div>
    <div v-else>
      <!-- key remounts the form when switching between add and edit -->
      <PlantForm
        :key="plantId || 'new'"
        :plant="plant"
        @saved="onSaved"
        @cancel="router.push(backTo)"
      />
    </div>
  </main>
</template>

<style scoped>

/* Same back link as the plant page: no underline, arrow nudges on hover */
.back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  color: #4d5b52;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}

.back:hover {
  background: transparent;
  color: var(--accent);
}

.back .arrow {
  display: inline-block;
  transition: transform 0.15s ease;
}

.back:hover .arrow {
  transform: translateX(-3px);
}

h1 {
  margin-bottom: 24px;
  font-size: 32px;
  font-weight: 700;
  color: var(--color-heading);
}

.muted {
  color: var(--muted);
}

.load-error {
  display: grid;
  gap: 0.75rem;
  justify-items: start;
  padding: 1rem;
  border-radius: var(--radius);
  background: var(--danger-soft);
  color: var(--danger);
  font-weight: 600;
}
</style>
