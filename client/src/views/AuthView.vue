<script setup>
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import logo from '@/assets/Leaf It to Us Logo.png'

// AuthView: ONE page for both sign in (/signin) and create account (/register).
// The router passes createAccount: true on /register (props in router/index.js),
// and v-if in the template shows the extra fields (username + address) only then.
const props = defineProps({ createAccount: Boolean })
const router = useRouter()
// One ref per input box, linked with v-model
const userName = ref('')
const email = ref('')
const password = ref('')
const postalCode = ref('')
const block = ref('')
const unitNumber = ref('')
// The auth store (Pinia) does the actual login/register request and keeps the user + token.
// storeToRefs: take `error` and `submitting` out of the store but keep them reactive,
// so error.value = '' changes the store's error too.
const auth = useAuthStore()
const { error, submitting } = storeToRefs(auth)
const route = useRoute()
error.value = '' // clear any old error when the page opens

// Runs on form submit (@submit.prevent stops the page reloading)
async function submit() {
  if (submitting.value) return
  error.value = ''
  try {
    const credentials = { email: email.value.trim(), password: password.value }
    // Creating an account also needs the username and address
    if (props.createAccount) {
      credentials.userName = userName.value.trim()
      credentials.postalCode = postalCode.value.trim()
      credentials.block = block.value.trim()
      credentials.unitNumber = unitNumber.value.trim()
    }
    if (props.createAccount) await auth.register(credentials)
    else await auth.login(credentials)
    // "Redirect back after login" (Week 11): the route guard sent the user here as
    // /signin?redirect=/plants/5, so after logging in we go back to /plants/5.
    // Only follow it if it's a page inside our app (starts with one "/") that needs
    // login; otherwise go to /schedule. This stops links sending users to other websites.
    const redirect = route.query.redirect
    const destination =
      typeof redirect === 'string' &&
      redirect.startsWith('/') &&
      !redirect.startsWith('//') &&
      router.resolve(redirect).meta.requiresAuth
        ? redirect
        : '/schedule'
    await router.push(destination)
  } catch {
    // The store exposes the API error to the form.
  }
}
</script>

<template>
  <main class="auth-page">
    <!-- White card in the middle of the screen, logo on top -->
    <div class="auth-card">
      <div class="auth-head">
        <img :src="logo" alt="Leaf It to Us" class="auth-logo" />
        <h1>{{ createAccount ? 'Create your account' : 'Welcome back 🌱' }}</h1>
        <p class="auth-sub">
          {{
            createAccount
              ? 'Join your neighbours and start your digital garden.'
              : 'Sign in to check on your plants.'
          }}
        </p>
      </div>

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <form @submit.prevent="submit" :aria-busy="submitting">
        <fieldset :disabled="submitting">
          <div v-if="createAccount" class="field">
            <label for="username">Username</label>
            <input
              id="username"
              v-model="userName"
              name="username"
              autocomplete="username"
              required
              minlength="3"
              maxlength="30"
            />
          </div>
          <div class="field">
            <label for="email">Email</label>
            <input
              id="email"
              v-model="email"
              name="email"
              type="email"
              autocomplete="email"
              required
            />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input
              id="password"
              v-model="password"
              name="password"
              type="password"
              :autocomplete="createAccount ? 'new-password' : 'current-password'"
              :minlength="createAccount ? 8 : undefined"
              required
            />
          </div>
          <template v-if="createAccount">
            <div class="field">
              <label for="postal-code">Postal code</label>
              <input
                id="postal-code"
                v-model="postalCode"
                name="postal-code"
                autocomplete="postal-code"
                inputmode="numeric"
                pattern="\d{6}"
                maxlength="6"
                title="6-digit postal code"
                required
              />
            </div>
            <div class="address-row">
              <div class="field">
                <label for="block">Block</label>
                <input id="block" v-model="block" name="block" placeholder="e.g. 123A" required />
              </div>
              <div class="field">
                <label for="unit-number">Unit number</label>
                <input
                  id="unit-number"
                  v-model="unitNumber"
                  name="unit-number"
                  placeholder="e.g. #05-12"
                  required
                />
              </div>
            </div>
          </template>
          <button type="submit" class="btn btn-primary" :disabled="submitting">
            {{
              submitting
                ? createAccount
                  ? 'Creating account...'
                  : 'Signing in...'
                : createAccount
                  ? 'Create account'
                  : 'Sign in'
            }}
          </button>
        </fieldset>
      </form>

      <p class="switch-page">
        {{ createAccount ? 'Already have an account?' : "Don't have an account?" }}
        <RouterLink :to="createAccount ? '/signin' : '/register'">
          {{ createAccount ? 'Sign in' : 'Create account' }}
        </RouterLink>
      </p>
    </div>
  </main>
</template>

<style scoped>
/* Fills the screen and puts the card in the middle */
.auth-page {
  min-height: calc(100svh - 3rem);
  display: grid;
  place-items: center;
  padding-block: 2rem;
}

/* Same card style as the plant pages */
.auth-card {
  width: 100%;
  max-width: 440px;
  padding: 2rem;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
  /* Soft green shadow: a close one for the edge + a big blurry one so the card floats */
  box-shadow:
    0 2px 6px rgba(13, 51, 32, 0.08),
    0 18px 40px rgba(20, 128, 74, 0.18);
}

/* Logo, title and short line, centred */
.auth-head {
  margin: 0 0 1.5rem;
  text-align: center;
}

/* display: block + auto side margins = centred (Bootstrap makes images block, so text-align can't centre it) */
.auth-logo {
  display: block;
  height: 64px;
  width: auto;
  margin: 0 auto 0.75rem;
}

h1 {
  margin: 0 0 0.4rem;
  font-size: 26px;
  font-weight: 700;
  color: var(--color-heading);
}

.auth-sub {
  margin: 0;
  color: var(--muted);
}

.btn-primary {
  width: 100%;
  min-height: 46px;
  border-radius: 999px; /* capsule, same as the inputs */
}

/* Phones: less padding inside the card */
@media (max-width: 480px) {
  .auth-card {
    padding: 1.5rem 1.25rem;
  }

  .address-row {
    grid-template-columns: 1fr;
  }
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

.address-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

label {
  font-weight: 600;
}

input {
  width: 100%;
  min-width: 0;
  min-height: 46px;
  padding: 0.6rem 1.1rem; /* more side padding so text doesn't touch the round ends */
  border: 1px solid var(--color-border-hover);
  border-radius: 999px; /* capsule: big radius = fully round ends */
  background: var(--surface);
  color: var(--color-text);
  font: inherit;
}

input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.error {
  padding: 0.75rem 1.1rem;
  margin-bottom: 1.25rem;
  border-radius: 12px;
  overflow-wrap: anywhere;
}

.error {
  background: var(--danger-soft);
  color: var(--danger);
}

.switch-page {
  margin: 1.5rem 0 0;
  color: var(--muted);
  text-align: center;
}

.switch-page a {
  color: var(--accent);
  font-weight: 600;
}
</style>
