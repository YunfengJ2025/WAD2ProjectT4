<script setup>
import { ref } from 'vue'
import StarRating from './StarRating.vue'

const props = defineProps({ targets: { type: Array, required: true } })
const emit = defineEmits(['submit', 'cancel'])
const targetId = ref('')
const rating = ref(0)
const comment = ref('')
const error = ref('')

function submit() {
  const target = props.targets.find((item) => item.key === targetId.value)
  if (!target) {
    error.value = 'Choose a visit or post first.'
    return
  }
  if (target.type === 'VISIT' && !rating.value) {
    error.value = 'Choose a star rating for this visit.'
    return
  }
  if (!comment.value.trim()) {
    error.value = 'Write a short message before sharing.'
    return
  }
  emit('submit', {
    target,
    rating: target.type === 'VISIT' ? rating.value : null,
    comment: comment.value.trim(),
  })
}
</script>

<template>
  <form class="review-form" @submit.prevent="submit">
    <h2>Share a little appreciation</h2>
    <p>Your feedback helps our plant care community grow.</p>
    <label for="review-target">Visit or post</label>
    <select id="review-target" v-model="targetId" required @change="error = ''">
      <option disabled value="">Choose what to review</option>
      <option v-for="target in targets" :key="target.key" :value="target.key">
        {{ target.title }}{{ target.type === 'VISIT' ? ` — Review ${target.receiverName} (${target.receiverRole})` : '' }}
      </option>
    </select>
    <p v-if="targets.find((item) => item.key === targetId)?.type === 'VISIT'">Each participant can review the other once per visit. Care visit reviews do not accept replies.</p>
    <StarRating
      v-if="targets.find((item) => item.key === targetId)?.type === 'VISIT'"
      v-model="rating"
    />
    <label for="review-comment">Your message</label>
    <textarea
      id="review-comment"
      v-model="comment"
      required
      maxlength="1000"
      rows="4"
      placeholder="What went well? What could be better?"
    />
    <small>{{ comment.length }}/1000 characters</small>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <div class="actions">
      <button type="button" class="btn" @click="emit('cancel')">Cancel</button>
      <button type="submit" class="btn btn-primary">Share review</button>
    </div>
  </form>
</template>

<style scoped>
.review-form {
  display: grid;
  gap: 0.75rem;
  padding: 1.5rem;
  background: white;
  border: 1px solid #dce7dd;
  border-radius: 20px;
}
h2 {
  font-size: 1.3rem;
  margin: 0;
}
p,
small {
  color: #607166;
  margin: 0;
}
label {
  font-weight: 600;
  font-size: 0.9rem;
}
select,
textarea {
  width: 100%;
  padding: 0.8rem;
  border: 1px solid #b8c9bc;
  border-radius: 10px;
  background: #fff;
  color: #243b2c;
  font: inherit;
}
textarea {
  resize: vertical;
}
select:focus-visible,
textarea:focus-visible {
  outline: 2px solid #2f7d4a;
  outline-offset: 2px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.error {
  color: #b42318;
}
</style>
