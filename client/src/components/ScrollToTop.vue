<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

// Pages can choose how far down the visitor scrolls before the shortcut appears.
const props = defineProps({ threshold: { type: Number, default: 400 } })
const visible = ref(false)
function updateVisibility() {
  visible.value = window.scrollY > props.threshold
}
function scrollToTop() {
  // matchMedia reads the visitor's accessibility preference instead of forcing motion.
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'instant' : 'smooth' })
  // Move keyboard focus back to the heading, so navigation can continue from the top.
  const heading = document.querySelector('main h1')
  if (heading) {
    const previousTabindex = heading.getAttribute('tabindex')
    heading.setAttribute('tabindex', '-1')
    heading.focus({ preventScroll: true })
    heading.addEventListener(
      'blur',
      () => {
        if (previousTabindex === null) heading.removeAttribute('tabindex')
        else heading.setAttribute('tabindex', previousTabindex)
      },
      { once: true },
    )
  }
}
onMounted(() => {
  updateVisibility()
  // A passive listener observes scroll position without blocking browser scrolling.
  window.addEventListener('scroll', updateVisibility, { passive: true })
})
onBeforeUnmount(() => {
  // Remove the listener when routing away so inactive pages do not retain handlers.
  window.removeEventListener('scroll', updateVisibility)
})
</script>

<template>
  <!-- Teleport avoids clipping or positioning changes caused by a page's animated ancestors. -->
  <Teleport to="body">
    <Transition name="scroll-top">
      <button
        v-if="visible"
        type="button"
        class="scroll-to-top"
        aria-label="Scroll to top"
        title="Back to top"
        @click="scrollToTop"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 14 6-6 6 6M12 8v12" /></svg>
      </button>
    </Transition>
  </Teleport>
</template>

<style scoped>
.scroll-to-top {
  /* Style the shared floating navigation button. */
  position: fixed; /* Anchor the shortcut to the viewport instead of the page content. */
  right: max(
    1.25rem,
    env(safe-area-inset-right)
  ); /* Keep space from the screen edge and any device cutout. */
  bottom: calc(
    1.25rem + env(safe-area-inset-bottom)
  ); /* Clear the bottom edge and mobile home-indicator area. */
  z-index: 100; /* Show above cards while remaining below Bootstrap modal layers. */
  display: grid; /* Use grid to center the icon in both directions. */
  place-items: center; /* Center the icon inside the button. */
  width: 50px; /* Provide a consistent, touch-friendly width. */
  height: 50px; /* Match the width to form a circular button. */
  padding: 0; /* Remove browser padding so the icon remains centered. */
  border: 1px solid var(--accent); /* Match the button border to the app's green accent. */
  border-radius: 50%; /* Turn the square button into a circle. */
  background: var(--accent); /* Use the shared green surface color. */
  color: var(--on-accent); /* Give the arrow sufficient contrast on the accent background. */
  box-shadow: 0 4px 16px #163f2b33; /* Separate the button visually from content beneath it. */
  cursor: pointer; /* Indicate that the shortcut is clickable. */
  transition:
    background-color 160ms ease,
    transform 160ms ease; /* Smooth hover changes without affecting layout. */
} /* End the floating-button rule. */
.scroll-to-top svg {
  /* Style the decorative arrow icon. */
  width: 24px; /* Set the arrow width independently from the touch target. */
  height: 24px; /* Preserve a square icon box. */
  fill: none; /* Keep the arrow as a clean outline. */
  stroke: currentColor; /* Inherit the button's contrasting foreground color. */
  stroke-width: 2; /* Make the arrow visible at small sizes. */
  stroke-linecap: round; /* Round the ends of the arrow strokes. */
  stroke-linejoin: round; /* Round the arrow's corners. */
} /* End the icon rule. */
.scroll-to-top:hover {
  /* Give pointer users feedback when targeting the button. */
  background: var(--accent-hover); /* Darken the surface on hover. */
  transform: translateY(-2px); /* Lift the button slightly without moving surrounding content. */
} /* End the hover rule. */
.scroll-to-top:focus-visible {
  /* Make keyboard focus clearly visible. */
  outline: 3px solid var(--accent); /* Draw a strong focus ring around the shortcut. */
  outline-offset: 4px; /* Separate the focus ring from the button border. */
} /* End the keyboard-focus rule. */
.scroll-top-enter-active, /* Share appearance timing with disappearance. */
.scroll-top-leave-active {
  /* Vue adds these classes while the button enters or leaves. */
  transition:
    opacity 180ms ease,
    transform 180ms ease; /* Fade and move the button smoothly. */
} /* End the transition-timing rule. */
.scroll-top-enter-from, /* Start an incoming button in the hidden position. */
.scroll-top-leave-to {
  /* End an outgoing button in the hidden position. */
  opacity: 0; /* Hide the button at the transition endpoint. */
  transform: translateY(10px); /* Offset the button slightly below its final position. */
} /* End the hidden-state rule. */
@media (max-width: 575px) {
  /* Use a more compact shortcut on phones. */
  .scroll-to-top {
    /* Override button size only for small viewports. */
    width: 44px; /* Keep a touch-friendly minimum width. */
    height: 44px; /* Keep the compact button circular. */
    right: max(
      0.75rem,
      env(safe-area-inset-right)
    ); /* Preserve more horizontal room for phone content. */
  } /* End the mobile-button override. */
} /* End the phone breakpoint. */
@media (prefers-reduced-motion: reduce) {
  /* Respect visitors who request reduced animation. */
  .scroll-to-top, /* Include hover motion in the reduced-motion override. */
  .scroll-top-enter-active, /* Include the appearance transition. */
  .scroll-top-leave-active {
    /* Include the disappearance transition. */
    transition: none; /* Apply state changes immediately instead of animating. */
    transform: none; /* Remove the hover or transition offset. */
  } /* End the reduced-motion override. */
} /* End the accessibility preference rule. */
</style>
