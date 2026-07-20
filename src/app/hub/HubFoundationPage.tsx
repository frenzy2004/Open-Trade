import { APP_DISCLAIMER } from '../appMeta'

export function HubFoundationPage() {
  return (
    <section className="hub-foundation">
      <p className="hub-foundation__eyebrow">Three simulated markets</p>
      <h1>Choose your market</h1>
      <p>
        Draft a portfolio, rewrite a founder decision, or run the market.
      </p>
      <p>{APP_DISCLAIMER}</p>
    </section>
  )
}
