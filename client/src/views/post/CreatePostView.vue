<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import UserAvatar from '@/components/user/UserAvatar.vue'
import PostDraftPreview from '@/components/post/PostDraftPreview.vue'
import '@/assets/community.css'
import '@/assets/post-form.css'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const editing = computed(() => !!route.params.postId)
const loading = ref(editing.value)
const loadError = ref('')
const retained = ref([])
const backTo = computed(() => (editing.value ? '/my-posts' : '/community'))
const { show: toast } = useToast()
const title = ref('')
const content = ref('')
const photos = ref([])
const submitting = ref(false)
const error = ref('')
const photoError = ref('')
const previewOpen = ref(false)

// Match the server's final image order: retained photos first, then new uploads.
// A single list keeps the thumbnail badge and live preview on the same cover photo.
const draftPhotos = computed(() => [
  ...retained.value.map((url, index) => ({
    key: 'saved-' + url,
    url,
    index,
    retained: true,
    alt: 'Current photo ' + (index + 1),
  })),
  ...photos.value.map((photo, index) => ({
    key: photo.preview,
    url: photo.preview,
    index,
    retained: false,
    alt: 'Selected photo ' + (index + 1) + ': ' + photo.file.name,
  })),
])
const canPublish = computed(
  () => !!title.value.trim() && !!content.value.trim() && !submitting.value,
)

// Keep upload cleanup in removePhoto; saved URLs do not need revoking.
function removeDraftPhoto(photo) {
  if (photo.retained) retained.value.splice(photo.index, 1)
  else removePhoto(photo.index)
  photoError.value = ''
}

// Validate the combined photo count, file types and sizes before creating local previews.

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
// Release the temporary preview URL when a selected upload is removed.
function removePhoto(index) {
  URL.revokeObjectURL(photos.value[index].preview)
  photos.value.splice(index, 1)
  photoError.value = ''
}
onBeforeUnmount(() => photos.value.forEach((photo) => URL.revokeObjectURL(photo.preview)))

// Load the edit form and refuse to expose edit controls for another user’s post.

