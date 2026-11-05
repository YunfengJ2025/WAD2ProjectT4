import { fileURLToPath } from 'node:url'
import {
  test,
  expect,
  singaporeDate,
  requestCard,
  historyCard,
  addPlantAndRequest,
  acceptRequest,
} from './care-helpers.js'

test('add plant → request → accept → complete visit → reward paid → owner proof and feedback', async ({
  care,
}) => {
  const { ownerPage, sitterPage, plantName } = care
  await addPlantAndRequest(care, singaporeDate())
  await acceptRequest(care, singaporeDate())
  const note = 'Watered soil and wiped every leaf.'

  await test.step('Sitter starts the visit, ticks care steps, uploads proof and submits', async () => {
    await requestCard(sitterPage, plantName)
      .getByRole('button', { name: 'Start visit', exact: true })
      .click()
    const dialog = sitterPage.getByRole('dialog')
    await expect(dialog.getByRole('button', { name: 'Submit proof', exact: true })).toBeDisabled()
    await dialog.getByLabel('Water the soil', { exact: true }).check()
    await dialog.getByLabel('Wipe the leaves', { exact: true }).check()
    // Reuse the project's small plant image as a valid upload fixture.
    await dialog
      .getByLabel('Add photo', { exact: true })
      .setInputFiles(fileURLToPath(new URL('../src/assets/plant.png', import.meta.url)))
    await expect(
      dialog.getByRole('img', { name: 'Proof photo preview', exact: true }),
    ).toBeVisible()
    await dialog.getByLabel('Note for the owner', { exact: false }).fill(note)
    await expect(dialog.getByRole('button', { name: 'Submit proof', exact: true })).toBeEnabled()
    await dialog.getByRole('button', { name: 'Submit proof', exact: true }).click()
    await expect(
      sitterPage.getByRole('status').filter({ hasText: 'saved with photo proof' }),
    ).toContainText('2 tokens awarded')
    await expect(historyCard(sitterPage, plantName)).toContainText('Reward paid')
    await expect(sitterPage.getByRole('button', { name: 'Start visit', exact: true })).toHaveCount(
      0,
    )
  })

  await test.step('Owner sees the saved proof and checklist and leaves feedback', async () => {
    await ownerPage.reload()
    await ownerPage.getByRole('button', { name: 'Completed', exact: false }).click()
    await requestCard(ownerPage, plantName)
      .getByRole('button', { name: 'View details', exact: true })
      .click()
    await ownerPage
      .getByRole('dialog')
      .getByRole('link', { name: 'Open visit on', exact: false })
      .click()
    await expect(
      ownerPage.getByRole('heading', { name: 'Completed visit', exact: true }),
    ).toBeVisible()
    await expect(ownerPage.getByText(note, { exact: true })).toBeVisible()
    const proof = ownerPage.getByRole('img', { name: `Care proof for ${plantName}`, exact: true })
    await expect(proof).toBeVisible()
    await expect(proof).toHaveJSProperty('complete', true)
    await expect(proof).not.toHaveJSProperty('naturalWidth', 0)
    await expect(ownerPage.getByText('(2 of 2 done)', { exact: true })).toBeVisible()
    await ownerPage.getByRole('radio', { name: '5 stars', exact: true }).check()
    await ownerPage.getByLabel('Your review', { exact: true }).fill('Great care, thank you!')
    await ownerPage.getByRole('button', { name: 'Submit review', exact: true }).click()
    await expect(
      ownerPage.getByText('Your review has been submitted.', { exact: true }),
    ).toBeVisible()
    await ownerPage.reload()
    await expect(ownerPage.getByText('Great care, thank you!', { exact: true })).toBeVisible()
  })

  await test.step('Sitter sees feedback and a persistent paid reward', async () => {
    await sitterPage.reload()
    const card = historyCard(sitterPage, plantName)
    await expect(card).toContainText('Reward paid')
    await expect(card.getByRole('button', { name: 'Claim reward', exact: true })).toHaveCount(0)
    await card.getByRole('button', { name: 'More details', exact: true }).click()
    await sitterPage
      .getByRole('dialog')
      .getByRole('link', { name: 'View visit page', exact: false })
      .click()
    await expect(sitterPage.getByText('Great care, thank you!', { exact: true })).toBeVisible()
    // Verify the actual balance using the existing token balance UI.
    await sitterPage.goto('/requests?tab=new')
    await expect(sitterPage.getByLabel('Token balances')).toContainText(
      `Total: ${care.sitter.user.tokenBalance + 2} tokens`,
    )
  })
})
