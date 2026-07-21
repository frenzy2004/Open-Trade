export type SeasonDirection = 'long' | 'short'
export type SeasonUpdateDay = 'Tuesday' | 'Wednesday' | 'Thursday'
export type SeasonIdealResponse = 'hold' | 'increase' | 'reduce' | 'flip'

export interface SeasonEvidenceUpdate {
  readonly index: 0 | 1 | 2
  readonly day: SeasonUpdateDay
  readonly title: string
  readonly summary: string
  readonly aiConfidence: number
  readonly counterargument: string
  readonly catalyst: string
  readonly idealResponse: SeasonIdealResponse
}

export interface SeasonThesisResult {
  readonly direction: SeasonDirection
  readonly assetReturnBps: number
  readonly benchmarkReturnBps: number
  readonly reasonSignals: readonly string[]
  readonly verdict: string
  readonly outcomeSummary: string
}

export interface SeasonThesis {
  readonly id: string
  readonly ticker: string
  readonly company: string
  readonly title: string
  readonly prompt: string
  readonly benchmark: string
  readonly startingAiConfidence: number
  readonly updates: readonly [
    SeasonEvidenceUpdate,
    SeasonEvidenceUpdate,
    SeasonEvidenceUpdate,
  ]
  readonly result: SeasonThesisResult
}

function freezeThesis(thesis: SeasonThesis): SeasonThesis {
  const updates = thesis.updates.map((update) => Object.freeze({ ...update })) as unknown as SeasonThesis['updates']
  const result = Object.freeze({
    ...thesis.result,
    reasonSignals: Object.freeze([...thesis.result.reasonSignals]),
  })
  return Object.freeze({ ...thesis, updates: Object.freeze(updates), result })
}

