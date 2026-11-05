import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import {
  test,
  expect,
  singaporeDate,
  requestCard,
  addPlantAndRequest,
  acceptRequest,
} from './care-helpers.js'

const run = promisify(execFile)

test('missed visit → notification → reservation released → replacement request', async ({
  care,
}) => {
  const { ownerPage, sitterPage, plantName } = care
  await addPlantAndRequest(care, singaporeDate())
  await acceptRequest(care, singaporeDate())

  await test.step('Advance the accepted test visit beyond its deadline and run the real sweeper', async () => {
    // A browser clock cannot advance the backend. This restricted CLI changes only test data.
    await requestCard(sitterPage, plantName)
      .getByRole('button', { name: 'Start visit', exact: true })
      .click()
    const label = await sitterPage.getByRole('dialog').getAttribute('aria-label')
    const visitId = label.match(/Visit (\d+) details/)[1]
    await sitterPage
      .getByRole('dialog')
      .getByRole('button', { name: 'Close details', exact: true })
      .click()
    await run(
      process.execPath,
      [
        fileURLToPath(new URL('../../server/e2e/miss-visit.cjs', import.meta.url)),
        visitId,
        String(care.owner.user.userId),
      ],
      {
        env: { ...process.env },
        timeout: 30000,
      },
    )
  })

  await test.step('Owner receives a missed-visit notification and gets the reserved reward back', async () => {
    await ownerPage.reload()
    await ownerPage.getByRole('button', { name: 'Notifications', exact: true }).click()
    await expect(
      ownerPage.getByRole('button', { name: /The sitter missed your.*2 tokens were returned/ }),
    ).toBeVisible()
    await ownerPage.getByRole('button', { name: 'Request make-up visit', exact: true }).click()
    await expect(requestCard(ownerPage, plantName)).toContainText('Missed')
    await ownerPage.goto('/requests?tab=new')
    await expect(ownerPage.getByLabel('Token balances')).toContainText(
      `Available: ${care.owner.user.tokenBalance}`,
    )
    await expect(
      ownerPage.getByLabel('Token balances').getByRole('button', { name: /^Frozen:/ }),
    ).toContainText('Frozen: 0')
  })

  await test.step('Owner creates a make-up request and it becomes available to sitters', async () => {
    await ownerPage.goto('/requests')
    await ownerPage.getByRole('button', { name: /^Completed/ }).click()
    await requestCard(ownerPage, plantName)
      .getByRole('button', { name: 'Request make-up visit', exact: true })
      .click()
    await expect(
      ownerPage.getByRole('status').filter({ hasText: /Make-up request #\d+ posted/ }),
    ).toBeVisible()
    await expect(requestCard(ownerPage, plantName)).toContainText('Make-up requested')
    await ownerPage.getByRole('button', { name: /^Active/ }).click()
    await expect(requestCard(ownerPage, plantName)).toContainText('waiting for a sitter')
    await sitterPage.goto('/my-sits')
    await expect(
      sitterPage.getByText('You have no accepted visits yet.', { exact: false }),
    ).toBeVisible()
    await sitterPage.getByRole('link', { name: 'Available sits', exact: true }).click()
    await sitterPage.getByRole('button', { name: 'See all requests', exact: true }).click()
    await expect(
      sitterPage.locator('.requestCard').filter({ hasText: care.owner.user.userName }),
    ).toBeVisible()
  })
})
