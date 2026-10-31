<script setup>
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const error = ref('')
onMounted(async () => {
  // Refresh on entry so reservations changed on another page are reflected here.
  try {
    await auth.refreshUser()
  } catch (err) {
    error.value = err.message
  }
})
</script>

<template>
  <div class="token-balances" aria-label="Token balances">
    <span
      >Total: <strong>{{ auth.user?.tokenBalance ?? 0 }}</strong> tokens</span
    >
    <span
      >Available:
      <strong>{{ auth.user?.availableTokenBalance ?? auth.user?.tokenBalance ?? 0 }}</strong></span
    >
    <!-- A focusable button exposes the same reservation details to keyboard and touch users. -->
    <div class="frozen-details">
      <button type="button" aria-describedby="frozen-token-reasons">
        Frozen: <strong>{{ auth.user?.frozenTokenBalance ?? 0 }}</strong> ⓘ
      </button>
      <div id="frozen-token-reasons" class="frozen-card" role="tooltip">
        <strong>Frozen for care requests</strong>
        <ul v-if="auth.user?.tokenReservations?.length">
          <li v-for="item in auth.user.tokenReservations" :key="item.requestId">
            {{ item.amount }} tokens frozen for care request #{{ item.requestId }}
          </li>
        </ul>
        <p v-else>No tokens are frozen.</p>
      </div>
    </div>
    <small v-if="error" role="alert">Could not refresh balances: {{ error }}</small>
  </div>
</template>

<style scoped>
.token-balances {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1rem;
  font-size: 0.95rem;
}
.frozen-details {
  position: relative;
}
.frozen-details button {
  background: transparent;
  color: inherit;
  border: 0;
  border-bottom: 1px dotted currentColor;
  padding: 0.25rem 0;
  font: inherit;
  cursor: help;
}
.frozen-card {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 20;
  width: min(300px, 75vw);
  padding: 1rem;
  border: 1px solid #b9c7bb;
  border-radius: 0.6rem;
  background: #fff;
  color: #243b2a;
  box-shadow: 0 6px 20px #0002;
}
/* Keep the card open while the pointer or keyboard focus remains inside the wrapper. */
.frozen-details:hover .frozen-card,
.frozen-details:focus-within .frozen-card {
  display: block;
}
.frozen-card ul {
  padding-left: 1.1rem;
  margin: 0.5rem 0 0;
}
.frozen-card li + li {
  margin-top: 0.5rem;
}
.frozen-card p {
  margin: 0.5rem 0 0;
}
</style>
