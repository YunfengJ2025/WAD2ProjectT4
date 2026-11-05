import { test, expect, singaporeDate } from './care-helpers.js'

// Unique coverage for multiple visits and both map search modes.
test('keeps every accepted visit in the sitter’s account after reloading', async ({
  care,
  request,
}) => {
  const { ownerPage, sitterPage, owner, plantName } = care
  const today = singaporeDate()
  const tomorrow = singaporeDate(1)

  // Real API setup; request creation and acceptance happen through the UI.
  const plantResponse = await request.post('/api/plants', {
    headers: { Authorization: `Bearer ${owner.accessToken}` },
    multipart: {
      plantName,
      plantLocation: 'Sheltered corridor',
      frequencyDays: '1',
      amountMl: '200',
      notes: 'Water the soil\nWipe the leaves',
      isOutdoor: 'true',
      rainExposed: 'false',
      weatherAdjustmentEnabled: 'false',
    },
  })
  expect(plantResponse.status(), 'Create the owner’s outdoor plant').toBe(201)

  await test.step('Owner posts a two-day request from My Requests', async () => {
    await ownerPage.goto('/requests')
    await ownerPage.getByRole('link', { name: '+ New Request', exact: true }).click()
    await ownerPage.getByRole('button', { name: plantName, exact: false }).click()
    await ownerPage.getByLabel('Start date', { exact: true }).fill(today)
    await ownerPage.getByLabel('End date', { exact: true }).fill(tomorrow)
    await ownerPage.getByLabel('Reward per visit (tokens)').fill('2')
    await ownerPage.getByLabel('Water left outside', { exact: true }).check()
    await ownerPage.getByLabel('Note', { exact: true }).fill(`Use side gate for ${plantName}`)
    await expect(ownerPage.getByText('2 visits over 2 days.', { exact: false })).toBeVisible()
    await ownerPage.getByRole('button', { name: 'Post request', exact: true }).click()
    await expect(
      ownerPage.getByRole('status').filter({ hasText: 'Request #' }).filter({ hasText: 'posted.' }),
    ).toContainText('posted.')
    await ownerPage.getByRole('link', { name: '← My requests', exact: true }).click()
    await expect(ownerPage.getByRole('heading', { name: plantName, exact: true })).toBeVisible()
  })

  await test.step('Sitter accepts today’s visit through Find nearby', async () => {
    await expect(
      sitterPage.getByText('You have no accepted visits yet.', { exact: false }),
    ).toBeVisible()
    await sitterPage.getByRole('link', { name: 'Available sits', exact: true }).click()
    await expect(
      sitterPage.getByRole('heading', { name: 'Find nearby', exact: true }),
    ).toBeVisible()
    await sitterPage.locator('.requestCard').filter({ hasText: owner.user.userName }).click()
    await expect(sitterPage.getByText(plantName, { exact: true })).toBeVisible()
    await expect(
      sitterPage.getByText(`Use side gate for ${plantName}`, { exact: true }),
    ).toBeVisible()
    await sitterPage.getByRole('button', { name: 'Accept request', exact: true }).click()
    await expect(
      sitterPage.getByRole('status').filter({ hasText: 'You accepted the visit' }),
    ).toContainText('You accepted the visit')
    await expect(
      sitterPage.locator('.requestCard').filter({ hasText: owner.user.userName }),
    ).toHaveCount(0)
    await sitterPage.getByRole('link', { name: 'View in My Sits', exact: false }).click()
    await expect(sitterPage.getByRole('heading', { name: plantName, exact: true })).toHaveCount(1)
  })

  await test.step('Sitter accepts the remaining visit through Find requests', async () => {
    await sitterPage.getByRole('link', { name: 'Available sits', exact: true }).click()
    await sitterPage.getByRole('button', { name: 'See all requests', exact: true }).click()
    await expect(
      sitterPage.getByRole('heading', { name: 'Find requests', exact: true }),
    ).toBeVisible()
    await sitterPage.locator('.requestCard').filter({ hasText: owner.user.userName }).click()
    await sitterPage.locator('.requestCard').click()
    await expect(sitterPage.getByText(plantName, { exact: true })).toBeVisible()
    await sitterPage.getByRole('button', { name: 'Accept request', exact: true }).click()
    await expect(
      sitterPage.getByRole('status').filter({ hasText: 'You accepted the visit' }),
    ).toContainText('You accepted the visit')
    await sitterPage.getByRole('link', { name: 'View in My Sits', exact: false }).click()
  })

  await test.step('My Sits shows both accepted visits after reload, only for the sitter', async () => {
    await expect(sitterPage.getByRole('heading', { name: 'My Sits', exact: true })).toBeVisible()
    const cards = sitterPage
      .getByRole('article')
      .filter({ has: sitterPage.getByRole('heading', { name: plantName, exact: true }) })
    await expect(cards).toHaveCount(2)
    await expect(cards.filter({ hasText: 'Due today' })).toHaveCount(1)
    await expect(cards.filter({ hasText: 'Tomorrow' })).toHaveCount(1)
    await sitterPage.reload()
    await expect(cards).toHaveCount(2)
    await ownerPage.goto('/my-sits')
    await expect(
      ownerPage.getByText('You have no accepted visits yet.', { exact: false }),
    ).toBeVisible()
    await expect(ownerPage.getByRole('heading', { name: plantName, exact: true })).toHaveCount(0)
    await ownerPage.goto('/requests')
    const ownerCard = ownerPage.getByRole('article').filter({ hasText: plantName })
    await expect(ownerCard).toContainText('sitter found')
  })
})
