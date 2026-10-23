<script setup>
defineProps({ modelValue: { type: Number, default: 0 }, readonly: Boolean })
const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <span v-if="readonly" class="stars" :aria-label="`${modelValue} out of 5 stars`">
    <span v-for="star in 5" :key="star" :class="{ filled: star <= modelValue }" aria-hidden="true"
      >★</span
    >
  </span>
  <fieldset v-else class="rating">
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

<style scoped>
.stars,
.rating {
  color: #c6cec8;
  font-size: 1.4rem;
}
.filled {
  color: #a96b08;
}
.rating {
  border: 0;
  padding: 0;
  margin: 0;
}
legend {
  float: none;
  width: auto;
  font-size: 0.9rem;
  font-weight: 600;
  color: #344a3c;
  margin-bottom: 0.3rem;
}
label {
  position: relative;
  cursor: pointer;
  padding: 0.25rem 0.35rem;
  border-radius: 6px;
  font-size: 2rem;
}
input {
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  inset: 0;
  cursor: pointer;
}
label:focus-within {
  outline: 2px solid #2f7d4a;
  outline-offset: 2px;
}
</style>
