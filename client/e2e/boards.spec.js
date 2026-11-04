/* boards.spec.js
 * End-to-End (E2E) tests for Dashboard and Leaderboard (Week 10 Slides 48–61).
 * Uses Playwright to verify the user workflow across Dashboard and Leaderboard:
 *   1. Navigates to /dashboard and verifies the heading, stat cards, and Milestone Badges section are visible
 *   2. Clicks "View Leaderboard" to navigate to /leaderboard and verifies the Community Leaderboard and privacy toggle are visible
 */

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

