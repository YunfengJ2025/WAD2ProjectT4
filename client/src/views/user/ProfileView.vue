<script setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const { user } = storeToRefs(auth)

const editing = ref(false)
const saving = ref(false)
const error = ref('')
// Copy of the user's details that the form edits, so Cancel throws changes away.
const form = ref({})

// Accounts made before the address fields were required may not have one.
const hasAddress = computed(() => user.value?.postalCode || user.value?.block || user.value?.unitNumber)

function startEditing() {
  form.value = {
    userName: user.value.userName || '',
    email: user.value.email || '',
    block: user.value.block || '',
    unitNumber: user.value.unitNumber || '',
    postalCode: user.value.postalCode || '',
  }
  error.value = ''
  editing.value = true
}

function cancelEditing() {
  editing.value = false
  error.value = ''
}

async function save() {
  if (saving.value) return
  saving.value = true
  error.value = ''
  try {
    await auth.updateProfile(form.value)
    editing.value = false
  } catch (err) {
    error.value = err.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <main class="profile-page">
    <header class="page-header">
      <h1>My profile</h1>
      <button v-if="user && !editing" type="button" class="btn btn-outline-secondary" @click="startEditing">
        Edit
      </button>
    </header>

    <template v-if="user && !editing">
      <section class="block">
        <h2>Account</h2>
        <div class="facts">
          <div>
            <p class="label">Username</p>
            <p class="value">{{ user.userName }}</p>
          </div>
          <div>
            <p class="label">Email</p>
            <p class="value">{{ user.email }}</p>
          </div>
        </div>
      </section>

      <section class="block">
        <h2>Address</h2>
        <div v-if="hasAddress" class="facts address">
          <div>
            <p class="label">Block</p>
            <p class="value">{{ user.block || '—' }}</p>
          </div>
          <div>
            <p class="label">Unit number</p>
            <p class="value">{{ user.unitNumber || '—' }}</p>
          </div>
          <div>
            <p class="label">Postal code</p>
            <p class="value">{{ user.postalCode || '—' }}</p>
          </div>
        </div>
        <p v-else class="muted">No address added yet.</p>
      </section>
    </template>

    <form v-else-if="user" @submit.prevent="save" :aria-busy="saving">
      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <fieldset :disabled="saving">
        <section class="block">
          <h2>Account</h2>
          <div class="fields">
            <div class="field">
              <label for="username">Username</label>
              <input id="username" v-model="form.userName" autocomplete="username"
                required minlength="3" maxlength="30" />
            </div>
            <div class="field">
              <label for="email">Email</label>
              <input id="email" v-model="form.email" type="email" autocomplete="email" required />
            </div>
          </div>
        </section>

        <section class="block">
          <h2>Address</h2>
          <div class="fields address">
            <div class="field">
              <label for="block">Block</label>
              <input id="block" v-model="form.block" placeholder="e.g. 123A" required />
            </div>
            <div class="field">
              <label for="unit-number">Unit number</label>
              <input id="unit-number" v-model="form.unitNumber" placeholder="e.g. #05-12" required />
            </div>
            <div class="field">
              <label for="postal-code">Postal code</label>
              <input id="postal-code" v-model="form.postalCode" autocomplete="postal-code" inputmode="numeric"
                pattern="\d{6}" maxlength="6" title="6-digit postal code" required />
            </div>
          </div>
        </section>

        <div class="actions">
          <button type="submit" class="btn btn-primary">{{ saving ? 'Saving...' : 'Save changes' }}</button>
          <button type="button" class="btn btn-outline-secondary" @click="cancelEditing">Cancel</button>
        </div>
      </fieldset>
    </form>
  </main>
</template>

<style scoped>
.profile-page {
  max-width: 640px;
  margin: 2rem auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

h1 {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-heading);
  margin: 0;
}

.block + .block {
  margin-top: 1.75rem;
}

.block h2 {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 0.6rem;
}

.facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-border);
  overflow: hidden;
}

/* Three fields in one row, so there's no empty cell. */
.facts.address,
.fields.address {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.facts > div {
  padding: 0.75rem 1rem;
  background: var(--surface);
}

.facts p {
  margin: 0;
}

.label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--muted);
}

.value {
  font-weight: 600;
  color: var(--color-heading);
  overflow-wrap: anywhere;
}

.muted {
  color: var(--muted);
}

/* Edit form — same input look as the sign-up page */
fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}

.fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.field {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
}

.field label {
  font-weight: 600;
}

input {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--color-border-hover);
  border-radius: 6px;
  background: var(--surface);
  color: var(--color-text);
  font: inherit;
}

input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.75rem;
}

.error {
  padding: 0.75rem;
  margin-bottom: 1.25rem;
  border-radius: 6px;
  background: var(--danger-soft);
  color: var(--danger);
  overflow-wrap: anywhere;
}

@media (max-width: 480px) {
  .facts,
  .facts.address,
  .fields,
  .fields.address {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
