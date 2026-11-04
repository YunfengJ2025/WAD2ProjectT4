import { test as base, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

export { expect }
// A repository image exercises the real multipart upload and Cloudinary path.
export const photoPath = fileURLToPath(new URL('../../src/assets/plant.png', import.meta.url))
/* Extend Playwright’s standard test with a per-test journey fixture. Its setup runs before the test; the finally block runs during teardown. */
export const test = base.extend({
  journey: async ({ request, baseURL }, use) => {
    /* Validate the intended test environment before creating any records. Keep passwords in ignored local environment configuration. */
    // process.env is a flat map; there is no nested process.env.e2e object.
    if (process.env.E2E_CONFIRM_TEST_ENV !== 'true')
      throw new Error('Set E2E_CONFIRM_TEST_ENV=true only for a dedicated test backend/database.')
    const accounts = {}
    for (const key of ['A', 'B']) {
      const email = process.env['E2E_USER_' + key + '_EMAIL']
      const password = process.env['E2E_USER_' + key + '_PASSWORD']
      // Reject the sample values before attempting to sign in. Report only the
      // variable names, never print passwords or tokens into the test report.
      if (!email || !password || email.startsWith('your-test-account-') || password.startsWith('your-test-password-'))
        throw new Error(`Replace E2E_USER_${key}_EMAIL and E2E_USER_${key}_PASSWORD in client/.env.e2e.local with an existing test account; example placeholders cannot log in.`)
      accounts[key] = { email, password }
    }
    if (accounts.A.email === accounts.B.email) throw new Error('Accounts A and B must be distinct.')
    /* Generate a fresh label per test attempt so retries cannot select records left behind by a previous run. */
    const prefix = 'E2E-' + randomUUID()
    /* API verification/cleanup must target the SAME backend as the browser: either its separate origin or the frontend’s /api proxy. */
    const base = (process.env.E2E_API_BASE_URL || new URL('/api', baseURL).href).replace(/\/+$/, '')
    const posts = []
    const journey = {
      accounts,
      prefix,
      api: (path) => base + path,
      /* Remember only IDs created by this journey and the owning user’s token. This allows A and B records to be removed without deleting other users’ data. */
      async remember(page, post) {
        const token = await page.evaluate(() => sessionStorage.getItem('leaf-access-token'))
        posts.push({ id: post.postId, token })
      },
    }
    try {
      /* Yield the fixture to the test body. Teardown begins when the body completes or throws. */
      await use(journey)
    } finally {
      // Remove only posts explicitly created by this test, never reset a database.
      // Deletion also removes their comments/replies/likes through the real backend.
      const failed = []
      for (const post of posts) {
        const response = await request.delete(journey.api('/post/' + post.id), {
          headers: { Authorization: 'Bearer ' + post.token },
        })
        /* 204 means cleanup succeeded; 404 also succeeds because the lifecycle test may already have removed its post through the UI. */
        if (![204, 404].includes(response.status()))
          failed.push(post.id + ': HTTP ' + response.status())
      }
      if (failed.length) throw new Error('Test post cleanup failed: ' + failed.join(', '))
    }
  },
})

// Always sign in through the browser: JWT lives in sessionStorage, which
// Playwright storageState does not automatically restore for a new context.
export async function login(page, account, landing = false) {
  await page.goto(landing ? '/' : '/signin')
  if (landing) await page.locator('.login-button').click()
  await page.getByLabel('Email', { exact: true }).fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/schedule(?:[?#].*)?$/)
}

// Match path AND HTTP method so background GETs cannot satisfy a mutation wait.
export function mutation(page, path, method) {
  return page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith(path) && response.request().method() === method,
  )
}
/* Reusable UI setup for scenarios whose focus is discussion or filtering. The lifecycle scenario navigates the creation controls explicitly. */
export async function publish(page, journey, title, content, photo = false) {
  await page.goto('/community/new')
  await page.getByLabel('Title', { exact: false }).fill(title)
  await page.getByLabel('Your update', { exact: false }).fill(content)
  if (photo) await page.locator('#post-photos').setInputFiles(photoPath)
  return shareDraft(page, journey)
}
/* Submit a prepared draft, verify the real create response, register cleanup, then wait for navigation to finish. */
export async function shareDraft(page, journey) {
  const saved = mutation(page, '/post', 'POST')
  await page.getByRole('button', { name: 'Share post', exact: true }).click()
  const response = await saved
  expect(response.status(), 'Real create-post request must succeed').toBe(201)
  const post = await response.json()
  await journey.remember(page, post)
  await expect(page).toHaveURL(/\/community$/)
  return post
}
/* Create a comment through the browser form and verify that the real response appears in the discussion. */
export async function commentOn(page, postId, text) {
  await page.goto('/community/' + postId)
  await page.getByLabel('Add a review', { exact: true }).fill(text)
  const saved = mutation(page, '/post/' + postId + '/reviews', 'POST')
  await page.getByRole('button', { name: 'Share review', exact: true }).click()
  expect((await saved).status()).toBe(201)
  await expect(page.locator('.review-card').filter({ hasText: text })).toBeVisible()
}
/* Use the browser session’s Bearer token for read-only fixture checks. This derives expected values without bypassing UI actions under test. */
export async function ownApi(page, journey, path) {
  const token = await page.evaluate(() => sessionStorage.getItem('leaf-access-token'))
  const response = await page.request.get(journey.api(path), {
    headers: { Authorization: 'Bearer ' + token },
  })
  expect(response.ok()).toBe(true)
  return response.json()
}
