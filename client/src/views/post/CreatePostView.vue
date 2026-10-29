<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import UserAvatar from '@/components/user/UserAvatar.vue'
import '@/assets/community.css'

const auth = useAuthStore()
const router = useRouter()
const { show: toast } = useToast()
const title = ref('')
const content = ref('')
const photos = ref([])
const submitting = ref(false)
const error = ref('')
const photoError = ref('')

function selectPhotos(event) {
  photoError.value = ''
  const selected = Array.from(event.target.files || [])
  event.target.value = ''
  if (photos.value.length + selected.length > 9) {
    photoError.value = 'Choose up to 9 photos per post.'
    return
  }
  if (
    selected.some(
      (file) =>
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
        file.size > 2 * 1024 * 1024,
    )
  ) {
    photoError.value = 'Each photo must be a JPG, PNG or WebP image, 2MB or smaller.'
    return
  }
  photos.value.push(...selected.map((file) => ({ file, preview: URL.createObjectURL(file) })))
}
function removePhoto(index) {
  URL.revokeObjectURL(photos.value[index].preview)
  photos.value.splice(index, 1)
  photoError.value = ''
}
onBeforeUnmount(() => photos.value.forEach((photo) => URL.revokeObjectURL(photo.preview)))

async function publish() {
  if (submitting.value) return
  error.value = ''
  if (!content.value.trim()) {
    error.value = 'Write something before sharing your post.'
    return
  }
  if (!title.value.trim() || title.value.trim().length > 150) {
    error.value = 'Enter a title of up to 150 characters.'
    return
  }
  submitting.value = true
  const body = new FormData()
  body.append('title', title.value.trim())
  body.append('content', content.value.trim())
  photos.value.forEach((photo) => body.append('photos', photo.file))
  try {
    await auth.authorizedRequest('/post', { method: 'POST', body })
  } catch (err) {
    error.value = err.message
    submitting.value = false
    return
  }
  toast('Your post has been shared!')
  await router.push('/community')
}
</script>

<template>
  <main class="community-page community-create">
    <RouterLink to="/community" class="community-back">← Back to community</RouterLink>
    <header class="community-heading">
      <div>
        <p class="community-eyebrow">A LITTLE UPDATE GOES A LONG WAY</p>
        <h1>Create a post<span>.</span></h1>
        <p class="community-muted">What’s growing in your corner of the world?</p>
      </div>
    </header>
    <form class="community-panel community-form" @submit.prevent="publish">
      <div class="community-author">
        <UserAvatar :user="auth.user" :size="44" />
        <div>
          <strong>{{ auth.user?.userName }}</strong>
          <p class="community-muted">Posting to the community · Public</p>
        </div>
      </div>
      <fieldset :disabled="submitting">
        <label for="post-title">Title</label>
        <input id="post-title" v-model="title" type="text" required maxlength="150" placeholder="Give your update a title" />
        <label for="post-content"
          >Your update <span class="community-muted">(required)</span></label
        >
        <textarea
          id="post-content"
          v-model="content"
          rows="6"
          required
          placeholder="A new leaf, a question, or a tip worth sharing…"
        ></textarea>
        <label for="post-photos"
          >Photos <span class="community-muted">(optional · {{ photos.length }}/9)</span></label
        >
        <div class="community-upload">
          <span aria-hidden="true">＋</span>
          <input
            id="post-photos"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            aria-describedby="photo-help photo-error"
            @change="selectPhotos"
          />
          <p id="photo-help" class="community-muted community-help">
            Choose photos from your device. JPG, PNG or WebP · Up to 9 photos · 2MB each.
          </p>
        </div>
        <p id="photo-error" class="community-error" v-show="photoError" role="alert">
          {{ photoError }}
        </p>
        <div v-if="photos.length" class="community-photo-previews">
          <div
            v-for="(photo, index) in photos"
            :key="photo.preview"
            class="community-photo-preview"
          >
            <img :src="photo.preview" :alt="`Selected photo ${index + 1}: ${photo.file.name}`" />
            <button
              type="button"
              :aria-label="`Remove photo ${index + 1}`"
              @click="removePhoto(index)"
            >
              ×
            </button>
            <span v-if="index === 0">Cover photo</span>
          </div>
        </div>
      </fieldset>
      <p v-if="error" role="alert" class="community-error">{{ error }}</p>
      <div class="community-form-actions">
        <RouterLink v-if="!submitting" to="/community" class="btn">Cancel</RouterLink>
        <button type="submit" class="btn btn-primary" :disabled="submitting || !title.trim() || !content.trim()">
          {{ submitting ? 'Uploading & sharing…' : 'Share post' }}
        </button>
      </div>
    </form>
  </main>
</template>
