<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import PlantForm from '@/components/plant/PlantForm.vue'
import { getPlant } from '@/api/plants'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const { show: toast } = useToast()

const plantId = computed(() => route.params.plantId)
const isEdit = computed(() => !!plantId.value)
// Editing returns to the plant's own page; adding returns to the list.
const backTo = computed(() => (isEdit.value ? `/plants/${plantId.value}` : '/plants'))

const plant = ref(null)
const loading = ref(false)
const loadError = ref('')

async function load() {
  plant.value = null
  loadError.value = ''
  if (!isEdit.value) return
  loading.value = true
  try {
    plant.value = await getPlant(plantId.value)
  } catch (err) {
    loadError.value = err.message
  } finally {
    loading.value = false
  }
}
watch(plantId, load, { immediate: true })

function onSaved(saved) {
  toast(isEdit.value ? 'Changes saved' : `${saved.plantName} added`)
  router.push(backTo.value)
}
</script>

<template>
  <main class="form-page">
    <RouterLink :to="backTo" class="back">
      {{ isEdit ? '← Back to plant' : '← My Plants' }}
    </RouterLink>
    <h1>{{ isEdit ? 'Edit plant' : 'Add a plant' }}</h1>

    <p v-if="loading" class="muted">Loading plant…</p>
    <div v-else-if="loadError" class="load-error" role="alert">
      <p>{{ loadError }}</p>
      <RouterLink to="/plants" class="btn">Back to My Plants</RouterLink>
    </div>
    <div v-else class="panel">
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
.form-page {
  max-width: 640px;
  margin: 0 auto;
}

.back {
  display: inline-block;
  margin-bottom: 0.5rem;
  color: var(--muted);
  font-weight: 500;
}

h1 {
  font-size: clamp(1.5rem, 4vw, 1.9rem);
  font-weight: 700;
  color: var(--color-heading);
  margin-bottom: 1rem;
}

.panel {
  padding: clamp(1rem, 4vw, 1.75rem);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow);
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
