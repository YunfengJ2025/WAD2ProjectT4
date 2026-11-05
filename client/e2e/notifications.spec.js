// notifications.spec.js
// E2E test for the notification bell: unread badge, mark all read, delete one, clear all.
//
// A real notification only appears when a sitter misses a visit or no sitter takes it,
// which can't be set up quickly in a test. So the notification API is replaced with a
// fake one (page.route) that keeps a small list in memory. Sign-in still uses the real app.
import process from 'node:process'
import { test, expect } from '@playwright/test'

const TEST_USER = {
  email: process.env.E2E_EMAIL || 'sitter.test@leafittous.sg',
  password: process.env.E2E_PASSWORD || 'Sitter123!',
}

test('shows unread notifications, marks them read, deletes one and clears the rest', async ({
  page,
}) => {
  // ---------- Fake notification API ----------
  // 2 unread notices and 1 that was already read
  let notifications = [
    { _id: 'n1', type: 'visit_missed', message: 'You missed the visit scheduled for 04/11/2026.', readAt: null, createdAt: new Date().toISOString() },
    { _id: 'n2', type: 'visit_expired', message: 'No sitter accepted your 03/11/2026 visit. 2 tokens were returned.', readAt: null, createdAt: new Date().toISOString() },
    { _id: 'n3', type: 'visit_weather_skipped', message: 'Rain is forecast, so your visit may be skipped.', readAt: new Date().toISOString(), createdAt: new Date().toISOString() },
  ]
  await page.route('**/api/notifications**', async (route) => {
    const method = route.request().method()
    const path = new URL(route.request().url()).pathname
    if (method === 'GET') {
      return route.fulfill({ json: { notifications } })
    }
    if (method === 'PATCH' && path.endsWith('/read-all')) {
      const readAt = new Date().toISOString()
      notifications = notifications.map((item) => ({ ...item, readAt: item.readAt || readAt }))
      return route.fulfill({ json: { updated: 2, readAt } })
    }
    if (method === 'DELETE' && path.endsWith('/notifications')) {
      notifications = []
      return route.fulfill({ json: { deleted: 3 } })
    }
    if (method === 'DELETE') {
      const id = path.split('/').pop()
      notifications = notifications.filter((item) => item._id !== id)
      return route.fulfill({ json: { deleted: 1 } })
    }
    return route.continue()
  })

  // (1) setup: sign in
  await page.goto('/signin')
  await page.getByLabel('Email', { exact: true }).fill(TEST_USER.email)
  await page.getByLabel('Password', { exact: true }).fill(TEST_USER.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/schedule$/)

  // The bell shows 2 unread
  const bell = page.getByRole('button', { name: 'Notifications' })
  await expect(bell).toContainText('2')

  // (2) actions + (3) asserts: open the panel
  await bell.click()
  await expect(page.getByText('2 new')).toBeVisible()
  await expect(page.getByText('You missed the visit scheduled for 04/11/2026.')).toBeVisible()
  await expect(page.getByText('No sitter accepted your 03/11/2026 visit.', { exact: false })).toBeVisible()

  // Mark all read: the "2 new" pill and the red badge disappear
  await page.getByRole('button', { name: 'Mark all read', exact: true }).click()
  await expect(page.getByText('2 new')).toHaveCount(0)
  await expect(bell).not.toContainText('2')

  // Delete one notification with its ✕ button
  const rainNotice = page.locator('.notification-item').filter({ hasText: 'Rain is forecast' })
  await rainNotice.getByRole('button', { name: 'Delete notification' }).click()
  await expect(page.getByText('Rain is forecast', { exact: false })).toHaveCount(0)
  await expect(page.getByText('You missed the visit scheduled for 04/11/2026.')).toBeVisible()

  // Clear all: accept the browser's "are you sure?" box, then the list is empty
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Clear all', exact: true }).click()
  await expect(page.getByText('You’re all caught up.')).toBeVisible()
})
