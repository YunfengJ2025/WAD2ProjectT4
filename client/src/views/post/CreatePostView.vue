<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import UserAvatar from '@/components/user/UserAvatar.vue'
import '@/assets/community.css'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const editing = computed(() => !!route.params.postId)
const loading = ref(editing.value)
const loadError = ref('')
const retained = ref([])
const backTo = computed(() => editing.value ? '/my-posts' : '/community')
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
  if (retained.value.length + photos.value.length + selected.length > 9) {
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

async function loadPost() {
  loading.value = true
  loadError.value = ''
  try {
    const post = await auth.authorizedRequest('/post/' + route.params.postId)
    if (post.creatorId !== auth.user?.userId) throw new Error('You can only edit your own posts.')
    title.value = post.title || ''
    content.value = post.content
    retained.value = [...post.postImages]
  } catch (err) { loadError.value = err.message }
  finally { loading.value = false }
}
onMounted(() => { if (editing.value) loadPost() })
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
  if (editing.value) body.append('retainedImages', JSON.stringify(retained.value))
  photos.value.forEach((photo) => body.append('photos', photo.file))
  try {
    await auth.authorizedRequest(editing.value ? '/post/' + route.params.postId : '/post', { method: editing.value ? 'PATCH' : 'POST', body })
  } catch (err) {
    error.value = err.message
    submitting.value = false
    return
  }
  toast(editing.value ? 'Your post has been updated!' : 'Your post has been shared!')
  await router.push(backTo.value)
}
</script>

<template>
  <main class="community-page community-create">
    <RouterLink :to="backTo" class="community-back">← {{ editing ? 'My posts' : 'Back to community' }}</RouterLink>
    <header class="community-heading">
      <div>
        <p class="community-eyebrow">A LITTLE UPDATE GOES A LONG WAY</p>
        <h1>{{ editing ? 'Edit your post' : 'Create a post' }}<span>.</span></h1>
        <p class="community-muted">What’s growing in your corner of the world?</p>
      </div>
    </header>
    <p v-if="loading" role="status">Loading your post…</p>
    <div v-else-if="loadError" class="community-error" role="alert"><p>{{ loadError }}</p><button class="btn" @click="loadPost">Try again</button></div>
    <form v-else class="community-panel community-form" @submit.prevent="publish">
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
          >Photos <span class="community-muted">(optional · {{ retained.length + photos.length }}/9)</span></label
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
        <div v-if="retained.length" class="community-photo-previews">
          <div v-for="(url, index) in retained" :key="url" class="community-photo-preview"><img :src="url" :alt="'Current photo ' + (index + 1)" /><button type="button" :aria-label="'Remove current photo ' + (index + 1)" @click="retained.splice(index, 1)">×</button></div>
        </div>
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
        <RouterLink v-if="!submitting" :to="backTo" class="btn">Cancel</RouterLink>
        <button type="submit" class="btn btn-primary" :disabled="submitting || !title.trim() || !content.trim()">
          {{ submitting ? 'Saving…' : editing ? 'Save changes' : 'Share post' }}
        </button>
      </div>
    </form>
  </main>
</template>
