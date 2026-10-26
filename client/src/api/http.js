export async function request(url, { token, ...options } = {}) {
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  let response
  try {
    response = await fetch(`/api${url}`, { ...options, headers })
  } catch {
    throw Object.assign(new Error('Could not reach the server. Please try again.'), { errors: {} })
  }
  const body = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    throw Object.assign(new Error(body?.message || `Request failed (${response.status})`), {
      status: response.status, errors: body?.errors || {},
    })
  }
  return body
}
