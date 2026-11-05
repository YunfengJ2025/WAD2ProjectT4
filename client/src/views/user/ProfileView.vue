<script setup>
import ScrollToTop from '@/components/ScrollToTop.vue'
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { usePostalCheck } from '@/composables/usePostalCheck'
import { storeToRefs } from 'pinia'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import UserAvatar from '@/components/user/UserAvatar.vue'
import ProfileReviews from '@/components/user/ProfileReviews.vue'
import ProfilePosts from '@/components/user/ProfilePosts.vue'
import TokenBalance from '@/components/token/TokenBalance.vue'
import '@/assets/profile.css'

const auth = useAuthStore()
const { user } = storeToRefs(auth)
const profilePage = ref(null)
const sidebar = ref(null)
const activeSection = ref('about-me')
const scrollOffset = ref(32)
const sections = computed(() => [
  // short = the label on phones, where the tabs are a 3 x 2 grid of small tiles
  { id: 'about-me', label: 'About me', short: 'About', icon: '◉' },
  { id: 'personal-details', label: 'Personal details', short: 'Details', icon: '☷' },
  { id: 'address', label: 'My address', short: 'Address', icon: '⌂' },
  { id: 'profile-reviews', label: 'My reviews', short: 'Reviews', icon: '☆' },
  { id: 'profile-posts', label: 'My posts', short: 'Posts', icon: '▧' },
  { id: 'profile-badges', label: 'My badges', short: 'Badges', icon: '✦' },
])
let scrollFrame = null
let resizeObserver

// ---------- Delete account ----------
// Opens a small form asking for the password; the server checks it and blocks the delete
// while there are active requests or accepted sits (its message is shown here).
const router = useRouter()
const { show: toast } = useToast()
const deleteOpen = ref(false)
const deletePassword = ref('')
const deleteBusy = ref(false)
const deleteError = ref('')

function cancelDelete() {
  deleteOpen.value = false
  deletePassword.value = ''
  deleteError.value = ''
}

async function deleteAccount() {
  if (deleteBusy.value) return
  deleteError.value = ''
  if (!deletePassword.value) {
    deleteError.value = 'Enter your password to confirm.'
    return
  }
  deleteBusy.value = true
  try {
    await auth.authorizedRequest('/user/me', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: deletePassword.value }),
    })
    // Go to the public landing page first, then forget the login
    // (clearing first would make App.vue send us to Sign in instead)
    await router.replace('/')
    auth.clearSession()
    toast('Your account has been deleted. Goodbye 🌱')
  } catch (err) {
    deleteError.value = err.message
  } finally {
    deleteBusy.value = false
  }
}

function updateActiveSection() {
  scrollFrame = null
  scrollOffset.value = 32
  const available = sections.value.map((section) => profilePage.value?.querySelector(`#${section.id}`)).filter(Boolean)
  if (!available.length) return
  let current = available[0].id
  for (const section of available) {
    if (section.getBoundingClientRect().top <= scrollOffset.value + 8) current = section.id
  }
  // Short final sections may never reach the top of the viewport.
  if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
    current = available[available.length - 1].id
  }
  activeSection.value = current
}
function scheduleSectionUpdate() {
  if (scrollFrame === null) scrollFrame = requestAnimationFrame(updateActiveSection)
}
onMounted(async () => {
  updateActiveSection()
  window.addEventListener('scroll', scheduleSectionUpdate, { passive: true })
  window.addEventListener('resize', scheduleSectionUpdate)
  if (typeof ResizeObserver !== 'undefined' && profilePage.value) {
    resizeObserver = new ResizeObserver(scheduleSectionUpdate)
    resizeObserver.observe(profilePage.value)
  }

  // Refresh user profile/badges immediately so newly unlocked badges show up
  try {
    await auth.refreshUser()
  } catch {
    // silently catch if offline
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', scheduleSectionUpdate)
  window.removeEventListener('resize', scheduleSectionUpdate)
  resizeObserver?.disconnect()
  if (scrollFrame !== null) cancelAnimationFrame(scrollFrame)
})
const editing = ref(false)
const saving = ref(false)
const uploading = ref(false)
const editingBio = ref(false)
const savingBio = ref(false)
const bioDraft = ref('')
const error = ref('')
const errors = ref({})
const success = ref('')
const form = ref({})
const photo = ref(null)
const preview = ref('')
const photoInput = ref(null)
const busy = computed(() => saving.value || uploading.value || savingBio.value)
function editBio() {
  bioDraft.value = user.value.bio || ''
  editingBio.value = true
  error.value = ''
  success.value = ''
}
async function saveBio() {
  if (busy.value) return
  error.value = ''
  if (bioDraft.value.trim().length > 500) { error.value = 'Bio cannot exceed 500 characters.'; return }
  savingBio.value = true
  try {
    await auth.updateProfile({ bio: bioDraft.value.trim() })
    editingBio.value = false
    success.value = 'Your bio has been saved.'
  } catch (err) {
    error.value = err.message
  } finally {
    savingBio.value = false
  }
}
const avatarUser = computed(() => ({
  ...user.value,
  photoUrl: preview.value || user.value?.photoUrl,
}))
const memberSince = computed(() =>
  user.value?.createdAt
    ? new Date(user.value.createdAt).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })
    : '',
)
const fields = [
  { key: 'userName', label: 'Username', autocomplete: 'username', max: 30 },
  { key: 'email', label: 'Email address', type: 'email', autocomplete: 'email' },
  { key: 'block', label: 'Block', placeholder: 'e.g. 123A' },
  { key: 'unitNumber', label: 'Unit number', placeholder: 'e.g. #05-12' },
  { key: 'postalCode', label: 'Postal code', autocomplete: 'postal-code', max: 6 },
]

