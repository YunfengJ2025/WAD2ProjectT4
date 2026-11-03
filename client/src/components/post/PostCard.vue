<script setup>
// Both card types share hover, keyboard-focus and reduced-motion styling.
import '@/assets/card.css'
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import LikeButton from './LikeButton.vue'
import UserAvatar from '@/components/user/UserAvatar.vue'
// post provides the title, photos and like count; author provides the displayed identity.
// The cover opens the post detail page, while the avatar opens the author's profile.
const props = defineProps({
  post: { type: Object, required: true },
  author: { type: Object, required: true },
})
const previewIndex = ref(0)
const failedImages = ref(new Set())
const images = computed(() => props.post.postImages || [])
// Keep preview state attached to this post and reset it if its photo list changes.
watch(
  () => [props.post.postId, props.post.postImages],
  () => {
    previewIndex.value = 0
    failedImages.value = new Set()
  },
)
function movePreview(amount) {
  if (images.value.length < 2) return
  // Modulo wraps the last photo back to the first without changing routes.
  previewIndex.value = (previewIndex.value + amount + images.value.length) % images.value.length
}
</script>

<template>
  <article class="post-card community-panel">
    <div
      class="post-card-cover"
      @keydown.left.prevent="movePreview(-1)"
      @keydown.right.prevent="movePreview(1)"
    >
      <RouterLink
        :to="`/community/${post.postId}`"
        class="post-card-link post-card-photo-link"
        :aria-label="`View post: ${post.title}`"
      >
        <!-- Only the photo changes; the cover dimensions and post link remain stable. -->
        <Transition name="card-preview" mode="out-in">
          <img
            v-if="images.length && !failedImages.has(previewIndex)"
            :key="images[previewIndex]"
            class="community-post-image"
            :src="images[previewIndex]"
            :alt="`${post.title} — photo ${previewIndex + 1} of ${images.length}`"
            loading="lazy"
            draggable="false"
            @error="failedImages.add(previewIndex)"
          />
          <p v-else :key="`title-${previewIndex}`" class="post-card-text">{{ post.title }}</p>
        </Transition>
      </RouterLink>
      <template v-if="images.length > 1">
        <span class="community-photo-count" aria-live="polite"
          >{{ previewIndex + 1 }} / {{ images.length }}</span
        >
        <!-- Preview buttons are siblings of the link: clicking them must not open the post. -->
        <button
          type="button"
          class="post-preview-arrow post-preview-previous"
          :aria-label="`Previous photo for ${post.title}`"
          @click.stop="movePreview(-1)"
        >
          ‹
        </button>
        <button
          type="button"
          class="post-preview-arrow post-preview-next"
          :aria-label="`Next photo for ${post.title}`"
          @click.stop="movePreview(1)"
        >
          ›
        </button>
        <div
          class="post-preview-dots"
          :aria-label="`Preview photos for ${post.title}`"
          role="group"
        >
          <button
            v-for="(_, index) in images"
            :key="index"
            type="button"
            :aria-label="`Preview photo ${index + 1} for ${post.title}`"
            :aria-pressed="previewIndex === index"
            @click.stop="previewIndex = index"
          >
            <span aria-hidden="true"></span>
          </button>
        </div>
      </template>
    </div>
    <RouterLink :to="`/community/${post.postId}`" class="post-card-link post-card-title-link"
      ><h2 class="post-card-title">{{ post.title }}</h2></RouterLink
    >
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

