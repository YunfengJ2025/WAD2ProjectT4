import { test, expect, login, publish, commentOn, mutation } from './helpers/fixtures'

// Scenario 4: independent browser contexts prevent A's JWT being used by B.
test('a second user likes/comments and the author replies, with persistence', async ({
  page,
  browser,
  baseURL,
  journey,
}) => {
  /* 1. User A creates a disposable post. Each journey owns its setup and does not depend on another test running first. */
  await login(page, journey.accounts.A)
  const post = await publish(
    page,
    journey,
    journey.prefix + ' discussion',
    'Let us talk about plants.',
  )
  /* 2. Give B a separate browser context so cookies and sessionStorage cannot accidentally share A’s identity. */
  const contextB = await browser.newContext({ baseURL })
  try {
    const other = await contextB.newPage()
    await login(other, journey.accounts.B)
    await other.goto('/community/' + post.postId)
    /* 3. B likes the post. Compare with its starting count, then reload to verify both the selected heart and updated count were persisted. */
    const like = other.getByRole('button', { name: 'Like post:', exact: false, pressed: false })
    const originalCount = Number((await like.innerText()).trim())
    const liked = mutation(other, '/post/' + post.postId + '/like', 'POST')
    await like.click()
    expect((await liked).ok()).toBe(true)
    await other.reload()
    const unlike = other.getByRole('button', { name: 'Unlike post:', exact: false })
    await expect(unlike).toHaveAttribute('aria-pressed', 'true')
    await expect(unlike).toContainText(String(originalCount + 1))
    /* 4. B adds a unique comment; A then opens the same post to see that comment from another session. */
    const text = journey.prefix + ' lovely leaf'
    await commentOn(other, post.postId, text)
    await other.reload()
    await expect(other.locator('.review-card').filter({ hasText: text })).toBeVisible()
    await page.goto('/community/' + post.postId)
    const card = page.locator('.review-card').filter({ hasText: text })
    // Compare author identities to the actual account responses, not hardcoded names.
    const meB = await other.evaluate(() => sessionStorage.getItem('leaf-access-token'))
    const responseB = await other.request.get(journey.api('/user/me'), {
      headers: { Authorization: 'Bearer ' + meB },
    })
    const { user: userB } = await responseB.json()
    await expect(card.locator('header')).toContainText(userB.userName)
    /* 5. A replies using the actual review card. Wait for the real reply endpoint before checking saved discussion data. */
    await card.getByRole('button', { name: 'Reply', exact: true }).click()
    await card.getByLabel('Your reply').fill('Thanks for the encouragement!')
    const saved = mutation(page, '/review/me/replies', 'POST')
    await card.getByRole('button', { name: 'Share reply', exact: true }).click()
    expect((await saved).status()).toBe(201)
    await page.reload()
    /* 6. Reload both sessions to verify the reply is shared backend state. Replies themselves must not expose another Reply action. */
    const persisted = page.locator('.review-card').filter({ hasText: text })
    await expect(persisted.locator('.replies')).toContainText('Thanks for the encouragement!')
    await expect(persisted.locator('.replies button')).toHaveCount(0)
    await other.reload()
    await expect(other.locator('.replies')).toContainText('Thanks for the encouragement!')
  } finally {
    /* Always close B’s browser session, including after failures. The journey fixture separately deletes the created post and its discussion. */
    await contextB.close()
  }
})
