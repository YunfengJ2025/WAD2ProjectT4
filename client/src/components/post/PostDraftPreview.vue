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
const dragOffset = ref(0)
const dragging = ref(false)
let gesture = null
// Track photos by key instead of array position so removing another photo does
// not unexpectedly change the selected preview. Removing it returns to the cover.
const activePhoto = computed(
  () => props.photos.find((photo) => photo.key === activeKey.value) || props.photos[0],
)
// Arrows, keyboard controls, thumbnails, and swipes all update the same photo key.
// Modulo wraps from the last photo to the cover and from the cover to the last.
function movePhoto(amount) {
  if (props.photos.length < 2) return
  const index = props.photos.findIndex((photo) => photo.key === activePhoto.value?.key)
  selectPhoto(props.photos[(index + amount + props.photos.length) % props.photos.length].key)
}
function selectPhoto(key) {
  cancelSwipe()
  activeKey.value = key
}
// Wait for a clear horizontal gesture before capturing the pointer. Vertical
// gestures remain available for ordinary phone scrolling (touch-action: pan-y).
function startSwipe(event) {
  if (
    props.photos.length < 2 ||
    event.button > 0 ||
    event.isPrimary === false ||
    event.target.closest('button')
  )
    return
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY }
}
function moveSwipe(event) {
  if (!gesture || event.pointerId !== gesture.id) return
  const dx = event.clientX - gesture.x
  const dy = event.clientY - gesture.y
  if (!dragging.value && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
    cancelSwipe()
    return
  }
  if (Math.abs(dx) > 8) {
    dragging.value = true
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const width = event.currentTarget.clientWidth
    dragOffset.value = Math.max(-width, Math.min(width, dx))
  }
}
// A short drag snaps back; a deliberate swipe advances once, matching post details.
function endSwipe(event) {
  if (!gesture || event.pointerId !== gesture.id) return
  const dx = event.clientX - gesture.x
  const threshold = Math.min(70, event.currentTarget.clientWidth * 0.15)
  if (dragging.value && Math.abs(dx) > threshold) movePhoto(dx < 0 ? 1 : -1)
  cancelSwipe()
}
function cancelSwipe() {
  gesture = null
  dragOffset.value = 0
  dragging.value = false
}
// Photo removals/uploads must not leave a drag attached to a stale photo list.
watch(() => props.photos.map((photo) => photo.key).join('|'), cancelSwipe)
watch(
  () => activePhoto.value?.key,
  () => {
    failedKey.value = null
  },
)
</script>

<template>
  <article class="composer-surface composer-draft" aria-label="Live post preview">
    <div
      class="composer-draft-cover"
      :class="{ 'composer-preview-dragging': dragging }"
      role="region"
      aria-label="Draft photos"
      aria-roledescription="carousel"
      :tabindex="photos.length > 1 ? 0 : undefined"
      @keydown.left.prevent="movePhoto(-1)"
      @keydown.right.prevent="movePhoto(1)"
      @pointerdown="startSwipe"
      @pointermove="moveSwipe"
      @pointerup="endSwipe"
      @pointercancel="cancelSwipe"
      @lostpointercapture="cancelSwipe"
      @dragstart.prevent
    >
      <img
        v-if="activePhoto && failedKey !== activePhoto.key"
        :src="activePhoto.url"
        :alt="activePhoto.alt"
        draggable="false"
        :style="{ transform: `translateX(${dragOffset}px)` }"
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
      <span
        v-if="photos.length"
        class="composer-draft-photo-count"
        aria-live="polite"
        aria-atomic="true"
        >{{ photos.findIndex((photo) => photo.key === activePhoto.key) + 1 }}/{{
          photos.length
        }}</span
      >
      <template v-if="photos.length > 1">
        <button
          type="button"
          class="composer-preview-arrow composer-preview-previous"
          aria-label="Previous preview photo"
          @click="movePhoto(-1)"
        >
          ‹
        </button>
        <button
          type="button"
          class="composer-preview-arrow composer-preview-next"
          aria-label="Next preview photo"
          @click="movePhoto(1)"
        >
          ›
        </button>
      </template>
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
          @click="selectPhoto(photo.key)"
        >
          <img :src="photo.url" alt="" />
        </button>
      </div>
    </div>
  </article>
</template>
