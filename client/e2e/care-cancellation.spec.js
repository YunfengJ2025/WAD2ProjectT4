import { test, expect, singaporeDate, requestCard, addPlantAndRequest } from './care-helpers.js'

test('owner cancels an open request → visits cancelled → reserved tokens released', async ({
  care,
}) => {
  const { ownerPage, sitterPage, plantName } = care
  await addPlantAndRequest(care, singaporeDate(2))

  await test.step('Owner confirms cancellation before any sitter accepts', async () => {
    await requestCard(ownerPage, plantName)
      .getByRole('button', { name: 'Cancel request', exact: true })
      .click()
    await ownerPage.getByRole('dialog', { name: 'Cancel request?', exact: true })
      .getByRole('button', { name: 'Cancel request', exact: true }).click()
    await expect(
      ownerPage
        .getByRole('status')
        .filter({ hasText: 'Request #' })
        .filter({ hasText: 'cancelled.' }),
    ).toBeVisible()
    await ownerPage.getByRole('button', { name: 'Cancelled', exact: false }).click()
    await expect(requestCard(ownerPage, plantName)).toContainText('cancelled')
    await requestCard(ownerPage, plantName)
      .getByRole('button', { name: 'View details', exact: true })
      .click()
    await expect(ownerPage.getByRole('dialog')).toContainText('Cancelled')
    await ownerPage
      .getByRole('dialog')
      .getByRole('button', { name: 'Close details', exact: true })
      .click()
    await ownerPage.reload()
    await ownerPage.getByRole('button', { name: 'Cancelled', exact: false }).click()
    await expect(requestCard(ownerPage, plantName)).toContainText('cancelled')
  })

  await test.step('Request is unavailable to sitters and the owner’s reservation is released', async () => {
    await sitterPage.getByRole('link', { name: 'Available sits', exact: true }).click()
    await sitterPage.getByRole('button', { name: 'See all requests', exact: true }).click()
    await expect(
      sitterPage.getByRole('heading', { name: 'Find requests', exact: true }),
    ).toBeVisible()
    await expect(
      sitterPage.locator('.requestCard').filter({ hasText: care.owner.user.userName }),
    ).toHaveCount(0)
    await ownerPage.goto('/requests?tab=new')
    await expect(ownerPage.getByLabel('Token balances')).toContainText(
      `Available: ${care.owner.user.tokenBalance}`,
    )
    await expect(
      ownerPage.getByLabel('Token balances').getByRole('button', { name: 'Frozen:', exact: false }),
    ).toContainText('Frozen: 0')
  })
})