.post-card { /* Apply the enclosed declarations to elements matching this selector. */
  --post-cover-height: 260px; /* Define the shared responsive height for photos and title-only covers. */
  overflow: hidden; /* Control content beyond the element bounds, including clipping or scrolling. */
  min-width: 0; /* Set the minimum width; zero lets flex and grid children shrink. */
  display: flex; /* Choose the layout mode for this element and its children. */
  flex-direction: column; /* Choose a horizontal row or vertical column for flex children. */
} /* End this style rule or conditional block. */
/* Keep post-card content contained and links visually consistent. */
.post-card-link { /* Apply the enclosed declarations to elements matching this selector. */
  display: block; /* Choose the layout mode for this element and its children. */
  padding: 0; /* Set spacing between content and its border. */
  color: inherit; /* Set text color and the currentColor used by icons. */
  text-decoration: none; /* Control link decoration; none removes underlines. */
} /* End this style rule or conditional block. */
/* Highlight the control under the pointer without changing its layout. */
.post-card-link:hover { /* Apply the enclosed declarations to elements matching this selector. */
  background: transparent; /* Set the surface behind this element. */
} /* End this style rule or conditional block. */
/* Use matching responsive cover dimensions for full photos and title-only cards. */
.post-card-cover { /* Apply the enclosed declarations to elements matching this selector. */
  height: var(--post-cover-height); /* Set the height; shared variables keep image and text covers equal. */
  min-height: var(--post-cover-height); /* Prevent the element from becoming shorter than this value. */
  width: 100%; /* Set the width; percentages follow the containing block. */
  position: relative; /* Choose how this element is positioned relative to its container. */
  background: var(--accent-soft); /* Set the surface behind this element. */
  overflow: hidden; /* Control content beyond the element bounds, including clipping or scrolling. */
} /* End this style rule or conditional block. */
/* Use matching responsive cover dimensions for full photos and title-only cards. */
.post-card-cover img { /* Apply the enclosed declarations to elements matching this selector. */
  position: absolute; /* Choose how this element is positioned relative to its container. */
  inset: 0; /* Set offsets from all four edges of a positioned element. */
  max-height: none; /* Limit height; none removes an earlier limit. */
  width: 100%; /* Set the width; percentages follow the containing block. */
  height: 100%; /* Set the height; shared variables keep image and text covers equal. */
  object-fit: contain; /* Contain shows the full photo; cover fills the box and may crop edges. */
  object-position: center; /* Align the photo inside its image box. */
  border-radius: 0; /* Round the corners; 50% makes a square element circular. */
} /* End this style rule or conditional block. */
/* Use matching responsive cover dimensions for full photos and title-only cards. */
.post-card-text { /* Apply the enclosed declarations to elements matching this selector. */
  height: var(--post-cover-height); /* Set the height; shared variables keep image and text covers equal. */
  width: 100%; /* Set the width; percentages follow the containing block. */
  box-sizing: border-box; /* Include padding and borders in declared width and height. */
  display: -webkit-box; /* Choose the layout mode for this element and its children. */
  -webkit-line-clamp: 6; /* Limit displayed text to this many lines with the box layout. */
  -webkit-box-orient: vertical; /* Use vertical box orientation for multiline text truncation. */
  overflow: hidden; /* Control content beyond the element bounds, including clipping or scrolling. */
  margin: 0; /* Set outside spacing; auto horizontal margins center a constrained element. */
  padding: 1.5rem; /* Set spacing between content and its border. */
  font-size: 1.8rem; /* Set text size; rem units follow the root font size. */
  font-family: var(--font-heading); /* Choose the text font, using the theme variable where supplied. */
  color: var(--color-heading); /* Set text color and the currentColor used by icons. */
  overflow-wrap: anywhere; /* Allow long words or URLs to wrap instead of widening the card. */
} /* End this style rule or conditional block. */
/* Reserve equal title space and truncate long headings so cards align. */
.post-card-title { /* Apply the enclosed declarations to elements matching this selector. */
  margin: 1rem 1rem 0; /* Set outside spacing; auto horizontal margins center a constrained element. */
  font-size: 1.1rem; /* Set text size; rem units follow the root font size. */
  line-height: 1.5; /* Set line spacing; unitless values scale with font size. */
  height: 3.3rem; /* Set the height; shared variables keep image and text covers equal. */
  display: -webkit-box; /* Choose the layout mode for this element and its children. */
  -webkit-line-clamp: 2; /* Limit displayed text to this many lines with the box layout. */
  -webkit-box-orient: vertical; /* Use vertical box orientation for multiline text truncation. */
  overflow: hidden; /* Control content beyond the element bounds, including clipping or scrolling. */
  overflow-wrap: anywhere; /* Allow long words or URLs to wrap instead of widening the card. */
} /* End this style rule or conditional block. */
/* Align author identity and like count in the card footer. */
.post-card-footer { /* Apply the enclosed declarations to elements matching this selector. */
  display: flex; /* Choose the layout mode for this element and its children. */
  align-items: center; /* Align children on the cross axis of flex or grid. */
  justify-content: space-between; /* Align or distribute children along the layout main axis. */
  gap: 0.5rem; /* Set spacing between flex or grid children. */
  padding: 1rem; /* Set spacing between content and its border. */
  margin-top: auto; /* Set top outside spacing. */
} /* End this style rule or conditional block. */
/* Align author identity and like count in the card footer. */
.post-card-author { /* Apply the enclosed declarations to elements matching this selector. */
  display: flex; /* Choose the layout mode for this element and its children. */
  align-items: center; /* Align children on the cross axis of flex or grid. */
  gap: 0.5rem; /* Set spacing between flex or grid children. */
  min-width: 0; /* Set the minimum width; zero lets flex and grid children shrink. */
  color: var(--muted); /* Set text color and the currentColor used by icons. */
  text-decoration: none; /* Control link decoration; none removes underlines. */
} /* End this style rule or conditional block. */
/* Align author identity and like count in the card footer. */
.post-card-author span { /* Apply the enclosed declarations to elements matching this selector. */
  white-space: nowrap; /* Choose whether text wraps and explicit line breaks are preserved. */
  overflow: hidden; /* Control content beyond the element bounds, including clipping or scrolling. */
  text-overflow: ellipsis; /* Use an ellipsis when single-line text exceeds its available width. */
} /* End this style rule or conditional block. */
/* Align author identity and like count in the card footer. */
.post-card-likes { /* Apply the enclosed declarations to elements matching this selector. */
  flex-shrink: 0; /* Control how much this item shrinks when space is limited. */
  color: var(--muted); /* Set text color and the currentColor used by icons. */
} /* End this style rule or conditional block. */
/* Adjust layout and spacing for this viewport size. */
@media (max-width: 900px) { /* Apply the enclosed responsive overrides only when this viewport condition matches. */
  /* Keep post-card content contained and links visually consistent. */
  .post-card { /* Apply the enclosed declarations to elements matching this selector. */
    --post-cover-height: 220px; /* Define the shared responsive height for photos and title-only covers. */
  } /* End this style rule or conditional block. */
  /* Use matching responsive cover dimensions for full photos and title-only cards. */
  .post-card-text { /* Apply the enclosed declarations to elements matching this selector. */
    font-size: 1.5rem; /* Set text size; rem units follow the root font size. */
    padding: 1.25rem; /* Set spacing between content and its border. */
    -webkit-line-clamp: 5; /* Limit displayed text to this many lines with the box layout. */
  } /* End this style rule or conditional block. */
} /* End this style rule or conditional block. */
/* Adjust layout and spacing for this viewport size. */
@media (max-width: 575px) { /* Apply the enclosed responsive overrides only when this viewport condition matches. */
  /* Keep post-card content contained and links visually consistent. */
  .post-card { /* Apply the enclosed declarations to elements matching this selector. */
    --post-cover-height: 180px; /* Define the shared responsive height for photos and title-only covers. */
  } /* End this style rule or conditional block. */
  /* Use matching responsive cover dimensions for full photos and title-only cards. */
  .post-card-text { /* Apply the enclosed declarations to elements matching this selector. */
    font-size: 1.3rem; /* Set text size; rem units follow the root font size. */
    padding: 1rem; /* Set spacing between content and its border. */
    -webkit-line-clamp: 4; /* Limit displayed text to this many lines with the box layout. */
  } /* End this style rule or conditional block. */
} /* End this style rule or conditional block. */
/* Stretch only the cover link; preview controls remain separate accessible buttons. */
.post-card-photo-link { /* Apply the enclosed declarations to elements matching this selector. */
  width: 100%; /* Set the width; percentages follow the containing block. */
  height: 100%; /* Set the height; shared variables keep image and text covers equal. */
} /* End this style rule or conditional block. */
/* Controls are visible on touch devices; fine-pointer devices reveal them on hover/focus. */
.post-preview-arrow { /* Apply the enclosed declarations to elements matching this selector. */
  position: absolute; /* Choose how this element is positioned relative to its container. */
  top: 50%; /* Position this edge relative to its containing block; percentages use that block size. */
  transform: translateY(-50%); /* Move or scale the rendered element without reflowing nearby content. */
  z-index: 1; /* Set stacking order so controls appear above photos. */
  width: 36px; /* Set the width; percentages follow the containing block. */
  height: 36px; /* Set the height; shared variables keep image and text covers equal. */
  border: 1px solid #fff7; /* Set border thickness, style and color; zero removes it. */
  border-radius: 50%; /* Round the corners; 50% makes a square element circular. */
  color: white; /* Set text color and the currentColor used by icons. */
  background: #163f2bc9; /* Set the surface behind this element. */
  font-size: 1.7rem; /* Set text size; rem units follow the root font size. */
  line-height: 1; /* Set line spacing; unitless values scale with font size. */
  cursor: pointer; /* Choose the pointer shape to communicate the available interaction. */
} /* End this style rule or conditional block. */
.post-preview-previous { /* Apply the enclosed declarations to elements matching this selector. */
  left: 0.5rem; /* Position this edge relative to its containing block; percentages use that block size. */
} /* End this style rule or conditional block. */
.post-preview-next { /* Apply the enclosed declarations to elements matching this selector. */
  right: 0.5rem; /* Position this edge relative to its containing block; percentages use that block size. */
} /* End this style rule or conditional block. */
.post-preview-dots { /* Apply the enclosed declarations to elements matching this selector. */
  position: absolute; /* Choose how this element is positioned relative to its container. */
  bottom: 0.5rem; /* Position this edge relative to its containing block; percentages use that block size. */
  left: 50%; /* Position this edge relative to its containing block; percentages use that block size. */
  transform: translateX(-50%); /* Move or scale the rendered element without reflowing nearby content. */
  display: flex; /* Choose the layout mode for this element and its children. */
  max-width: calc(100% - 1rem); /* Limit the width so content stays within the intended layout. */
  border-radius: 20px; /* Round the corners; 50% makes a square element circular. */
  background: #163f2bc9; /* Set the surface behind this element. */
  padding: 0.1rem 0.3rem; /* Set spacing between content and its border. */
} /* End this style rule or conditional block. */
/* Button hit areas are larger than the dots so they work with touch and keyboard input. */
.post-preview-dots button { /* Apply the enclosed declarations to elements matching this selector. */
  display: grid; /* Choose the layout mode for this element and its children. */
  place-items: center; /* Set vertical and horizontal grid alignment together. */
  width: 24px; /* Set the width; percentages follow the containing block. */
  height: 28px; /* Set the height; shared variables keep image and text covers equal. */
  padding: 0; /* Set spacing between content and its border. */
  border: 0; /* Set border thickness, style and color; zero removes it. */
  background: transparent; /* Set the surface behind this element. */
  cursor: pointer; /* Choose the pointer shape to communicate the available interaction. */
} /* End this style rule or conditional block. */
.post-preview-dots span { /* Apply the enclosed declarations to elements matching this selector. */
  width: 6px; /* Set the width; percentages follow the containing block. */
  height: 6px; /* Set the height; shared variables keep image and text covers equal. */
  border-radius: 50%; /* Round the corners; 50% makes a square element circular. */
  background: #ffffff80; /* Set the surface behind this element. */
} /* End this style rule or conditional block. */
.post-preview-dots button[aria-pressed='true'] span { /* Apply the enclosed declarations to elements matching this selector. */
  background: white; /* Set the surface behind this element. */
  transform: scale(1.3); /* Move or scale the rendered element without reflowing nearby content. */
} /* End this style rule or conditional block. */
.post-preview-arrow:focus-visible, /* Include this selector in the shared rule continued below. */
.post-preview-dots button:focus-visible { /* Apply the enclosed declarations to elements matching this selector. */
  outline: 2px solid white; /* Draw a focus ring without affecting layout. */
  outline-offset: 2px; /* Separate the focus ring from the border. */
} /* End this style rule or conditional block. */
@media (hover: hover) and (pointer: fine) { /* Apply these overrides to precise pointers with hover support. */
  .post-preview-arrow, /* Include this selector in the shared rule continued below. */
  .post-preview-dots { /* Apply the enclosed declarations to elements matching this selector. */
    opacity: 0; /* Set transparency: zero is invisible and one is fully visible. */
    transition: opacity 160ms ease; /* Animate the listed property changes with the supplied duration and easing. */
  } /* End this style rule or conditional block. */
  .post-card:hover .post-preview-arrow, /* Include this selector in the shared rule continued below. */
  .post-card:hover .post-preview-dots, /* Include this selector in the shared rule continued below. */
  .post-card:focus-within .post-preview-arrow, /* Include this selector in the shared rule continued below. */
  .post-card:focus-within .post-preview-dots { /* Apply the enclosed declarations to elements matching this selector. */
    opacity: 1; /* Set transparency: zero is invisible and one is fully visible. */
  } /* End this style rule or conditional block. */
} /* End this style rule or conditional block. */
/* A short fade softens the image swap without zooming or cropping the photo. */
.card-preview-enter-active, /* Include this selector in the shared rule continued below. */
.card-preview-leave-active { /* Apply the enclosed declarations to elements matching this selector. */
  transition: opacity 120ms ease; /* Animate the listed property changes with the supplied duration and easing. */
} /* End this style rule or conditional block. */
.card-preview-enter-from, /* Include this selector in the shared rule continued below. */
.card-preview-leave-to { /* Apply the enclosed declarations to elements matching this selector. */
  opacity: 0; /* Set transparency: zero is invisible and one is fully visible. */
} /* End this style rule or conditional block. */
@media (prefers-reduced-motion: reduce) { /* Apply these overrides when reduced motion is requested. */
  .card-preview-enter-active, /* Include this selector in the shared rule continued below. */
  .card-preview-leave-active, /* Include this selector in the shared rule continued below. */
  .post-preview-arrow, /* Include this selector in the shared rule continued below. */
  .post-preview-dots { /* Apply the enclosed declarations to elements matching this selector. */
    transition: none; /* Animate the listed property changes with the supplied duration and easing. */
  } /* End this style rule or conditional block. */
} /* End this style rule or conditional block. */
</style>