export const SEASON_THESIS_DECK: readonly SeasonThesis[] = Object.freeze([
  freezeThesis({
    id: 'nvda-ai-capex',
    ticker: 'NVDA',
    company: 'Nvidia',
    title: 'Can AI infrastructure demand outrun expectations?',
    prompt: 'Enterprise accelerator demand and hyperscaler capital spending may keep Nvidia growth above the market consensus this week.',
    benchmark: 'QQQ',
    startingAiConfidence: 67,
    updates: [
      { index: 0, day: 'Tuesday', title: 'A cloud buyer expands orders', summary: 'A major cloud platform raises its accelerator order plan, while lead times remain elevated across the newest architecture.', aiConfidence: 73, counterargument: 'The order could pull demand forward from next quarter.', catalyst: 'Supplier channel checks arrive Wednesday.', idealResponse: 'increase' },
      { index: 1, day: 'Wednesday', title: 'Supply catches up faster', summary: 'Packaging availability improves sooner than expected, reducing scarcity but also unlocking more near-term shipments.', aiConfidence: 70, counterargument: 'Better supply can pressure premium pricing as alternatives mature.', catalyst: 'Management speaks at an industry conference.', idealResponse: 'hold' },
      { index: 2, day: 'Thursday', title: 'Margins become the debate', summary: 'Conference remarks confirm a strong backlog but point to launch costs that may temporarily compress gross margin.', aiConfidence: 62, counterargument: 'Backlog strength may matter more than a modest one-quarter margin dip.', catalyst: 'Friday peer spending data closes the case.', idealResponse: 'reduce' },
    ],
    result: { direction: 'long', assetReturnBps: 620, benchmarkReturnBps: 135, reasonSignals: ['accelerator', 'demand', 'backlog', 'capex'], verdict: 'Demand held; margin caution only trimmed the magnitude.', outcomeSummary: 'Peer spending data confirmed durable accelerator demand and Nvidia finished 4.85% ahead of QQQ.' },
  }),
  freezeThesis({
    id: 'meta-ad-efficiency',
    ticker: 'META',
    company: 'Meta Platforms',
    title: 'Will AI ad tools defend Meta margins?',
    prompt: 'Improving ad conversion and disciplined operating expenses may outweigh another step-up in artificial-intelligence infrastructure spending.',
    benchmark: 'QQQ',
    startingAiConfidence: 61,
    updates: [
      { index: 0, day: 'Tuesday', title: 'Advertisers report stronger conversion', summary: 'Agency checks show automated campaign tools lifting conversion rates for small and midsize advertisers.', aiConfidence: 68, counterargument: 'Agency surveys can overrepresent the best-performing campaigns.', catalyst: 'Digital ad pricing data posts Wednesday.', idealResponse: 'increase' },
      { index: 1, day: 'Wednesday', title: 'Pricing softens in Europe', summary: 'European impression pricing falls as privacy changes create a temporary measurement gap for several verticals.', aiConfidence: 58, counterargument: 'Volume growth could still offset weaker price per impression.', catalyst: 'A regulatory ruling lands Thursday.', idealResponse: 'reduce' },
      { index: 2, day: 'Thursday', title: 'Regulatory risk clears', summary: 'The ruling avoids the harshest remedy and preserves Meta’s ability to offer personalized advertising with consent.', aiConfidence: 66, counterargument: 'Infrastructure depreciation remains a drag on operating margin.', catalyst: 'Friday platform engagement estimates settle the week.', idealResponse: 'increase' },
    ],
    result: { direction: 'long', assetReturnBps: 340, benchmarkReturnBps: 125, reasonSignals: ['conversion', 'advertising', 'engagement', 'expense'], verdict: 'Conversion strength outweighed infrastructure expense.', outcomeSummary: 'Engagement and conversion estimates beat expectations, leaving Meta 2.15% ahead of QQQ.' },
  }),
  freezeThesis({
    id: 'tsla-margin-reset',
    ticker: 'TSLA',
    company: 'Tesla',
    title: 'Do price cuts force another margin reset?',
    prompt: 'Vehicle incentives and mix pressure may outweigh unit growth, leaving Tesla weaker than the broad consumer-discretionary benchmark.',
    benchmark: 'XLY',
    startingAiConfidence: 64,
    updates: [
      { index: 0, day: 'Tuesday', title: 'Inventory discounts broaden', summary: 'Tesla extends inventory discounts to more trims in two regions, increasing concern about clearing unsold vehicles.', aiConfidence: 70, counterargument: 'Discounted inventory may simply precede a model refresh.', catalyst: 'Registration data arrives Wednesday.', idealResponse: 'increase' },
      { index: 1, day: 'Wednesday', title: 'Registrations surprise higher', summary: 'Weekly registrations rebound sharply, suggesting discounts are generating real volume rather than only shifting timing.', aiConfidence: 59, counterargument: 'The rebound still relies on unusually rich incentives.', catalyst: 'Battery cost estimates update Thursday.', idealResponse: 'reduce' },
      { index: 2, day: 'Thursday', title: 'Battery costs fail to offset incentives', summary: 'Cell cost improvements appear smaller than the effective price reductions embedded in current promotions.', aiConfidence: 69, counterargument: 'Software revenue could cushion automotive gross margin.', catalyst: 'Friday delivery-mix estimates settle the case.', idealResponse: 'increase' },
    ],
    result: { direction: 'short', assetReturnBps: -470, benchmarkReturnBps: 80, reasonSignals: ['margin', 'discount', 'incentive', 'inventory'], verdict: 'The margin-reset thesis held despite stronger registrations.', outcomeSummary: 'A weak delivery mix put Tesla 5.50% behind XLY for the week.' },
  }),
  freezeThesis({
    id: 'amzn-cloud-acceleration',
    ticker: 'AMZN',
    company: 'Amazon',
    title: 'Is AWS growth accelerating again?',
    prompt: 'Cloud migrations and generative-AI workloads may lift AWS growth enough to offset fulfillment and wage pressure in retail operations.',
    benchmark: 'QQQ',
    startingAiConfidence: 63,
    updates: [
      { index: 0, day: 'Tuesday', title: 'A large migration slips', summary: 'A widely watched enterprise migration moves into next quarter after integration testing takes longer than planned.', aiConfidence: 55, counterargument: 'One delayed migration does not change the broader pipeline.', catalyst: 'Cloud reseller checks arrive Wednesday.', idealResponse: 'reduce' },
      { index: 1, day: 'Wednesday', title: 'Resellers see broader demand', summary: 'Channel partners report accelerating database and model-training workloads across several industries, not one flagship deal.', aiConfidence: 64, counterargument: 'Reseller optimism may not translate into recognized revenue immediately.', catalyst: 'A logistics wage agreement is due Thursday.', idealResponse: 'increase' },
      { index: 2, day: 'Thursday', title: 'Retail costs stay contained', summary: 'The wage agreement lands near the low end of estimates and preserves most of the quarter’s fulfillment-efficiency gains.', aiConfidence: 71, counterargument: 'Consumers may trade down after recent macro data.', catalyst: 'Friday cloud consumption estimates close the week.', idealResponse: 'increase' },
    ],
    result: { direction: 'long', assetReturnBps: 415, benchmarkReturnBps: 140, reasonSignals: ['cloud', 'aws', 'migration', 'workload'], verdict: 'Broad cloud consumption overcame the delayed flagship migration.', outcomeSummary: 'AWS consumption estimates accelerated and Amazon beat QQQ by 2.75%.' },
  }),
  freezeThesis({
    id: 'xle-supply-squeeze',
    ticker: 'XLE',
    company: 'Energy Select Sector SPDR',
    title: 'Will constrained supply lift energy shares?',
    prompt: 'Tighter crude inventories and producer discipline may push energy equities above the S&P 500 even if demand data stays mixed.',
    benchmark: 'SPY',
    startingAiConfidence: 58,
    updates: [
      { index: 0, day: 'Tuesday', title: 'Inventories build unexpectedly', summary: 'Weekly crude inventories rise as refinery maintenance temporarily reduces demand for feedstock.', aiConfidence: 49, counterargument: 'Maintenance-driven builds often reverse quickly.', catalyst: 'Producer guidance updates Wednesday.', idealResponse: 'reduce' },
      { index: 1, day: 'Wednesday', title: 'Producers keep capital discipline', summary: 'Two large producers reiterate flat drilling budgets despite higher spot prices, limiting the supply response.', aiConfidence: 58, counterargument: 'Private operators could fill the production gap.', catalyst: 'Shipping data arrives Thursday.', idealResponse: 'increase' },
      { index: 2, day: 'Thursday', title: 'Exports absorb the build', summary: 'Shipping data shows a surge in crude exports that more than offsets the maintenance-related inventory build.', aiConfidence: 67, counterargument: 'A stronger dollar may cap the next leg of oil demand.', catalyst: 'Friday rig counts settle the supply view.', idealResponse: 'increase' },
    ],
    result: { direction: 'long', assetReturnBps: 285, benchmarkReturnBps: 65, reasonSignals: ['supply', 'inventory', 'export', 'discipline'], verdict: 'Producer discipline and exports validated the supply case.', outcomeSummary: 'Energy shares outpaced SPY by 2.20% as the inventory build proved temporary.' },
  }),
  freezeThesis({
    id: 'dkng-promo-normalization',
    ticker: 'DKNG',
    company: 'DraftKings',
    title: 'Can lower promotions unlock sportsbook leverage?',
    prompt: 'Falling customer-acquisition promotions may improve sportsbook contribution profit even as state taxes and competition remain elevated.',
    benchmark: 'IWM',
    startingAiConfidence: 56,
    updates: [
      { index: 0, day: 'Tuesday', title: 'A rival raises promotions', summary: 'A major competitor launches aggressive acquisition offers around a marquee event, risking a fresh promotional cycle.', aiConfidence: 47, counterargument: 'DraftKings may choose not to match uneconomic offers.', catalyst: 'App-ranking data arrives Wednesday.', idealResponse: 'reduce' },
      { index: 1, day: 'Wednesday', title: 'Engagement holds without matching', summary: 'App rankings remain stable even though DraftKings keeps its promotional offers below the rival campaign.', aiConfidence: 59, counterargument: 'Rankings do not reveal the quality or cost of acquired users.', catalyst: 'A state tax proposal is heard Thursday.', idealResponse: 'increase' },
      { index: 2, day: 'Thursday', title: 'Tax proposal advances', summary: 'Lawmakers advance a higher sportsbook tax rate, directly pressuring the operating-leverage thesis in a key market.', aiConfidence: 44, counterargument: 'The final rate could be negotiated down before passage.', catalyst: 'Friday handle estimates settle the case.', idealResponse: 'flip' },
    ],
    result: { direction: 'short', assetReturnBps: -310, benchmarkReturnBps: 55, reasonSignals: ['promotion', 'tax', 'acquisition', 'leverage'], verdict: 'Tax risk overwhelmed the early improvement in promotion efficiency.', outcomeSummary: 'The tax proposal triggered estimate cuts and DraftKings lagged IWM by 3.65%.' },
  }),
])

export function findSeasonThesis(thesisId: string): SeasonThesis | null {
  return SEASON_THESIS_DECK.find((thesis) => thesis.id === thesisId) ?? null
}