// Check a NEW postal code with OneMap while editing, and fill in the block from it.
// (The saved postal code isn't re-checked, so opening Edit doesn't call OneMap.)
const postalChanged = computed(() => form.value.postalCode?.trim() !== user.value?.postalCode)
const postal = usePostalCheck(() => (editing.value && postalChanged.value ? form.value.postalCode : ''))
watch(postal.place, (place) => {
  if (place?.block) form.value.block = place.block
})
// Editing the postal code clears its old error, so the new check result can show
watch(() => form.value.postalCode, () => {
  delete errors.value.postalCode
})
// Lock the block box when OneMap gave us the block (landed homes have none, so they type it)
const blockFromOneMap = computed(() => !!postal.place.value?.block)

function clearPhoto() {
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = ''
  photo.value = null
  if (photoInput.value) photoInput.value.value = ''
}
onBeforeUnmount(clearPhoto)

function choosePhoto(event) {
  const file = event.target.files?.[0]
  if (!file) return
  clearPhoto()
  setPhoto(file)
}

function setPhoto(file) {
  delete errors.value.photo
  error.value = ''
  success.value = ''
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    errors.value.photo = 'Choose a JPG, PNG or WebP image.'
  } else if (file.size > 2 * 1024 * 1024) {
    errors.value.photo = 'Your photo must be 2MB or smaller.'
  } else {
    photo.value = file
    preview.value = URL.createObjectURL(file)
  }
}

async function savePhoto() {
  if (!photo.value || busy.value) return
  uploading.value = true
  error.value = ''
  success.value = ''
  try {
    const data = new FormData()
    data.append('photo', photo.value)
    await auth.updateProfile(data)
    clearPhoto()
    success.value = 'Profile photo updated.'
  } catch (err) {
    error.value = err.message
    errors.value = err.errors || {}
  } finally {
    uploading.value = false
  }
}

function startEditing() {
  form.value = Object.fromEntries(fields.map(({ key }) => [key, user.value[key] || '']))
  errors.value = {}
  error.value = ''
  success.value = ''
  editing.value = true
}

function cancelEditing() {
  editing.value = false
  errors.value = {}
  error.value = ''
}

