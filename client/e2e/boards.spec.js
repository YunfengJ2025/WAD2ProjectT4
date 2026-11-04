import { test, expect } from '@playwright/test'

test('navigates from Dashboard to Leaderboard and displays rankings and opt-out toggle', async ({ page }) => {
  await page.goto('/dashboard')

  await expect(page.getByText('My Green Space')).toBeVisible()
  await expect(page.getByText('Total Plants Owned')).toBeVisible()
  await expect(page.getByText('Milestone Badges')).toBeVisible()

  await page.getByText('View Leaderboard').click()

  await expect(page.getByText('Community Leaderboard')).toBeVisible()
  await expect(page.getByText('Hide my profile from Leaderboard')).toBeVisible()
})
