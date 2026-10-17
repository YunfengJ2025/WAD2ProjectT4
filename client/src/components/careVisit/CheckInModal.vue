<template>
  <div class="modal fade show d-block" tabindex="-1" style="background: rgba(0,0,0,0.5);">
    <div class="modal-dialog">
      <div class="modal-content p-4 rounded-4 shadow">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="fw-bold mb-0">📸 Sitter Photo Check-In</h5>
          <button type="button" class="btn-close" @click="$emit('close')"></button>
        </div>

        <form @submit.prevent="submitCheckIn">
          <div class="mb-3">
            <label class="form-label fw-semibold">Photo Proof URL</label>
            <input type="text" class="form-control" v-model="photoUrl" placeholder="Enter image URL" required>
          </div>

          <div class="form-check mb-4">
            <input class="form-check-input" type="checkbox" v-model="runPlantId" id="plantCheck">
            <label class="form-check-label small" for="plantCheck">
              Run <strong>Plant.id AI Health Check</strong> (Detect pests & diseases)
            </label>
          </div>

          <div class="d-flex justify-content-end gap-2">
            <button type="button" class="btn btn-light rounded-pill" @click="$emit('close')">Cancel</button>
            <button type="submit" class="btn btn-success rounded-pill px-4" :disabled="loading">
              {{ loading ? 'Submitting...' : 'Complete Check-In' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  visitId: { type: String, required: true }
})

const emit = defineEmits(['submit-proof', 'close'])
const photoUrl = ref('')
const runPlantId = ref(true)
const loading = ref(false)

function submitCheckIn() {
  loading.value = true
  emit('submit-proof', {
    visitId: props.visitId,
    photoUrl: photoUrl.value,
    runPlantId: runPlantId.value
  })
}
</script>