<template>
  <div class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.5);">
    <div class="modal-dialog modal-dialog-scrollable">
      <div class="modal-content p-4 rounded-4 shadow">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <h5 class="fw-bold mb-0">📸 Sitter Photo Check-In</h5>
          <button type="button" class="btn-close" @click="$emit('close')"></button>
        </div>
        <p class="text-muted small mb-3">
          {{ doneCount }}/{{ items.length }} plants done. Submit one photo for each plant.
        </p>

        <!-- one row per plant -->
        <div v-for="item in items" :key="item.requestItemId" class="border rounded-3 p-3 mb-3">
          <div class="d-flex align-items-center mb-2">
            <img v-if="item.plantPhotoUrl" :src="item.plantPhotoUrl" alt=""
                 class="rounded me-2" style="width:40px;height:40px;object-fit:cover;">
            <span v-else class="me-2 fs-4">🪴</span>
            <span class="fw-semibold">{{ item.plantName }}</span>
            <span v-if="item.status === 'Completed'" class="badge bg-success ms-auto">✅ Done</span>
          </div>

          <!-- finished: show the photo that was submitted -->
          <img v-if="item.status === 'Completed' && item.proof" :src="item.proof.photoUrl" alt="Photo proof"
               class="rounded" style="max-height:120px;max-width:100%;">

          <!-- not finished: URL input + its own submit button -->
          <form v-else class="d-flex gap-2" @submit.prevent="submitItem(item)">
            <input type="text" class="form-control form-control-sm"
                   v-model="photoUrls[item.requestItemId]"
                   placeholder="Photo URL for this plant" required>
            <button type="submit" class="btn btn-success btn-sm rounded-pill px-3"
                    :disabled="submitting === item.requestItemId">
              {{ submitting === item.requestItemId ? 'Sending...' : 'Submit' }}
            </button>
          </form>
        </div>

        <div class="form-check mb-3">
          <input class="form-check-input" type="checkbox" v-model="runPlantId" id="plantCheck">
          <label class="form-check-label small" for="plantCheck">
            Run <strong>Plant.id AI Health Check</strong> (Detect pests & diseases)
          </label>
        </div>

        <div class="d-flex justify-content-end">
          <button type="button" class="btn btn-light rounded-pill" @click="$emit('close')">
            {{ doneCount === items.length ? 'Close' : 'Finish later' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  visitId: { type: String, required: true },
  items: { type: Array, default: () => [] }
})

const emit = defineEmits(['submit-proof', 'close'])
const photoUrl = ref({})        // { [requestItemId]: 'https://...' }
const runPlantId = ref(true)
const submitting = ref(null)     // requestItemId currently sending
// const loading = ref(false)

const doneCount = computed(() => props.items.filter((i) => i.status === 'Completed').length)

function submitItem(item) {
  const url = (photoUrls.value[item.requestItemId] || '').trim()
  if (!url) return
  submitting.value = item.requestItemId
  emit('submit-proof', {
    visitId: props.visitId,
    requestItemId: item.requestItemId,
    photoUrl: url,
    runPlantId: runPlantId.value,
  })
}

// when the parent reloads the items, the row is no longer "sending"
watch(() => props.items, () => { submitting.value = null })

// function submitCheckIn() {
//   loading.value = true
//   emit('submit-proof', {
//     visitId: props.visitId,
//     photoUrl: photoUrl.value,
//     runPlantId: runPlantId.value
//   })
// }
</script>