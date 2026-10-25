<script setup>
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({ createAccount: Boolean })
const router = useRouter()
const userName = ref('')
const email = ref('')
const password = ref('')
const auth = useAuthStore()
const { error, submitting } = storeToRefs(auth)
const route = useRoute()
error.value = ''

async function submit() {
  if (submitting.value) return
  error.value = ''
  try {
    const credentials = {
      ...(props.createAccount ? { userName: userName.value.trim() } : {}),
      email: email.value.trim(),
      password: password.value,
    }
    await (props.createAccount ? auth.register(credentials) : auth.login(credentials))
    const redirect = route.query.redirect
    await router.push(typeof redirect === 'string' && redirect.startsWith('/plants') ? redirect : '/plants')
  } catch {
    // The store exposes the API error to the form.
  }
}
</script>

<template>
  <main class="auth-page">
    <h1>{{ createAccount ? 'Create account' : 'Sign in' }}</h1>

    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <form @submit.prevent="submit" :aria-busy="submitting">
      <fieldset :disabled="submitting">
        <div v-if="createAccount" class="field">
          <label for="username">Username</label>
          <input id="username" v-model="userName" name="username" autocomplete="username"
            required minlength="3" maxlength="30" />
        </div>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" v-model="email" name="email" type="email" autocomplete="email" required />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" v-model="password" name="password" type="password"
            :autocomplete="createAccount ? 'new-password' : 'current-password'"
            :minlength="createAccount ? 8 : undefined" required />
        </div>
        <button type="submit" class="btn btn-primary" :disabled="submitting">
          {{ submitting ? (createAccount ? 'Creating account...' : 'Signing in...') :
            (createAccount ? 'Create account' : 'Sign in') }}
        </button>
      </fieldset>
    </form>

    <p class="switch-page">
      {{ createAccount ? 'Already have an account?' : "Don't have an account?" }}
      <RouterLink :to="createAccount ? '/signin' : '/register'">
        {{ createAccount ? 'Sign in' : 'Create account' }}
      </RouterLink>
    </p>
  </main>
</template>

<style scoped>
.auth-page {
  max-width: 400px;
  margin: 2rem auto;
}

h1 {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-heading);
  margin-bottom: 1.5rem;
}

fieldset {
  border: 0;
  padding: 0;
  min-width: 0;
  display: grid;
  gap: 1.25rem;
}

.field {
  display: grid;
  gap: 0.4rem;
}

label {
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

.error {
  padding: 0.75rem;
  margin-bottom: 1.25rem;
  border-radius: 6px;
  overflow-wrap: anywhere;
}

.error {
  background: var(--danger-soft);
  color: var(--danger);
}

.switch-page {
  margin-top: 1.5rem;
  color: var(--muted);
}

.switch-page a {
  color: var(--accent);
  font-weight: 600;
}
</style>
