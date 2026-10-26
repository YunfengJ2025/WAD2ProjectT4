<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import UserAvatar from '@/components/user/UserAvatar.vue'
import ProfileReviews from '@/components/user/ProfileReviews.vue'

const auth = useAuthStore()
const { user } = storeToRefs(auth)
const editing = ref(false)
const saving = ref(false)
const uploading = ref(false)
const error = ref('')
const errors = ref({})
const success = ref('')
const form = ref({})
const photo = ref(null)
const preview = ref('')
const photoInput = ref(null)
const busy = computed(() => saving.value || uploading.value)
const avatarUser = computed(() => ({ ...user.value, photoUrl: preview.value || user.value?.photoUrl }))
const memberSince = computed(() => user.value?.createdAt
  ? new Date(user.value.createdAt).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' }) : '')
const fields = [
  { key: 'userName', label: 'Username', autocomplete: 'username', max: 30 },
  { key: 'email', label: 'Email address', type: 'email', autocomplete: 'email' },
  { key: 'block', label: 'Block', placeholder: 'e.g. 123A' },
  { key: 'unitNumber', label: 'Unit number', placeholder: 'e.g. #05-12' },
  { key: 'postalCode', label: 'Postal code', autocomplete: 'postal-code', max: 6 },
]

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
  if (form.value.userName.length < 3 || form.value.userName.length > 30) errors.value.userName = 'Use 3 to 30 characters.'
  if (!/^\S+@\S+\.\S+$/.test(form.value.email)) errors.value.email = 'Enter a valid email address.'
  if (!/^\d{6}$/.test(form.value.postalCode)) errors.value.postalCode = 'Enter a 6-digit postal code.'
  if (Object.keys(errors.value).length) { error.value = 'Please check the highlighted fields.'; return }
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
  <main v-if="user" class="profile-page">
    <aside class="profile-sidebar">
      <p class="eyebrow">YOUR LITTLE GREEN CORNER</p>
      <h1>Profile</h1>
      <nav aria-label="Profile sections">
        <a href="#about-me" class="selected"><span aria-hidden="true">◉</span> About me</a>
        <a href="#personal-details"><span aria-hidden="true">☷</span> Personal details</a>
        <a href="#address"><span aria-hidden="true">⌂</span> My address</a>
      </nav>
      <div class="sidebar-note">
        <svg class="leaf" width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M7 25C5 13 13 6 26 5c1 13-7 20-19 20Zm0 0L22 10" /></svg>
        <p>A little care goes a long way.</p>
        <span>Make yourself at home in your plant-loving community.</span>
      </div>
    </aside>

    <div class="profile-content">
      <section id="about-me" class="about-section">
        <p class="eyebrow">NICE TO SEE YOU HERE</p>
        <h2>About me</h2>
        <div class="about-layout">
          <div class="identity-card">
            <div class="avatar-wrap"><UserAvatar :user="avatarUser" :size="116" /></div>
            <h3>{{ user.userName }}</h3>
            <p class="member-label">Plant-loving neighbour</p>
            <label class="photo-picker" for="profile-photo" :aria-disabled="busy">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M8 5 9.5 3h5L16 5h4v15H4V5Z" /><circle cx="12" cy="12" r="4" /></svg>
              {{ user.photoUrl ? 'Change photo' : 'Add a photo' }}
            </label>
            <input id="profile-photo" ref="photoInput" class="file-input" type="file" accept="image/jpeg,image/png,image/webp" :disabled="busy" :aria-describedby="errors.photo ? 'photo-hint photo-error' : 'photo-hint'" @change="choosePhoto" />
            <p id="photo-hint" class="photo-hint">JPG, PNG or WebP · Up to 2MB</p>
            <p v-if="errors.photo" id="photo-error" class="field-error" role="alert">{{ errors.photo }}</p>
            <div v-if="photo" class="photo-actions">
              <button type="button" class="btn btn-primary" :disabled="busy" @click="savePhoto">{{ uploading ? 'Uploading…' : 'Save photo' }}</button>
              <button type="button" class="text-button" :disabled="busy" @click="clearPhoto">Cancel</button>
            </div>
          </div>
          <div class="intro">
            <span class="community-tag">ROOTED IN COMMUNITY</span>
            <h3>A greener neighbourhood <br />starts with you.</h3>
            <p>Keep your profile up to date so your neighbours know who is caring for their plants.</p>
            <dl class="account-summary">
              <div><dt>Community tokens</dt><dd>{{ user.tokenBalance ?? 0 }} <span>tokens</span></dd></div>
              <div v-if="memberSince"><dt>Member since</dt><dd>{{ memberSince }}</dd></div>
            </dl>
          </div>
        </div>
      </section>

      <p v-if="error" class="feedback error" role="alert">{{ error }}</p>
      <p v-if="success" class="feedback success" role="status">{{ success }}</p>

      <form novalidate :aria-busy="saving" @submit.prevent="save">
        <section id="personal-details" class="details-section">
          <div class="section-heading">
            <div><h2>Personal details</h2><p>A familiar name for your neighbours.</p></div>
            <button v-if="!editing" type="button" class="edit-button" :disabled="busy" @click="startEditing">Edit details <span aria-hidden="true">↗</span></button>
          </div>
          <div class="fields-grid">
            <div v-for="field in fields.slice(0, 2)" :key="field.key" class="field">
              <label :for="field.key">{{ field.label }}</label>
              <template v-if="editing">
                <input :id="field.key" v-model="form[field.key]" :type="field.type || 'text'" :autocomplete="field.autocomplete" :maxlength="field.max" :disabled="busy" required :aria-invalid="!!errors[field.key]" :aria-describedby="errors[field.key] ? field.key + '-error' : undefined" />
                <p v-if="errors[field.key]" :id="field.key + '-error'" class="field-error">{{ errors[field.key] }}</p>
              </template>
              <p v-else class="detail-value">{{ user[field.key] || 'Not added yet' }}</p>
            </div>
          </div>
        </section>

        <section id="address" class="details-section address-section">
          <div class="section-heading"><div><h2>My address</h2><p>Your home base for nearby plant care.</p></div><span class="private-tag">Private details</span></div>
          <div class="fields-grid address-grid">
            <div v-for="field in fields.slice(2)" :key="field.key" class="field">
              <label :for="field.key">{{ field.label }}</label>
              <template v-if="editing">
                <input :id="field.key" v-model="form[field.key]" :placeholder="field.placeholder" :autocomplete="field.autocomplete" :maxlength="field.max" :inputmode="field.key === 'postalCode' ? 'numeric' : 'text'" :disabled="busy" required :aria-invalid="!!errors[field.key]" :aria-describedby="errors[field.key] ? field.key + '-error' : undefined" />
                <p v-if="errors[field.key]" :id="field.key + '-error'" class="field-error">{{ errors[field.key] }}</p>
              </template>
              <p v-else class="detail-value">{{ user[field.key] || 'Not added yet' }}</p>
            </div>
          </div>
          <p class="privacy-note">Your address is kept out of your profile card. It helps arrange care close to home.</p>
        </section>
        <div v-if="editing" class="form-actions">
          <button type="button" class="text-button" :disabled="busy" @click="cancelEditing">Cancel</button>
          <button type="submit" class="btn btn-primary" :disabled="busy">{{ saving ? 'Saving…' : 'Save changes' }}</button>
        </div>
      </form>
      <ProfileReviews />
    </div>
  </main>
</template>

<style scoped>
.profile-page { display: grid; grid-template-columns: 235px minmax(0, 1fr); margin: 2.5rem auto 5rem; max-width: 1160px; color: var(--color-text); }
.profile-sidebar { padding: 1.5rem 2rem 0 0; border-right: 1px solid var(--color-border); }
.eyebrow { font-size: .64rem; font-weight: 700; letter-spacing: .15em; color: var(--muted); margin-bottom: .75rem; }
h1 { font-size: 2rem; font-weight: 700; color: var(--color-heading); margin: 0 0 2rem; }
.profile-sidebar nav { display: grid; gap: .4rem; }
.profile-sidebar nav a { display: flex; gap: .85rem; align-items: center; padding: .9rem 1rem; border-radius: 10px; color: var(--color-text); font-size: .9rem; font-weight: 500; text-decoration: none; }
.profile-sidebar nav a span { font-size: 1.2rem; color: var(--accent); }
.profile-sidebar nav a.selected, .profile-sidebar nav a:hover { background: var(--accent-soft); color: var(--color-heading); }
.sidebar-note { border-top: 1px solid var(--color-border); padding: 1.5rem .75rem 0; margin-top: 3.5rem; }
.sidebar-note .leaf { font-size: 2rem; color: var(--accent); }
.sidebar-note p { font-weight: 600; font-size: .85rem; margin: .25rem 0 .5rem; color: var(--color-heading); }
.sidebar-note > span:last-child { font-size: .8rem; color: var(--muted); line-height: 1.7; display: block; }
.profile-content { padding: 1.5rem 0 0 clamp(1.5rem, 5vw, 4.5rem); min-width: 0; }
h2 { font-size: 1.55rem; color: var(--color-heading); font-weight: 600; margin: 0; }
.about-layout { display: grid; grid-template-columns: minmax(230px, .95fr) 1fr; gap: clamp(1.5rem, 4vw, 3rem); margin: 1.75rem 0 2.75rem; align-items: center; }
.identity-card { text-align: center; border: 1px solid var(--color-border); border-radius: 22px; background: var(--surface); box-shadow: 0 7px 28px rgba(20, 83, 45, .08); padding: 2rem 1.25rem 1.5rem; min-width: 0; }
.identity-card h3 { font-size: 1.65rem; font-weight: 650; color: var(--color-heading); margin: 1rem 0 .25rem; overflow-wrap: anywhere; }
.member-label { font-size: .82rem; color: var(--muted); margin: 0 0 1rem; }
.photo-picker { display: inline-flex; align-items: center; gap: .45rem; padding: .45rem .8rem; border: 1px solid var(--color-border-hover); border-radius: 30px; font-size: .8rem; font-weight: 600; cursor: pointer; }
.photo-picker[aria-disabled='true'] { opacity: .5; cursor: wait; }
.file-input { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.photo-picker:has(+ .file-input:focus-visible) { outline: 2px solid var(--accent); outline-offset: 3px; }
.photo-hint { color: var(--muted); font-size: .67rem; margin: .5rem 0 0; }
.photo-actions { display: flex; align-items: center; justify-content: center; gap: .8rem; margin-top: 1rem; }
.community-tag { color: var(--accent); font-size: .62rem; letter-spacing: .12em; font-weight: 700; }
.intro h3 { font-size: 1.4rem; font-weight: 600; line-height: 1.4; color: var(--color-heading); margin: .75rem 0; }
.intro > p { color: var(--muted); font-size: .86rem; line-height: 1.8; }
.account-summary { display: flex; flex-wrap: wrap; gap: 1.25rem; margin: 1.5rem 0 0; padding-top: 1.2rem; border-top: 1px solid var(--color-border); }
.account-summary dt { font-size: .7rem; color: var(--muted); font-weight: 400; }
.account-summary dd { font-size: 1rem; font-weight: 600; color: var(--color-heading); margin: .3rem 0 0; }
.account-summary dd span { font-size: .75rem; font-weight: 400; }
.details-section { border-top: 1px solid var(--color-border); padding: 1.8rem 0 2rem; scroll-margin-top: 1.5rem; }
.section-heading { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1.7rem; }
.section-heading h2 { font-size: 1.15rem; }
.section-heading p { margin: .4rem 0 0; color: var(--muted); font-size: .8rem; }
.edit-button { background: var(--accent-soft); color: var(--color-heading); border: 0; padding: .5rem .75rem; border-radius: 7px; white-space: nowrap; font-size: .78rem; font-weight: 600; }
.edit-button span { margin-left: .4rem; }
.fields-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.4rem; }
.address-grid { grid-template-columns: 1fr 1fr 1fr; }
.field { min-width: 0; }
.field label { font-size: .78rem; color: var(--muted); display: block; margin-bottom: .45rem; }
.detail-value { margin: 0; font-size: .9rem; overflow-wrap: anywhere; }
.field input { width: 100%; border: 1px solid var(--color-border-hover); padding: .7rem; min-height: 44px; border-radius: 8px; font: inherit; font-size: .9rem; background: var(--surface); color: var(--color-text); }
.field input[aria-invalid='true'] { border-color: var(--danger); }
input:focus-visible, button:focus-visible, a:focus-visible, .photo-picker:focus-within { outline: 2px solid var(--accent); outline-offset: 3px; }
.private-tag { font-size: .65rem; color: var(--muted); background: var(--color-background-soft); padding: .4rem .65rem; border-radius: 20px; white-space: nowrap; }
.privacy-note { font-size: .72rem; color: var(--muted); margin: 1.5rem 0 0; line-height: 1.7; }
.form-actions { display: flex; gap: 1.5rem; align-items: center; justify-content: flex-end; padding-top: .5rem; }
.text-button { padding: .4rem 0; background: none; border: 0; text-decoration: underline; font-size: .85rem; color: var(--color-text); }
.field-error { color: var(--danger); font-size: .75rem; margin: .4rem 0 0; }
.feedback { padding: .85rem 1rem; border-radius: 8px; font-size: .85rem; margin-bottom: 1rem; }
.feedback.error { color: var(--danger); background: var(--danger-soft); }
.feedback.success { color: var(--color-heading); background: var(--accent-soft); }
@media (max-width: 950px) { .profile-page { grid-template-columns: 190px minmax(0, 1fr); } .profile-sidebar { padding-right: 1rem; } .about-layout { grid-template-columns: 1fr; } .identity-card { max-width: 340px; width: 100%; } .intro h3 br { display: none; } }
@media (max-width: 600px) { .profile-page { display: block; margin-top: 1rem; } .profile-sidebar { padding: 0 0 1.25rem; border-right: 0; border-bottom: 1px solid var(--color-border); } .profile-sidebar h1 { margin-bottom: 1rem; } .profile-sidebar nav { display: grid; grid-template-columns: repeat(3, 1fr); gap: .25rem; } .profile-sidebar nav a { padding: .6rem .3rem; justify-content: center; white-space: nowrap; font-size: .7rem; } .profile-sidebar nav a span { display: none; } .sidebar-note, .profile-sidebar > .eyebrow { display: none; } .profile-content { padding: 1.75rem 0 0; } .about-layout { gap: 1.75rem; margin-bottom: 2rem; } .identity-card { max-width: none; } .fields-grid { grid-template-columns: 1fr; } .address-grid { grid-template-columns: 1fr 1fr; } .section-heading { align-items: flex-start; } }
</style>
