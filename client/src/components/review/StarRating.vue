<script setup>
import '@/assets/reviews.css'

const props = defineProps({ modelValue: { type: Number, default: 0 }, readonly: Boolean })
const emit = defineEmits(['update:modelValue'])

// Each star owns one point: at 4.5, stars 1–4 fill fully and star 5 fills 50%.
// Clamp the width so missing or out-of-range values cannot overflow a star.
function fillPercentage(star) {
  const rating = Number.isFinite(props.modelValue) ? props.modelValue : 0
  return `${Math.min(1, Math.max(0, rating - star + 1)) * 100}%`
}
</script>

<template>
  <span
    v-if="readonly"
    class="review-stars"
    role="img"
    :aria-label="`${modelValue} out of 5 stars`"
  >
    <span v-for="star in 5" :key="star" class="review-star" aria-hidden="true">
      <span>★</span>
      <span class="review-star-fill" :style="{ width: fillPercentage(star) }">★</span>
    </span>
  </span>
  <fieldset v-else class="review-rating-input">
    <legend>Your rating</legend>
    <label v-for="star in 5" :key="star" :class="{ filled: star <= modelValue }">
      <input
        type="radio"
        name="review-rating"
        :value="star"
        :checked="modelValue === star"
        :aria-label="`${star} ${star === 1 ? 'star' : 'stars'}`"
        @change="emit('update:modelValue', star)"
      />
      <span aria-hidden="true">★</span>
    </label>
  </fieldset>
</template>
