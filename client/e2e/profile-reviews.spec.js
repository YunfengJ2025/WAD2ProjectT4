import { test, expect, login, publish, commentOn, ownApi } from './helpers/fixtures'

// Scenario 6: create known post feedback but compare visit ratings to existing
// test fixtures. We never invent visits or mutate the care subsystem to seed ratings.
test('profile reviews separate received/written feedback and retain the visit-only average', async ({
  page,
  browser,
  baseURL,
  journey,
}) => {
  await login(page, journey.accounts.A)
  /* 1. Read A’s real identity and existing feedback as the expected baseline. These are actual API calls, not mocked responses. */
  const { user: userA } = await ownApi(page, journey, '/user/me')
  const { reviews: baseline } = await ownApi(page, journey, '/review/me')
  /* Only received VISIT ratings contribute to the average. Written reviews and post comments must not alter it. */
  const ratings = baseline.filter(
    (item) =>
      item.receiverId === userA.userId && item.type === 'VISIT' && Number.isFinite(item.rating),
  )
  /* Fail with a setup explanation if the dedicated account lacks a rating; otherwise an empty-state check could falsely appear to test averaging. */
  expect(
    ratings.length,
    'Seed at least one received visit review for account A; see E2E_TESTING.md',
  ).toBeGreaterThan(0)
  const average = (ratings.reduce((sum, item) => sum + item.rating, 0) / ratings.length).toFixed(1)
  /* 2. Create one post per user and cross-comment: B’s comment on A’s post is received; A’s comment on B’s post is written. */
  const postA = await publish(page, journey, journey.prefix + ' owner', 'My own plant update')
  const contextB = await browser.newContext({ baseURL })
  try {
    const other = await contextB.newPage()
    await login(other, journey.accounts.B)
    const received = journey.prefix + ' feedback received'
    await commentOn(other, postA.postId, received)
    const postB = await publish(other, journey, journey.prefix + ' neighbour', 'A neighbour update')
    const written = journey.prefix + ' feedback written'
    await commentOn(page, postB.postId, written)
    /* 3. Use the profile’s actual View all reviews link to reach the full review page, exercising the connection between pages. */
    await page.goto('/profile')
    await page
      .locator('#profile-reviews')
      .getByRole('link', { name: /View all reviews/ })
      .click()
    await expect(page).toHaveURL(/\/reviews$/)
    await expect(page.getByTestId('average-rating')).toHaveText(average)
    await expect(page.locator('.review-card').filter({ hasText: received })).toHaveCount(1)
    await expect(page.locator('.review-card').filter({ hasText: written })).toHaveCount(0)
    /* 4. Combine the post-comment filter with this run’s unique search prefix, excluding unrelated fixtures from the result count. */
    await page.getByRole('button', { name: 'Post comments', exact: true }).click()
    await page.getByLabel('Search reviews').fill(journey.prefix)
    await expect(page.locator('.review-card')).toHaveCount(1)
    await expect(page.locator('.review-card')).toContainText(received)
    /* 5. Switch direction without clearing the type/search filters. The matching comment should change, while the received-visit average stays the same. */
    await page.getByRole('button', { name: 'Written by me', exact: true }).click()
    await expect(page.locator('.review-card')).toHaveCount(1)
    await expect(page.locator('.review-card')).toContainText(written)
    await expect(page.getByTestId('average-rating')).toHaveText(average)
    /* 6. Reload resets the page filters to their defaults. Check the persisted average and the complete received care-visit count. */
    await page.reload()
    await expect(page.getByTestId('average-rating')).toHaveText(average)
    await page.getByRole('button', { name: 'Care visits', exact: true }).click()
    await expect(page.locator('.review-card')).toHaveCount(ratings.length)
  } finally {
    /* Close the second session even when assertions fail; the fixture cleans up both users’ test posts using their recorded tokens. */
    await contextB.close()
  }
})
