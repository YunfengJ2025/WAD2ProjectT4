<script setup>
import { computed, ref, watch } from 'vue'
import UserAvatar from '@/components/user/UserAvatar.vue'
import '@/assets/post-form.css'

// This preview only reads the draft. It never publishes, likes, or opens a post.
const props = defineProps({
  title: { type: String, default: '' },
  content: { type: String, default: '' },
  photos: { type: Array, default: () => [] },
  author: { type: Object, default: null },
})
const activeKey = ref(null)
const failedKey = ref(null)
// Track photos by key instead of array position so removing another photo does
// not unexpectedly change the selected preview. Removing it returns to the cover.
const activePhoto = computed(
  () => props.photos.find((photo) => photo.key === activeKey.value) || props.photos[0],
)
watch(
  () => activePhoto.value?.key,
  () => {
    failedKey.value = null
  },
)
</script>

<template>
  <article class="composer-surface composer-draft" aria-label="Live post preview">
    <div class="composer-draft-cover">
      <img
        v-if="activePhoto && failedKey !== activePhoto.key"
        :src="activePhoto.url"
        :alt="activePhoto.alt"
        @error="failedKey = activePhoto.key"
      />
      <div v-else class="composer-draft-placeholder">
        <span aria-hidden="true">❧</span>
        <p>
          {{
            activePhoto ? 'Photo preview unavailable' : 'A little room for your next green moment'
          }}
        </p>
      </div>
      <span class="composer-preview-tag">Preview · Not published</span>
      <span v-if="photos.length" class="composer-draft-photo-count"
        >{{ photos.findIndex((photo) => photo.key === activePhoto.key) + 1 }}/{{
          photos.length
        }}</span
      >
    </div>
    <div class="composer-draft-body">
      <div class="composer-draft-author">
        <UserAvatar :user="author" :size="34" />
        <div>
          <strong>{{ author?.userName }}</strong
          ><span>Community · Public</span>
        </div>
      </div>
      <!-- Interpolation renders plain text safely; CSS preserves the writer's newlines. -->
      <h3>{{ title.trim() || 'Your next little plant story' }}</h3>
      <p class="composer-draft-text" :class="{ 'composer-draft-hint': !content.trim() }">
        {{
          content.trim() ||
          'Your words will appear here as you write. A question, a discovery, a small win — it all belongs.'
        }}
      </p>
      <div
        v-if="photos.length > 1"
        class="composer-preview-thumbnails"
        role="group"
        aria-label="Preview photos"
      >
        <button
          v-for="(photo, index) in photos"
          :key="photo.key"
          type="button"
          :aria-label="`Preview photo ${index + 1}`"
          :aria-pressed="activePhoto.key === photo.key"
          @click="activeKey = photo.key"
        >
          <img :src="photo.url" alt="" />
        </button>
      </div>
    </div>
  </article>
</template>
