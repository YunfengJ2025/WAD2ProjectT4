import {
  test,
  expect,
  singaporeDate,
  requestCard,
  addPlantAndRequest,
  acceptRequest,
  registerCareAccount,
  signInCareAccount,
} from './care-helpers.js'

test('sitter opts out → owner notification → another sitter can accept', async ({
  care,
  browser,
  request,
  baseURL,
}) => {
  const { ownerPage, sitterPage, plantName } = care
  const date = singaporeDate(2) // Before the 24-hour penalty cutoff.
  await addPlantAndRequest(care, date)
  await acceptRequest(care, date)

  await test.step('Sitter opts out of the accepted visit', async () => {
    await requestCard(sitterPage, plantName)
      .getByRole('button', { name: 'View visit', exact: true })
      .click()
    sitterPage.once('dialog', (dialog) => dialog.accept())
    await sitterPage
      .getByRole('dialog')
      .getByRole('button', { name: 'Opt out of this visit', exact: true })
      .click()
    await expect(
      sitterPage
        .getByRole('status')
        .filter({ hasText: 'You opted out before the penalty cutoff.' }),
    ).toBeVisible()
    await sitterPage.reload()
    await expect(
      sitterPage.getByText('You have no accepted visits yet.', { exact: false }),
    ).toBeVisible()
  })

  await test.step('Owner sees the opt-out notification and reopened visit', async () => {
    await ownerPage.reload()
    await ownerPage.getByRole('button', { name: 'Notifications', exact: true }).click()
    await expect(
      ownerPage.getByRole('button', { name: 'The sitter opted out', exact: false }),
    ).toContainText('It is open for another sitter.')
    await ownerPage.getByRole('button', { name: 'Notifications', exact: true }).click()
    await expect(requestCard(ownerPage, plantName)).toContainText('waiting for a sitter')
  })

  await test.step('A different sitter accepts the reopened visit', async () => {
    // Fresh real account; sign in through the UI, then use the same map acceptance flow.
    const replacement = await registerCareAccount(request, 'replacement')
    const context = await browser.newContext({ baseURL, timezoneId: 'Asia/Singapore' })
    try {
      const page = await context.newPage()
      await signInCareAccount(page, replacement, '/my-sits')
      await acceptRequest({ ...care, sitterPage: page }, date)
      await ownerPage.reload()
      await expect(requestCard(ownerPage, plantName)).toContainText('sitter found')
    } finally {
      await context.close()
    }
  })
})
