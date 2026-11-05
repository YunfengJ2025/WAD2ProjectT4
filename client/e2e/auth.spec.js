// auth.spec.js
// E2E tests for signing in, signing out, protected pages and creating an account.
// Uses the dummy test account (listed in README.txt). Change it with E2E_EMAIL / E2E_PASSWORD.
import process from 'node:process'
import { test, expect } from '@playwright/test'

const TEST_USER = {
  email: process.env.E2E_EMAIL || 'sitter.test@leafittous.sg',
  password: process.env.E2E_PASSWORD || 'Sitter123!',
}

test.describe('Sign in / sign out', () => {
  test('signs in with a valid account, then logs out', async ({ page }) => {
    // (1) setup: open the sign-in page
    await page.goto('/signin')

    // (2) actions: enter the email and password, then sign in
    await page.getByLabel('Email', { exact: true }).fill(TEST_USER.email)
    await page.getByLabel('Password', { exact: true }).fill(TEST_USER.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    // (3) assert: the user lands on the schedule and sees the main navigation
    await expect(page).toHaveURL('/schedule')
    await expect(page.getByRole('link', { name: 'My Plants', exact: true })).toBeVisible()

    // Log out from the avatar menu, then confirm in the "Log out?" pop-up
    await page.getByRole('navigation').locator('.dropdown-toggle').click()
    await page.getByRole('button', { name: 'Log out', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Log out', exact: true }).click()

    // Back on the sign-in page, and the main navigation is gone
    await expect(page).toHaveURL('/signin')
    await expect(page.getByRole('link', { name: 'My Plants', exact: true })).toHaveCount(0)
  })

  test('shows an error for a wrong password', async ({ page }) => {
    await page.goto('/signin')

    await page.getByLabel('Email', { exact: true }).fill(TEST_USER.email)
    await page.getByLabel('Password', { exact: true }).fill('wrong-password-123')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    // An error message appears and the user stays on the sign-in page
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL('/signin')
  })

  test('sends a signed-out visitor to Create account, then back to the page after signing in', async ({
    page,
  }) => {
    // (1) setup: open a page that needs an account, without signing in
    await page.goto('/plants')

    // (3) assert: the visitor is sent to Create account, remembering where they wanted to go
    await expect(page).toHaveURL('/register?redirect=/plants')
    await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeVisible()

    // (2) actions: they already have an account, so they sign in instead
    await page.goto('/signin?redirect=/plants')
    await page.getByLabel('Email', { exact: true }).fill(TEST_USER.email)
    await page.getByLabel('Password', { exact: true }).fill(TEST_USER.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    // (3) assert: after signing in they are taken back to My Plants
    await expect(page).toHaveURL('/plants')
    await expect(page.getByRole('heading', { name: 'My Plants', exact: true })).toBeVisible()
  })
})

test.describe('Create account and delete account', () => {
  test('creates a new account, then deletes it from Profile', async ({ page }) => {
    // A different email and username every run, so the test can be repeated.
    // The account is deleted at the end, so nothing is left in the database.
    const unique = Date.now()
    const email = `e2e-${unique}@example.com`
    const password = 'Test-password-123'

    // ---------- Create account ----------
    await page.goto('/register')
    await page.getByLabel('Username', { exact: true }).fill(`e2e_user_${unique}`)
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByLabel('Postal code', { exact: true }).fill('560123')
    await page.getByLabel('Block', { exact: true }).fill('123')
    await page.getByLabel('Unit number', { exact: true }).fill('#02-01')
    await page.getByRole('button', { name: 'Create account', exact: true }).click()

    // The new user is signed in and on the schedule
    await expect(page).toHaveURL('/schedule')
    await expect(page.getByRole('link', { name: 'My Plants', exact: true })).toBeVisible()

    // ---------- Delete account ----------
    await page.goto('/profile')
    await page.getByRole('button', { name: 'Delete account', exact: true }).click()

    // A wrong password is refused and the user stays signed in
    await page.getByLabel('Enter your password to confirm').fill('not-my-password')
    await page.getByRole('button', { name: 'Delete my account', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText('Wrong password')
    await expect(page).toHaveURL('/profile')

    // The right password deletes the account and goes to the landing page
    await page.getByLabel('Enter your password to confirm').fill(password)
    await page.getByRole('button', { name: 'Delete my account', exact: true }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByText('Your account has been deleted.', { exact: false })).toBeVisible()

    // The deleted account can no longer sign in
    await page.goto('/signin')
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL('/signin')
  })
})