async function save() {
  if (busy.value) return
  errors.value = {}
  error.value = ''
  success.value = ''
  for (const { key, label } of fields) {
    form.value[key] = form.value[key].trim()
    if (!form.value[key]) errors.value[key] = label + ' is required.'
  }
  if (form.value.userName.length < 3 || form.value.userName.length > 30)
    errors.value.userName = 'Use 3 to 30 characters.'
  if (!/^\S+@\S+\.\S+$/.test(form.value.email)) errors.value.email = 'Enter a valid email address.'
  if (!/^\d{6}$/.test(form.value.postalCode))
    errors.value.postalCode = 'Enter a 6-digit postal code.'
  // A new postal code must be one OneMap knows (the server checks this again)
  else if (postalChanged.value && postal.status.value !== 'ok')
    errors.value.postalCode = postal.status.value === 'checking'
      ? 'Still checking your postal code. Please wait a moment.'
      : postal.message.value || 'Please enter a valid Singapore postal code.'
  if (Object.keys(errors.value).length) {
    error.value = 'Please check the highlighted fields.'
    return
  }
  saving.value = true
  try {
    await auth.updateProfile(form.value)
    editing.value = false
    success.value = 'Your details have been saved.'
  } catch (err) {
    error.value = err.message
    errors.value = err.errors || {}
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <main v-if="user" ref="profilePage" class="profile-page profile-shell" :style="{ '--profile-scroll-offset': `${scrollOffset}px` }">
    <aside ref="sidebar" class="profile-sidebar">
      <p class="eyebrow">YOUR LITTLE GREEN CORNER</p>
      <h1>Profile</h1>
      <nav aria-label="Profile sections">
        <a v-for="section in sections" :key="section.id" :href="`#${section.id}`"
          :class="{ selected: activeSection === section.id }"
          :aria-current="activeSection === section.id ? 'location' : undefined"
          :aria-label="section.label"
          @click="activeSection = section.id">
          <span class="nav-icon" aria-hidden="true">{{ section.icon }}</span>
          <!-- full label on desktop, short label on phones (CSS picks one) -->
          <span class="nav-label" aria-hidden="true">{{ section.label }}</span>
          <span class="nav-short" aria-hidden="true">{{ section.short }}</span>
        </a>
      </nav>

      <!--
        Badges Showcase in Sidebar:
        Positioned below the profile navigation links and right above the leafy note.
        v-if="user.badges && user.badges.length" ensures the box only renders if user has earned badges (WAD2 wk4).
        v-for with :key loops over user.badges (WAD2 wk4).
        Hovering shows title tooltip with name and description.
      -->
      <div v-if="user.badges && user.badges.length" class="sidebar-badges-section">
        <p class="sidebar-badges-title">ACHIEVED BADGES</p>
        <div class="sidebar-badges-grid">
          <div
            v-for="b in user.badges"
            :key="b.id"
            class="sidebar-badge-item"
            :title="`${b.name}: ${b.description}`"
          >
            <span class="sidebar-badge-icon">{{ b.icon }}</span>
          </div>
        </div>
      </div>

      <div class="sidebar-note">
        <svg
          class="leaf"
          width="30"
          height="30"
          viewBox="0 0 32 32"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <path d="M7 25C5 13 13 6 26 5c1 13-7 20-19 20Zm0 0L22 10" />
        </svg>
        <p>A little care goes a long way.</p>
        <span>Make yourself at home in your plant-loving community.</span>
      </div>

    </aside>

    <div class="profile-content">
      <section id="about-me" class="about-section">
        <p class="eyebrow">NICE TO SEE YOU HERE</p>
        <h2>About me</h2>
        <div class="about-layout">
          <div class="identity-card profile-identity-card">
            <div class="avatar-wrap"><UserAvatar :user="avatarUser" :size="116" /></div>
            <h3 class="profile-name">{{ user.userName }}</h3>
            <p class="member-label">Plant-loving neighbour</p>
            <form v-if="editingBio" class="bio-editor" @submit.prevent="saveBio">
              <label for="profile-bio">Bio <span>(optional)</span></label>
              <textarea id="profile-bio" v-model="bioDraft" rows="4" maxlength="500" :disabled="busy" placeholder="Tell your neighbours a little about yourself…" />
              <p class="photo-hint">{{ bioDraft.length }}/500 characters · Shown on your public profile</p>
              <div class="photo-actions">
                <button type="submit" class="btn btn-primary" :disabled="busy">{{ savingBio ? 'Saving…' : 'Save bio' }}</button>
                <button type="button" class="text-button" :disabled="busy" @click="editingBio = false">Cancel</button>
              </div>
            </form>
            <div v-else class="profile-bio">
              <p v-if="user.bio" class="profile-bio-text">{{ user.bio }}</p>
              <p v-else class="photo-hint">Tell your neighbours a little about yourself.</p>
              <button type="button" class="text-button" :disabled="busy" @click="editBio">{{ user.bio ? 'Edit bio' : 'Add a bio' }}</button>
            </div>
            <label class="photo-picker" for="profile-photo" :aria-disabled="busy">
              <svg
                viewBox="0 0 24 24"
                width="17"
                height="17"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                aria-hidden="true"
              >
                <path d="M8 5 9.5 3h5L16 5h4v15H4V5Z" />
                <circle cx="12" cy="12" r="4" />
              </svg>
              {{ user.photoUrl ? 'Change photo' : 'Add a photo' }}
            </label>
            <input
              id="profile-photo"
              ref="photoInput"
              class="file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              :disabled="busy"
              :aria-describedby="errors.photo ? 'photo-hint photo-error' : 'photo-hint'"
              @change="choosePhoto"
            />
            <p id="photo-hint" class="photo-hint">JPG, PNG or WebP · Up to 2MB</p>
            <RouterLink class="public-profile-link" :to="`/profile/${user.userId}`">View public profile ↗</RouterLink>
            <p v-if="errors.photo" id="photo-error" class="field-error" role="alert">
              {{ errors.photo }}
            </p>
            <div v-if="photo" class="photo-actions">
              <button type="button" class="btn btn-primary" :disabled="busy" @click="savePhoto">
                {{ uploading ? 'Uploading…' : 'Save photo' }}
              </button>
              <button type="button" class="text-button" :disabled="busy" @click="clearPhoto">
                Cancel
              </button>
            </div>
          </div>
          <div class="intro">
            <span class="community-tag">ROOTED IN COMMUNITY</span>
            <h3>A greener neighbourhood <br />starts with you.</h3>
            <p>
              Keep your profile up to date so your neighbours know who is caring for their plants.
            </p>
            <dl class="account-summary profile-meta">
              <div>
                <dt>Community tokens</dt>
                <!-- Share the same balance breakdown and reservation card as the request form. -->
                <dd><TokenBalance /></dd>
              </div>
              <div v-if="memberSince">
                <dt>Member since</dt>
                <dd>{{ memberSince }}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <p v-if="error" class="feedback error" role="alert">{{ error }}</p>
      <p v-if="success" class="feedback success" role="status">{{ success }}</p>

      <form novalidate :aria-busy="saving" @submit.prevent="save">
        <section id="personal-details" class="details-section">
          <div class="section-heading">
            <div>
              <h2>Personal details</h2>
              <p>A familiar name for your neighbours.</p>
            </div>
            <button
              v-if="!editing"
              type="button"
              class="edit-button"
              :disabled="busy"
              @click="startEditing"
            >
              Edit details <span aria-hidden="true">↗</span>
            </button>
          </div>
          <div class="fields-grid">
            <div v-for="field in fields.slice(0, 2)" :key="field.key" class="field">
              <label :for="field.key">{{ field.label }}</label>
              <template v-if="editing">
                <input
                  :id="field.key"
                  v-model="form[field.key]"
                  :type="field.type || 'text'"
                  :autocomplete="field.autocomplete"
                  :maxlength="field.max"
                  :disabled="busy"
                  required
                  :aria-invalid="!!errors[field.key]"
                  :aria-describedby="errors[field.key] ? field.key + '-error' : undefined"
                />
                <p v-if="errors[field.key]" :id="field.key + '-error'" class="field-error">
                  {{ errors[field.key] }}
                </p>
              </template>
              <p v-else class="detail-value">{{ user[field.key] || 'Not added yet' }}</p>
            </div>
          </div>
        </section>

        <section id="address" class="details-section address-section">
          <div class="section-heading">
            <div>
              <h2>My address</h2>
              <p>Your home base for nearby plant care.</p>
            </div>
            <span class="private-tag">Private details</span>
          </div>
          <div class="fields-grid address-grid">
            <div v-for="field in fields.slice(2)" :key="field.key" class="field">
              <label :for="field.key">{{ field.label }}</label>
              <template v-if="editing">
                <input
                  :id="field.key"
                  v-model="form[field.key]"
                  :placeholder="field.placeholder"
                  :autocomplete="field.autocomplete"
                  :maxlength="field.max"
                  :inputmode="field.key === 'postalCode' ? 'numeric' : 'text'"
                  :disabled="busy"
                  :readonly="field.key === 'block' && blockFromOneMap"
                  required
                  :aria-invalid="!!errors[field.key]"
                  :aria-describedby="errors[field.key] ? field.key + '-error' : undefined"
                />
                <p v-if="errors[field.key]" :id="field.key + '-error'" class="field-error">
                  {{ errors[field.key] }}
                </p>
                <!-- Result of the OneMap check, shown under the postal code box -->
                <p v-else-if="field.key === 'postalCode'" class="postal-status" :class="postal.status.value" aria-live="polite">
                  <template v-if="postal.status.value === 'checking'">Checking postal code…</template>
                  <template v-else-if="postal.status.value === 'ok'">
                    ✓ {{ postal.place.value.block ? 'Blk ' + postal.place.value.block + ' ' : '' }}{{ postal.place.value.road }}
                  </template>
                  <template v-else-if="postal.message.value">✗ {{ postal.message.value }}</template>
                </p>
                <p v-else-if="field.key === 'block' && blockFromOneMap" class="postal-status">
                  Filled in from your postal code
                </p>
              </template>
              <p v-else class="detail-value">{{ user[field.key] || 'Not added yet' }}</p>
            </div>
          </div>
          <p class="privacy-note">
            Your address is kept out of your profile card. It helps arrange care close to home.
          </p>
        </section>
        <div v-if="editing" class="form-actions">
          <button type="button" class="text-button" :disabled="busy" @click="cancelEditing">
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" :disabled="busy">
            {{ saving ? 'Saving…' : 'Save changes' }}
          </button>
        </div>
      </form>
      <ProfileReviews />
        <ProfilePosts />

        <!--
          Completed Badges in Profile Content Area:
          Positioned in bottom right, below the My Posts section.
          Shows unlocked badges or a friendly prompt to complete plant care visits.
          <RouterLink> provides quick access to DashboardView where all 10 badges & progress bars live.
        -->
        <section id="profile-badges" class="profile-badges-content-section">
          <div class="section-heading">
            <div>
              <h2>Unlocked Milestone Badges</h2>
              <p v-if="user.badges && user.badges.length">Badges you've earned from your plant care journey.</p>
              <p v-else class="empty-badges-subtitle">Unlock milestone badges by completing plant care visits</p>
            </div>
            <RouterLink to="/dashboard" class="btn btn-sm">View all on Dashboard ↗</RouterLink>
          </div>
          <div v-if="user.badges && user.badges.length" class="profile-completed-badges-grid">
            <div
              v-for="b in user.badges"
              :key="b.id"
              class="profile-completed-badge-card"
            >
              <div class="profile-badge-icon-wrap">
                <span class="profile-badge-icon">{{ b.icon }}</span>
                <!-- Green tick overlay on unlocked badges [NOT IN WAD2 CONTENT] -->
                <span class="profile-badge-check">✓</span>
              </div>
              <div class="profile-badge-meta">
                <h4>{{ b.name }}</h4>
                <p>{{ b.description }}</p>
              </div>
            </div>
          </div>
          <div v-else class="empty-badges-banner">
            <span class="empty-badges-icon">🌱</span>
            <div class="empty-badges-info">
              <h4>No milestone badges unlocked yet</h4>
              <p>Unlock milestone badges by completing plant care visits and helping your neighbours.</p>
            </div>
            <RouterLink to="/dashboard" class="btn btn-sm empty-badges-btn">Explore Badges</RouterLink>
          </div>
        </section>

        <!-- Delete account: hidden behind a button, then asks for the password -->
        <section id="delete-account" class="details-section delete-section" aria-labelledby="delete-account-title">
          <div class="section-heading">
            <div>
              <h2 id="delete-account-title">Delete account</h2>
              <p>Removes your account, plants and posts. This can't be undone.</p>
            </div>
            <button v-if="!deleteOpen" type="button" class="delete-open-btn" @click="deleteOpen = true">
              Delete account
            </button>
          </div>
          <form v-if="deleteOpen" class="delete-form" @submit.prevent="deleteAccount">
            <p class="delete-warning">
              ⚠ Your plants, posts and notifications will be deleted. Past visits and reviews stay,
              shown as a deleted user. You can't delete while you have active requests or accepted sits.
            </p>
            <label for="delete-password">Enter your password to confirm</label>
            <input
              id="delete-password"
              v-model="deletePassword"
              type="password"
              autocomplete="current-password"
              :disabled="deleteBusy"
              :aria-invalid="!!deleteError"
              :aria-describedby="deleteError ? 'delete-error' : undefined"
            />
            <p v-if="deleteError" id="delete-error" class="field-error" role="alert">{{ deleteError }}</p>
            <div class="delete-actions">
              <button type="button" class="btn" :disabled="deleteBusy" @click="cancelDelete">Cancel</button>
              <button type="submit" class="delete-confirm-btn" :disabled="deleteBusy">
                {{ deleteBusy ? 'Deleting…' : 'Delete my account' }}
              </button>
            </div>
          </form>
        </section>
      </div>
      <ScrollToTop />
  </main>
</template>

<style scoped>
/* Delete account: red outline button, then a soft red box with the password form */
.delete-section { margin-top: 2rem; }
.delete-open-btn,
.delete-confirm-btn { padding: 0.45rem 1rem; border-radius: 999px; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
.delete-open-btn { border: 1px solid #e7c3bd; background: #fff; color: #a22f17; }
.delete-open-btn:hover { border-color: #a22f17; background: #fbe6df; }
.delete-confirm-btn { border: 0; background: #a22f17; color: #fff; }
.delete-confirm-btn:disabled { opacity: 0.6; cursor: default; }
.delete-form { display: grid; gap: 0.5rem; max-width: 460px; padding: 1rem 1.1rem; border: 1px solid #f0cfc8; border-radius: 12px; background: #fdf3f0; }
.delete-warning { margin: 0 0 0.25rem; color: #6e2a1c; font-size: 0.85rem; line-height: 1.5; }
.delete-form label { font-size: 0.8rem; font-weight: 600; }
.delete-form input { padding: 0.55rem 0.7rem; border: 1px solid #e3c4bd; border-radius: 8px; font: inherit; background: #fff; }
.delete-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.25rem; }
.profile-bio { margin: 1rem 0; }
.profile-bio > p { font-size: .85rem; line-height: 1.7; }
.bio-editor { margin: 1rem 0; text-align: left; }
.bio-editor label { font-size: .8rem; display: block; margin-bottom: .5rem; }
.bio-editor label span { color: var(--muted); }
.bio-editor textarea { width: 100%; border: 1px solid var(--color-border-hover); border-radius: 8px; padding: .65rem; font: inherit; font-size: .85rem; resize: vertical; }
.public-profile-link { display: block; margin-top: 1rem; font-size: .75rem; color: var(--accent); }
.profile-page {
  display: grid;
  grid-template-columns: 235px minmax(0, 1fr);
  margin: 2.5rem auto 5rem;
  max-width: 1160px;
}
.profile-sidebar {
  position: sticky;
  top: 1rem;
  align-self: start;
  max-height: calc(100dvh - 2rem);
  overflow-y: auto;
  padding: 1.5rem 2rem 0 0;
  border-right: 1px solid var(--color-border);
}
.profile-page :deep(section[id]) {
  scroll-margin-top: var(--profile-scroll-offset, 32px);
}
.eyebrow {
  font-size: 0.64rem;
  letter-spacing: 0.15em;
  margin-bottom: 0.75rem;
}
h1 {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-heading);
  margin: 0 0 2rem;
}
.profile-sidebar nav {
  display: grid;
  gap: 0.4rem;
}
.profile-sidebar nav a {
  display: flex;
  gap: 0.85rem;
  align-items: center;
  padding: 0.9rem 1rem;
  border-radius: 10px;
  color: var(--color-text);
  font-size: 0.9rem;
  font-weight: 500;
  text-decoration: none;
}
.profile-sidebar nav a .nav-icon {
  font-size: 1.2rem;
  color: var(--accent);
}
.profile-sidebar nav a .nav-short {
  display: none; /* only shown on phones */
}
.profile-sidebar nav a.selected {
  background: #eeeeec;
  color: var(--color-heading);
}
.profile-sidebar nav a:hover:not(.selected) {
  background: var(--color-background-soft);
}

/* Sidebar Badges Showcase */
.sidebar-badges-section {
  margin-top: 1.75rem;
  padding: 1.25rem 0.5rem 0;
  border-top: 1px solid var(--color-border);
}

.sidebar-badges-title {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--muted);
  margin-bottom: 0.75rem;
}

.sidebar-badges-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.sidebar-badge-item {
  width: 48px;
  height: 48px;
  flex: 0 0 48px;
  border-radius: 50%;
  background: rgba(34, 197, 94, 0.1);
  border: 1.5px solid rgba(34, 197, 94, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.sidebar-badge-item:hover {
  transform: scale(1.15);
  box-shadow: 0 4px 10px rgba(34, 197, 94, 0.25);
  border-color: rgba(34, 197, 94, 0.8);
}

/* Bottom Profile Badges Section */
.profile-badges-content-section {
  border-top: 1px solid var(--color-border);
  padding-top: 2rem;
  margin-top: 2rem;
}

.profile-completed-badges-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr));
  gap: 1rem;
  margin-top: 1.25rem;
}

.profile-completed-badge-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: white;
  border: 1.5px solid rgba(74, 222, 128, 0.35);
  border-radius: 14px;
  box-shadow: 0 4px 12px rgba(20, 83, 45, 0.04);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.profile-completed-badge-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(20, 83, 45, 0.08);
}

.profile-badge-icon-wrap {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(34, 197, 94, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.profile-badge-icon {
  font-size: 1.4rem;
}

.profile-badge-check {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #22c55e;
  color: white;
  font-size: 0.65rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid white;
}

.empty-badges-subtitle {
  color: var(--muted);
  font-size: 0.95rem;
  margin-top: 0.25rem;
}

.empty-badges-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1.25rem;
  margin-top: 1.25rem;
  padding: 1.25rem 1.5rem;
  background: rgba(47, 125, 74, 0.05);
  border: 1.5px dashed rgba(47, 125, 74, 0.3);
  border-radius: 14px;
}

.empty-badges-icon {
  font-size: 2.2rem;
  flex-shrink: 0;
}

.empty-badges-info {
  flex: 1 1 160px;
  min-width: 0;
}

.empty-badges-info h4 {
  margin: 0 0 0.25rem;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-heading);
}

.empty-badges-info p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--muted);
  line-height: 1.4;
}

.empty-badges-btn {
  flex-shrink: 0;
  background: white;
  border: 1px solid rgba(47, 125, 74, 0.3);
  color: var(--color-heading);
}

.empty-badges-btn:hover {
  background: var(--accent-soft);
  color: var(--color-heading);
}

.profile-badge-meta h4 {
  margin: 0 0 0.2rem;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--color-heading);
}

.profile-badge-meta p {
  margin: 0;
  font-size: 0.78rem;
  color: var(--muted);
  line-height: 1.35;
}

.sidebar-note {
  border-top: 1px solid var(--color-border);
  padding: 1.5rem 0.75rem 0;
  margin-top: 3.5rem;
}
.sidebar-note .leaf {
  font-size: 2rem;
  color: var(--accent);
}
.sidebar-note p {
  font-weight: 600;
  font-size: 0.85rem;
  margin: 0.25rem 0 0.5rem;
  color: var(--color-heading);
}
.sidebar-note > span:last-child {
  font-size: 0.8rem;
  color: var(--muted);
  line-height: 1.7;
  display: block;
}

.profile-content {
  padding: 1.5rem 0 0 clamp(1.5rem, 5vw, 4.5rem);
  min-width: 0;
}
h2 {
  font-size: 1.55rem;
  color: var(--color-heading);
  font-weight: 600;
  margin: 0;
}
.about-layout {
  display: grid;
  grid-template-columns: minmax(230px, 0.95fr) 1fr;
  gap: clamp(1.5rem, 4vw, 3rem);
  margin: 1.75rem 0 2.75rem;
  align-items: center;
}
.identity-card {
  box-shadow: 0 7px 28px rgba(20, 83, 45, 0.08);
  padding: 2rem 1.25rem 1.5rem;
  min-width: 0;
}
.identity-card h3 {
  font-size: 1.65rem;
  font-weight: 650;
  margin: 1rem 0 0.25rem;
}
.member-label {
  font-size: 0.82rem;
  margin: 0 0 1rem;
}
.photo-picker {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.8rem;
  border: 1px solid var(--color-border-hover);
  border-radius: 30px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}
.photo-picker[aria-disabled='true'] {
  opacity: 0.5;
  cursor: wait;
}
.file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.photo-picker:has(+ .file-input:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
.photo-hint {
  color: var(--muted);
  font-size: 0.67rem;
  margin: 0.5rem 0 0;
}
.photo-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  margin-top: 1rem;
}
.community-tag {
  color: var(--accent);
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  font-weight: 700;
}
.intro h3 {
  font-size: 1.4rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-heading);
  margin: 0.75rem 0;
}
.intro > p {
  color: var(--muted);
  font-size: 0.86rem;
  line-height: 1.8;
}
.account-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  margin: 1.5rem 0 0;
  padding-top: 1.2rem;
  border-top: 1px solid var(--color-border);
}
.account-summary dt {
  font-size: 0.7rem;
}
.account-summary dd {
  font-size: 1rem;
  margin: 0.3rem 0 0;
}
.account-summary dd span {
  font-size: 0.75rem;
  font-weight: 400;
}
.details-section {
  border-top: 1px solid var(--color-border);
  padding: 1.8rem 0 2rem;
  scroll-margin-top: 1.5rem;
}
.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.7rem;
}
.section-heading h2 {
  font-size: 1.15rem;
}
.section-heading p {
  margin: 0.4rem 0 0;
  color: var(--muted);
  font-size: 0.8rem;
}
.edit-button {
  background: var(--accent-soft);
  color: var(--color-heading);
  border: 0;
  padding: 0.5rem 0.75rem;
  border-radius: 7px;
  white-space: nowrap;
  font-size: 0.78rem;
  font-weight: 600;
}
.edit-button span {
  margin-left: 0.4rem;
}
.fields-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.4rem;
}
.address-grid {
  grid-template-columns: 1fr 1fr 1fr;
}
.field {
  min-width: 0;
}
.field label {
  font-size: 0.78rem;
  color: var(--muted);
  display: block;
  margin-bottom: 0.45rem;
}
.detail-value {
  margin: 0;
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}
.field input {
  width: 100%;
  border: 1px solid var(--color-border-hover);
  padding: 0.7rem;
  min-height: 44px;
  border-radius: 8px;
  font: inherit;
  font-size: 0.9rem;
  background: var(--surface);
  color: var(--color-text);
}
.field input[aria-invalid='true'] {
  border-color: var(--danger);
}
.photo-picker:focus-within {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
.private-tag {
  font-size: 0.65rem;
  color: var(--muted);
  background: var(--color-background-soft);
  padding: 0.4rem 0.65rem;
  border-radius: 20px;
  white-space: nowrap;
}
.privacy-note {
  font-size: 0.72rem;
  color: var(--muted);
  margin: 1.5rem 0 0;
  line-height: 1.7;
}
.form-actions {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  justify-content: flex-end;
  padding-top: 0.5rem;
}
.text-button {
  padding: 0.4rem 0;
  background: none;
  border: 0;
  text-decoration: underline;
  font-size: 0.85rem;
  color: var(--color-text);
}
.field-error {
  color: var(--danger);
  font-size: 0.75rem;
  margin: 0.4rem 0 0;
}
/* OneMap check result under the postal code box */
.postal-status {
  color: var(--muted);
  font-size: 0.75rem;
  margin: 0.4rem 0 0;
}
.postal-status.ok { color: var(--accent); }
.postal-status.notfound,
.postal-status.error { color: var(--danger); }
/* Block filled in from OneMap: greyed so it reads as automatic */
input[readonly] {
  opacity: 0.75;
  cursor: default;
}
.feedback {
  padding: 0.85rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  margin-bottom: 1rem;
}
.feedback.error {
  color: var(--danger);
  background: var(--danger-soft);
}
.feedback.success {
  color: var(--color-heading);
  background: var(--accent-soft);
}
@media (max-width: 950px) {
  .profile-page {
    grid-template-columns: 190px minmax(0, 1fr);
  }
  .profile-sidebar {
    padding-right: 1rem;
  }
  .about-layout {
    grid-template-columns: 1fr;
  }
  /* Stacked layout: the card fills the column (a 340px cap left an empty gap beside it) */
  .identity-card {
    max-width: none;
    width: 100%;
  }
  .intro h3 br {
    display: none;
  }
}
@media (max-width: 600px) {
  .profile-page {
    display: block;
    margin-top: 0;
    /* the app already leaves 4rem at the bottom on phones for the floating buttons */
    margin-bottom: 0;
  }
  .delete-section {
    padding-bottom: 0.5rem;
  }
  .profile-sidebar {
    position: static;
    max-height: none;
    overflow: visible;
    top: 0;
    z-index: 10;
    padding: 0 0 1rem;
    background: transparent;
    border-right: 0;
    border-bottom: 1px solid var(--color-border);
  }
  .profile-sidebar h1 {
    margin-bottom: 0.75rem;
    font-size: 1.8rem;
  }
  /* Phones: 3 x 2 grid of tiles (icon on top, short label below), so all six fit */
  .profile-sidebar nav {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
  }
  .profile-sidebar nav a {
    flex-direction: column;
    justify-content: center;
    gap: 0.2rem;
    min-height: 60px;
    padding: 0.5rem 0.25rem;
    border: 1px solid var(--color-border);
    background: var(--surface);
    font-size: 0.8rem;
    text-align: center;
  }
  .profile-sidebar nav a .nav-icon {
    font-size: 1.1rem;
    line-height: 1;
  }
  .profile-sidebar nav a .nav-label {
    display: none;
  }
  .profile-sidebar nav a .nav-short {
    display: block;
  }
  .profile-sidebar > .eyebrow {
    display: none;
  }
  .profile-sidebar nav a.selected { background: var(--accent-soft); border-color: var(--accent); }
  .sidebar-note, .sidebar-badges-section, .about-section > .eyebrow { display: none; }
  .profile-content {
    padding: 1rem 0 0;
  }
  .about-layout {
    gap: 1rem;
    margin: 0.75rem 0 1.5rem;
  }
  .identity-card {
    max-width: none;
    padding: 1.25rem 1rem;
  }
  .identity-card :deep(.user-avatar) { width: 80px !important; height: 80px !important; font-size: 30px !important; }
  .identity-card h3 { margin-top: 0.6rem; font-size: 1.4rem; }
  .intro h3 { font-size: 1.15rem; }
  .section-heading { flex-wrap: wrap; gap: 0.75rem; }
  .fields-grid {
    grid-template-columns: 1fr;
  }
  .address-grid {
    grid-template-columns: 1fr 1fr;
  }
  .section-heading {
    align-items: flex-start;
  }
}
</style>
