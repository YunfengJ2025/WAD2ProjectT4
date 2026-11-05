import { ref, watch } from 'vue'
import { request } from '@/api/http'

// Checks a postal code with OneMap (through our server) as soon as 6 digits are typed.
// Used by the sign up page and the profile page.
//
//   getPostalCode: a function returning the current postal code, e.g. () => postalCode.value
//
// status is one of:
//   ''         nothing to check yet (fewer than 6 digits)
//   'checking' waiting for the server
//   'ok'       real postal code; place holds { postalCode, block, road }
//   'notfound' no such postal code in Singapore
//   'error'    OneMap or the server could not be reached
// The server checks again when the form is saved, so this is only for quick feedback.
export function usePostalCheck(getPostalCode) {
  const status = ref('')
  const place = ref(null)
  const message = ref('')

  watch(getPostalCode, async (value) => {
    const postalCode = String(value || '').trim()
    place.value = null
    message.value = ''
    if (!/^\d{6}$/.test(postalCode)) {
      status.value = ''
      return
    }
    status.value = 'checking'
    try {
      const result = await request(`/user/postal/${postalCode}`)
      // The user may have kept typing while we waited; ignore old answers.
      if (String(getPostalCode() || '').trim() !== postalCode) return
      place.value = result
      status.value = 'ok'
    } catch (err) {
      if (String(getPostalCode() || '').trim() !== postalCode) return
      status.value = err.status === 404 ? 'notfound' : 'error'
      message.value =
        err.status === 404
          ? "This postal code doesn't exist. Please check it."
          : "Couldn't check your postal code right now. Please try again."
    }
  }, { immediate: true })

  return { status, place, message }
}
