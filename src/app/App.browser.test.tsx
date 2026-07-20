import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { App } from './App'

test('renders the product heading and disclaimer', async () => {
  const screen = await render(<App />)

  await expect.element(
    screen.getByRole('heading', { name: 'OpenTrade', level: 1 }),
  ).toBeVisible()
  await expect.element(
    screen.getByText('Simulated game — not investment advice'),
  ).toBeVisible()
})
