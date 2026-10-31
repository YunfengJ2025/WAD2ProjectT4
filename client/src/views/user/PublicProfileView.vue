<script setup>
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePublicProfileStore } from '@/stores/publicProfile'
import UserAvatar from '@/components/user/UserAvatar.vue'
import ReviewCard from '@/components/review/ReviewCard.vue'
import StarRating from '@/components/review/StarRating.vue'
import '@/assets/profile.css'

const route = useRoute()
const router = useRouter()
function goBack() {
  if (router.options.history.state.back) router.back()
  else router.replace('/reviews')
}
const store = usePublicProfileStore()
watch(
  () => route.params.userId,
  (id) => store.fetchProfile(id),
  { immediate: true },
)
const joined = computed(() =>
  store.profile?.user.createdAt
    ? new Date(store.profile.user.createdAt).toLocaleDateString('en-SG', {
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Singapore',
      })
    : 'Not available',
)
const average = computed(() =>
  store.profile?.averageRating == null ? '—' : store.profile.averageRating.toFixed(1),
)
</script>

<template>
  <main class="public-profile profile-shell">
    <button type="button" class="back-link" @click="goBack">← Back</button>
    <p v-if="store.loading" class="state" role="status">Loading profile…</p>
    <div v-else-if="store.error" class="state" role="alert">
      <h1>We couldn't load this profile</h1>
      <p>{{ store.error }}</p>
      <button type="button" class="btn" @click="store.fetchProfile(route.params.userId)">
        Try again
      </button>
    </div>
    <template v-else-if="store.profile">
      <header class="page-heading">
        <p class="eyebrow">YOUR PLANT-LOVING COMMUNITY</p>
        <h1>Meet {{ store.profile.user.userName }}</h1>
      </header>
      <div class="profile-layout">
        <aside class="public-identity profile-identity-card">
          <UserAvatar :user="store.profile.user" :size="128" />
          <h2 class="profile-name">{{ store.profile.user.userName }}</h2>
          <p class="member-label">Plant-loving neighbour</p>
          <p v-if="store.profile.user.bio" class="bio profile-bio-text">{{ store.profile.user.bio }}</p>
          <p v-else class="no-bio">This neighbour hasn't added a bio yet.</p>
          <dl class="joined profile-meta">
            <dt>Member since</dt>
            <dd>{{ joined }}</dd>
          </dl>
        </aside>
        <div class="public-feedback">
          <section class="rating-summary" aria-label="Care visit rating">
            <div>
              <p class="eyebrow">A LITTLE COMMUNITY LOVE</p>
              <strong class="average">{{ average }}</strong
              ><span class="out-of"> / 5</span>
              <StarRating
                v-if="store.profile.averageRating !== null"
                :model-value="store.profile.averageRating"
                readonly
              />
              <p v-else class="no-bio">No ratings yet</p>
            </div>
            <div class="review-count">
              <strong>{{ store.profile.reviewCount }}</strong
              ><span>visit {{ store.profile.reviewCount === 1 ? 'review' : 'reviews' }}</span>
            </div>
          </section>
          <section aria-labelledby="public-reviews-heading">
            <div class="reviews-heading">
              <h2 id="public-reviews-heading">Reviews from neighbours</h2>
              <p>Feedback from care visits with {{ store.profile.user.userName }}.</p>
            </div>
            <p v-if="!store.profile.reviews.length" class="state">
              No care visit reviews yet. Their community story is just beginning.
            </p>
            <ul v-else class="public-review-list">
              <li v-for="review in store.profile.reviews" :key="review.reviewId">
                <ReviewCard source="profile" :review="review" />
              </li>
            </ul>
          </section>
        </div>
      </div>
    </template>
  </main>
</template>

<style scoped>
.public-profile {
  max-width: 1060px;
}
.back-link {
  background: none;
  border: 0;
  padding: 0;
  text-decoration: underline;
  color: var(--muted);
  font-size: 0.85rem;
}
.page-heading {
  margin: 2rem 0;
}
.eyebrow {
  font-size: 0.65rem;
  letter-spacing: 0.13em;
  margin: 0 0 0.65rem;
}
h1 {
  font-size: clamp(1.7rem, 4vw, 2.2rem);
  color: var(--color-heading);
  font-weight: 650;
  overflow-wrap: anywhere;
}
.profile-layout {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 3rem;
  align-items: start;
}
.public-identity {
  box-shadow: var(--shadow);
  padding: 2rem 1.5rem;
  position: sticky;
  top: 1.5rem;
}
.public-identity h2 {
  font-size: 1.6rem;
  font-weight: 600;
  margin: 1.2rem 0 0.3rem;
}
.no-bio {
  color: var(--muted);
  font-size: 0.8rem;
}
.member-label { font-size: 0.8rem; }
.bio {
  font-size: 0.9rem;
  line-height: 1.8;
  margin: 1.5rem 0;
}
.joined {
  border-top: 1px solid var(--color-border);
  padding-top: 1.25rem;
  margin: 1.5rem 0 0;
}
.joined dt {
  font-size: 0.75rem;
}
.joined dd {
  font-size: 0.9rem;
  margin: 0.35rem 0 0;
}
.public-feedback {
  min-width: 0;
}
.rating-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;
  padding: 1.75rem;
  background: var(--surface);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  margin-bottom: 2rem;
}
.average {
  font-size: 2.8rem;
  color: var(--color-heading);
}
.out-of {
  color: var(--muted);
  font-size: 0.9rem;
  margin-right: 1rem;
}
.review-count {
  display: grid;
  text-align: center;
  gap: 0.3rem;
  border-left: 1px solid var(--color-border);
  padding-left: 1.5rem;
}
.review-count strong {
  font-size: 1.6rem;
  color: var(--color-heading);
}
.review-count span,
.reviews-heading p {
  font-size: 0.8rem;
  color: var(--muted);
}
.reviews-heading h2 {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--color-heading);
}
.reviews-heading {
  margin-bottom: 1.5rem;
}
.public-review-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 1rem;
}
.state {
  padding: 1.5rem 0;
  color: var(--muted);
}
@media (max-width: 700px) {
  .profile-layout {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  .public-identity {
    position: static;
  }
  .rating-summary {
    padding: 1.25rem;
    gap: 1rem;
  }
  .review-count {
    padding-left: 1rem;
  }
}
</style>