async function loadPost() {
  loading.value = true
  loadError.value = ''
  try {
    const post = await auth.authorizedRequest('/post/' + route.params.postId)
    if (post.creatorId !== auth.user?.userId) throw new Error('You can only edit your own posts.')
    title.value = post.title || ''
    content.value = post.content
    retained.value = [...post.postImages]
  } catch (err) {
    loadError.value = err.message
  } finally {
    loading.value = false
  }
}
onMounted(() => {
  if (editing.value) loadPost()
})
// Validate text, submit multipart photos, and return to the appropriate listing after saving.
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
  // Let the browser set the multipart boundary; do not set Content-Type manually.
  body.append('title', title.value.trim())
  body.append('content', content.value.trim())
  if (editing.value) body.append('retainedImages', JSON.stringify(retained.value))
  photos.value.forEach((photo) => body.append('photos', photo.file))
  try {
    await auth.authorizedRequest(editing.value ? '/post/' + route.params.postId : '/post', {
      method: editing.value ? 'PATCH' : 'POST',
      body,
    })
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
  <main class="community-page community-create post-composer">
    <RouterLink :to="backTo" class="community-back"
      >← {{ editing ? 'My posts' : 'Back to community' }}</RouterLink
    >
    <header class="community-heading">
      <div>
        <p class="community-eyebrow">A LITTLE UPDATE GOES A LONG WAY</p>
        <h1>{{ editing ? 'Edit your post' : 'Share something growing' }}<span>.</span></h1>
        <p class="community-muted">A new leaf, a little win, or a question for your neighbours.</p>
      </div>
      <span class="composer-status"
        ><span aria-hidden="true">✎</span> {{ editing ? 'Editing post' : 'New post' }}</span
      >
    </header>
    <p v-if="loading" class="composer-loading" role="status">
      <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Loading your post…
    </p>
    <div v-else-if="loadError" class="community-error" role="alert">
      <p>{{ loadError }}</p>
      <button type="button" class="btn" @click="loadPost">Try again</button>
    </div>
    <!-- Bootstrap stacks the editor and preview below lg; no horizontal form scrolling. -->
    <div v-else class="row g-4 align-items-start">
      <div class="col-12 col-lg-7">
        <form
          class="composer-surface composer-editor"
          :aria-busy="submitting"
          @submit.prevent="publish"
        >
          <div class="composer-author">
            <UserAvatar :user="auth.user" :size="44" />
            <div>
              <strong>{{ auth.user?.userName }}</strong>
              <p>Posting to the community <span aria-hidden="true">·</span> Public</p>
            </div>
            <span class="composer-public" aria-label="Visible to everyone">Public</span>
          </div>
          <!-- Disable all editable fields during saving, including photo removal. -->
          <fieldset :disabled="submitting" class="composer-fields">
            <legend class="visually-hidden">Post details</legend>
            <section class="composer-section" aria-labelledby="story-heading">
              <div class="composer-section-heading">
                <span class="composer-step" aria-hidden="true">01</span>
                <div>
                  <h2 id="story-heading">Your story</h2>
                  <p>Give the community something to grow with.</p>
                </div>
              </div>
              <div class="composer-label-row">
                <label for="post-title">Title <span aria-hidden="true">*</span></label
                ><span id="title-count" class="composer-counter">{{ title.length }}/150</span>
              </div>
              <input
                id="post-title"
                v-model="title"
                class="form-control"
                type="text"
                required
                maxlength="150"
                aria-describedby="title-count"
                placeholder="A new leaf on my monstera…"
              />
              <label for="post-content">Your update <span aria-hidden="true">*</span></label>
              <textarea
                id="post-content"
                v-model="content"
                class="form-control"
                rows="7"
                required
                placeholder="Tell us the story. What’s growing, what have you learned, or what could you use a hand with?"
              />
              <p class="composer-field-help">
                Share a tip, ask a question, or celebrate a little progress.
              </p>
            </section>
            <section class="composer-section" aria-labelledby="photos-heading">
              <div class="composer-section-heading">
                <span class="composer-step" aria-hidden="true">02</span>
                <div>
                  <h2 id="photos-heading">
                    Add a little colour <span class="composer-optional">Optional</span>
                  </h2>
                  <p>The first photo becomes your cover.</p>
                </div>
                <span class="composer-photo-count" role="status">{{ draftPhotos.length }}/9</span>
              </div>
              <!-- The native file input stays keyboard accessible; the label opens the picker. -->
              <div
                class="composer-upload"
                :class="{ 'composer-upload-full': draftPhotos.length === 9 }"
              >
                <span class="composer-upload-icon" aria-hidden="true"
                  ><svg viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="4" />
                    <circle cx="8" cy="8" r="1.5" />
                    <path d="m3 16 5-5 4 4 3-3 6 6" /></svg
                ></span>
                <strong>{{
                  draftPhotos.length === 9
                    ? 'Your photo collection is full'
                    : 'Let your plants do the talking'
                }}</strong>
                <p id="photo-help">JPG, PNG or WebP · Up to 9 photos · 2MB each</p>
                <label for="post-photos" class="composer-upload-button"
                  >＋ {{ draftPhotos.length ? 'Add more photos' : 'Choose photos' }}</label
                >
                <input
                  id="post-photos"
                  class="composer-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  :disabled="draftPhotos.length === 9"
                  aria-describedby="photo-help photo-error"
                  @change="selectPhotos"
                />
              </div>
              <p id="photo-error" v-show="photoError" class="community-error" role="alert">
                {{ photoError }}
              </p>
              <!-- One keyed grid ensures exactly one cover badge, including in edit mode. -->
              <TransitionGroup
                v-if="draftPhotos.length"
                name="composer-photo"
                tag="div"
                class="composer-photo-grid"
              >
                <div
                  v-for="(photo, position) in draftPhotos"
                  :key="photo.key"
                  class="community-photo-preview composer-thumbnail"
                >
                  <img :src="photo.url" :alt="photo.alt" />
                  <button
                    type="button"
                    :aria-label="
                      photo.retained
                        ? 'Remove current photo ' + (photo.index + 1)
                        : 'Remove photo ' + (photo.index + 1)
                    "
                    @click="removeDraftPhoto(photo)"
                  >
                    ×
                  </button>
                  <span v-if="position === 0" class="composer-cover-badge">Cover photo</span>
                </div>
              </TransitionGroup>
            </section>
          </fieldset>
          <p v-if="error" role="alert" class="community-error">{{ error }}</p>
          <footer class="composer-actions">
            <div class="composer-ready">
              <strong>{{ editing ? 'Happy with your changes?' : 'Ready to share?' }}</strong
              ><span>Your post will be visible to the community.</span>
            </div>
            <div class="composer-action-buttons">
              <RouterLink v-if="!submitting" :to="backTo" class="btn composer-cancel"
                >Cancel</RouterLink
              ><button
                type="submit"
                class="btn btn-primary composer-submit"
                :disabled="!canPublish"
              >
                <span
                  v-if="submitting"
                  class="spinner-border spinner-border-sm"
                  aria-hidden="true"
                ></span
                >{{
                  submitting
                    ? editing
                      ? 'Saving…'
                      : 'Sharing…'
                    : editing
                      ? 'Save changes'
                      : 'Share post'
                }}<span v-if="!submitting" aria-hidden="true">↗</span>
              </button>
            </div>
          </footer>
        </form>
      </div>
      <aside class="col-12 col-lg-5 composer-sidebar" aria-label="Post preview">
        <div class="composer-preview-heading">
          <div>
            <p class="community-eyebrow">A LITTLE SNEAK PEEK</p>
            <h2>How your post will look</h2>
          </div>
          <button
            type="button"
            class="composer-preview-toggle d-lg-none"
            :aria-expanded="previewOpen"
            aria-controls="draft-preview"
            @click="previewOpen = !previewOpen"
          >
            {{ previewOpen ? 'Hide preview' : 'Show preview' }}
          </button>
        </div>
        <div
          id="draft-preview"
          class="composer-preview-content"
          :class="{ 'is-open': previewOpen }"
        >
          <PostDraftPreview
            :title="title"
            :content="content"
            :photos="draftPhotos"
            :author="auth.user"
          />
          <div class="composer-tip">
            <span aria-hidden="true">❧</span>
            <div>
              <strong>Small stories. Growing connections.</strong>
              <p>You don’t need a perfect plant to have something worth sharing.</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </main>
</template>
