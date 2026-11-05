import { test, expect, login } from './helpers/fixtures'

test('navigates from Dashboard to Leaderboard and displays rankings and opt-out toggle', async ({ page, journey }) => {
  // 1. Sign in through the UI first using the shared fixture helper
  await login(page, journey.accounts.A)

  // 2. Navigate to Dashboard
  await page.goto('/dashboard')

  await expect(page.getByText('My Green Space')).toBeVisible()
  await expect(page.getByText('Total Plants Owned')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Milestone Badges/i })).toBeVisible()

  // 3. Navigate to Leaderboard
  await page.getByText('View Leaderboard').click()

  await expect(page.getByText('Community Leaderboard')).toBeVisible()
  await expect(page.getByText('Hide my profile from Leaderboard')).toBeVisible()
})

