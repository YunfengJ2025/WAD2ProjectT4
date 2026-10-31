<script setup>
// Both card types share hover, keyboard-focus and reduced-motion styling.
import '@/assets/card.css'
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import LikeButton from './LikeButton.vue'
import UserAvatar from '@/components/user/UserAvatar.vue'
// post provides the title, photos and like count; author provides the displayed identity.
// The cover opens the post detail page, while the avatar opens the author's profile.
defineProps({ post: { type: Object, required: true }, author: { type: Object, required: true } })
const imageFailed = ref(false)
</script>

<template>
  <article class="post-card community-panel">
    <RouterLink
      :to="`/community/${post.postId}`"
      class="post-card-link"
      :aria-label="`View post: ${post.title}`"
    >
      <div class="post-card-cover">
        <img
          v-if="post.postImages?.length && !imageFailed"
          class="community-post-image"
          :src="post.postImages[0]"
          :alt="post.title"
          loading="lazy"
          @error="imageFailed = true"
        />
        <p v-else class="post-card-text">{{ post.title }}</p>
        <span v-if="post.postImages?.length > 1" class="community-photo-count"
          >▧ {{ post.postImages.length }}</span
        >
      </div>
      <h2 class="post-card-title">{{ post.title }}</h2>
    </RouterLink>
    <footer class="post-card-footer">
      <RouterLink :to="`/profile/${post.creatorId}`" class="post-card-author"
        ><UserAvatar :user="author" :size="30" /><span>{{ author.userName }}</span></RouterLink
      >
      <LikeButton :post="post" />
    </footer>
  </article>
</template>

<style scoped>
/* Keep post-card content contained and links visually consistent. */

.post-card {
  --post-cover-height: 260px;
  overflow: hidden;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
/* Keep post-card content contained and links visually consistent. */
.post-card-link {
  display: block;
  padding: 0;
  color: inherit;
  text-decoration: none;
}
/* Highlight the control under the pointer without changing its layout. */
.post-card-link:hover {
  background: transparent;
}
/* Use matching responsive cover dimensions for full photos and title-only cards. */
.post-card-cover {
  height: var(--post-cover-height);
  min-height: var(--post-cover-height);
  width: 100%;
  position: relative;
  background: var(--accent-soft);
  overflow: hidden;
}
/* Use matching responsive cover dimensions for full photos and title-only cards. */
.post-card-cover img {
  position: absolute;
  inset: 0;
  max-height: none;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  border-radius: 0;
}
/* Use matching responsive cover dimensions for full photos and title-only cards. */
.post-card-text {
  height: var(--post-cover-height);
  width: 100%;
  box-sizing: border-box;
  display: -webkit-box;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
  padding: 1.5rem;
  font-size: 1.8rem;
  font-family: var(--font-heading);
  color: var(--color-heading);
  overflow-wrap: anywhere;
}
/* Reserve equal title space and truncate long headings so cards align. */
.post-card-title {
  margin: 1rem 1rem 0;
  font-size: 1.1rem;
  line-height: 1.5;
  height: 3.3rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}
/* Align author identity and like count in the card footer. */
.post-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 1rem;
  margin-top: auto;
}
/* Align author identity and like count in the card footer. */
.post-card-author {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  color: var(--muted);
  text-decoration: none;
}
/* Align author identity and like count in the card footer. */
.post-card-author span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* Align author identity and like count in the card footer. */
.post-card-likes {
  flex-shrink: 0;
  color: var(--muted);
}
/* Adjust layout and spacing for this viewport size. */
@media (max-width: 900px) {
  /* Keep post-card content contained and links visually consistent. */
  .post-card {
    --post-cover-height: 220px;
  }
  /* Use matching responsive cover dimensions for full photos and title-only cards. */
  .post-card-text {
    font-size: 1.5rem;
    padding: 1.25rem;
    -webkit-line-clamp: 5;
  }
}
/* Adjust layout and spacing for this viewport size. */
@media (max-width: 575px) {
  /* Keep post-card content contained and links visually consistent. */
  .post-card {
    --post-cover-height: 180px;
  }
  /* Use matching responsive cover dimensions for full photos and title-only cards. */
  .post-card-text {
    font-size: 1.3rem;
    padding: 1rem;
    -webkit-line-clamp: 4;
  }
}
</style>
