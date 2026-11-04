import { test, expect, login, mutation, publish, shareDraft, photoPath } from './helpers/fixtures'

// Scenario 1: the complete lifecycle uses UI navigation and real persisted records.
test('landing → login → create → edit → cancel removal → delete', async ({ page, journey }) => {
  /* 1. Start at the public landing page and log in through the UI. The shared helper also verifies the schedule destination. */
  await login(page, journey.accounts.A, true)
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Community', exact: true })
    .click()
  await page.getByRole('link', { name: 'Create a post', exact: true }).click()
  /* 2. Build a uniquely named draft and upload a real image. The unique prefix prevents a previous run’s post from matching these assertions. */
  const title = journey.prefix + ' garden'
  await page.getByLabel('Title', { exact: false }).fill(title)
  await page.getByLabel('Your update', { exact: false }).fill('A little progress in my garden.')
  await page.locator('#post-photos').setInputFiles(photoPath)
  await expect(page.locator('.composer-draft h3')).toHaveText(title)
  /* 3. Publish through the real API. The helper remembers the created ID for cleanup even if a later assertion fails. */
  const post = await shareDraft(page, journey)
  await page.reload()
  const card = page.locator('.post-card').filter({ hasText: title })
  await expect(card).toBeVisible()
  await card.getByRole('link', { name: title, exact: true }).click()
  await expect(page.locator('.community-detail-title')).toHaveText(title)
  // Reload proves the image comes back from the backend, not a local blob preview.
  await page.reload()
  await expect(page.locator('.post-gallery-slide[aria-hidden="false"] img')).toBeVisible()
  await page.goto('/community')
  await page.getByRole('link', { name: 'My posts', exact: true }).click()
  /* 4. Edit through My Posts, then reload. The assertions check saved backend data rather than only the current form state. */
  const managed = page.locator('.managed-post').filter({ hasText: title })
  await managed.getByRole('link', { name: /Edit post/ }).click()
  const edited = title + ' updated'
  await page.getByLabel('Title', { exact: false }).fill(edited)
  await page.getByLabel('Your update', { exact: false }).fill('My saved update.')
  /* Register the response wait BEFORE clicking Save: a fast backend response must not be missed. */
  const updated = mutation(page, '/post/' + post.postId, 'PATCH')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  expect((await updated).ok()).toBe(true)
  await expect(page).toHaveURL(/\/my-posts$/)
  await page.reload()
  await expect(page.locator('.managed-post').filter({ hasText: edited })).toBeVisible()
  /* 5. Cancel the first removal to verify the confirmation protects the post. Confirm the second removal and check both listings after reload. */
  await page.getByRole('button', { name: 'Remove post: ' + edited, exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.locator('.managed-post').filter({ hasText: edited })).toBeVisible()
  await page.getByRole('button', { name: 'Remove post: ' + edited, exact: true }).click()
  const deleted = mutation(page, '/post/' + post.postId, 'DELETE')
  await page.getByRole('dialog').getByRole('button', { name: 'Remove post', exact: true }).click()
  expect((await deleted).status()).toBe(204)
  await page.reload()
  await expect(page.locator('.managed-post').filter({ hasText: edited })).toHaveCount(0)
  await page.goto('/community')
  await expect(page.locator('.post-card').filter({ hasText: edited })).toHaveCount(0)
})

// Scenario 3: exercise browser validation and the real upload path after correction.
test('invalid post input and photos preserve the draft before successful correction', async ({
  page,
  journey,
}) => {
  await login(page, journey.accounts.A)
  /* 1. Open an empty composer and verify blank or whitespace-only content cannot be published. */
  await page.goto('/community/new')
  await expect(page.getByRole('button', { name: 'Share post', exact: true })).toBeDisabled()
  const title = journey.prefix + ' corrected'
  await page.getByLabel('Title', { exact: false }).fill(title)
  await page.getByLabel('Your update', { exact: false }).fill('   ')
  await expect(page.getByRole('button', { name: 'Share post', exact: true })).toBeDisabled()
  /* 2. Provide valid text, then reject unsupported and oversized uploads. setInputFiles simulates choosing a file without opening the operating-system picker. */
  await page.getByLabel('Your update', { exact: false }).fill('Keep my plant story.')
  await page.locator('#post-photos').setInputFiles({
    name: 'invalid.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Not an image'),
  })
  await expect(page.locator('#photo-error')).toContainText('JPG, PNG or WebP')
  await page.locator('#post-photos').setInputFiles({
    name: 'oversize.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
  })
  await expect(page.locator('#photo-error')).toContainText('2MB or smaller')
  /* 3. Verify validation errors have not erased either text field. */
  await expect(page.locator('#post-title')).toHaveValue(title)
  await expect(page.locator('#post-content')).toHaveValue('Keep my plant story.')
  /* 4. Correct the photo and publish the same draft. A reload of the resulting detail page checks the saved text and photo. */
  await page.locator('#post-photos').setInputFiles(photoPath)
  await expect(page.locator('#photo-error')).toBeHidden()
  const post = await shareDraft(page, journey)
  await page.goto('/community/' + post.postId)
  await page.reload()
  await expect(page.locator('.community-content')).toHaveText('Keep my plant story.')
  await expect(page.locator('.post-gallery-slide[aria-hidden="false"] img')).toBeVisible()
})
