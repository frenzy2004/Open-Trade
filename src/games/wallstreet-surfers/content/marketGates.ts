export type MarketDirection = 'long' | 'short'

export interface MarketGate {
  readonly id: string
  readonly setup: string
  readonly ticker: string
  readonly answer: MarketDirection
  readonly explanation: string
  readonly difficulty: 1 | 2 | 3
}

const GATE_ID_PATTERN = /^[a-z0-9-]+$/
const TICKER_PATTERN = /^[A-Z]{2,5}$/
const GATE_FIELDS = [
  'id',
  'setup',
  'ticker',
  'answer',
  'explanation',
  'difficulty',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function assertMarketGate(
  gate: unknown,
  prefix = 'Market gate',
): asserts gate is MarketGate {
  if (!isRecord(gate)) throw new TypeError(`${prefix} must be an object`)
  for (const field of GATE_FIELDS) {
    if (!Object.hasOwn(gate, field)) {
      throw new TypeError(`${prefix}.${field} must be an own property`)
    }
  }
  if (typeof gate.id !== 'string' || !GATE_ID_PATTERN.test(gate.id)) {
    throw new TypeError(`${prefix}.id is invalid`)
  }
  if (typeof gate.setup !== 'string' || gate.setup.length < 20) {
    throw new TypeError(`${prefix}.setup must contain a complete scenario`)
  }
  if (typeof gate.ticker !== 'string' || !TICKER_PATTERN.test(gate.ticker)) {
    throw new TypeError(`${prefix}.ticker is invalid`)
  }
  if (gate.answer !== 'long' && gate.answer !== 'short') {
    throw new TypeError(`${prefix}.answer must be long or short`)
  }
  if (typeof gate.explanation !== 'string' || gate.explanation.length < 20) {
    throw new TypeError(`${prefix}.explanation must explain the answer`)
  }
  if (gate.difficulty !== 1 && gate.difficulty !== 2 && gate.difficulty !== 3) {
    throw new TypeError(`${prefix}.difficulty must be 1, 2, or 3`)
  }
}

export function cloneMarketGate(gate: MarketGate): MarketGate {
  assertMarketGate(gate)
  return Object.freeze({ ...gate })
}

const GATE_DEFINITIONS = [
  {
    id: 'earnings-beat',
    setup: 'Novaline earnings beat consensus as subscriptions and margins both accelerated.',
    ticker: 'NVLN',
    answer: 'long',
    explanation: 'A broad earnings beat with improving margins is an unambiguously positive surprise.',
    difficulty: 1,
  },
  {
    id: 'earnings-miss',
    setup: 'Copper Finch earnings missed estimates after unit sales and gross margin declined.',
    ticker: 'CFIN',
    answer: 'short',
    explanation: 'Falling sales and margins make the earnings miss an unambiguously negative update.',
    difficulty: 1,
  },
  {
    id: 'guidance-raised',
    setup: 'Orbit Pantry raised full-year revenue and profit guidance above the prior range.',
    ticker: 'ORPT',
    answer: 'long',
    explanation: 'Higher forward revenue and profit guidance improves expected future cash generation.',
    difficulty: 1,
  },
  {
    id: 'guidance-cut',
    setup: 'Velvet Grid cut next-quarter sales and operating-income guidance below consensus.',
    ticker: 'VGRD',
    answer: 'short',
    explanation: 'A forward guidance cut signals weaker demand and profitability than investors expected.',
    difficulty: 1,
  },
  {
    id: 'share-dilution',
    setup: 'Kite Harbor announced a large discounted share sale with no matching earnings upgrade.',
    ticker: 'KHBR',
    answer: 'short',
    explanation: 'Discounted dilution spreads unchanged value across more shares and pressures each share.',
    difficulty: 2,
  },
  {
    id: 'buyback-launch',
    setup: 'Mosaic Rail launched a funded buyback equal to twelve percent of outstanding shares.',
    ticker: 'MSRL',
    answer: 'long',
    explanation: 'A credible large buyback reduces share count and increases each remaining ownership claim.',
    difficulty: 2,
  },
  {
    id: 'rate-shock',
    setup: 'Bond yields jumped after an unexpected rate hike, raising Aurora Cloud financing costs.',
    ticker: 'AUCL',
    answer: 'short',
    explanation: 'Higher discount rates and borrowing costs reduce the value of distant growth cash flows.',
    difficulty: 2,
  },
  {
    id: 'rate-relief',
    setup: 'An unexpected rate cut lowered funding costs for leveraged homebuilder Cedar Arc.',
    ticker: 'CDAR',
    answer: 'long',
    explanation: 'Lower borrowing and mortgage rates directly improve financing-sensitive housing demand.',
    difficulty: 2,
  },
  {
    id: 'approval-won',
    setup: 'Regulators approved Blue Ember Medical’s lead therapy without a restrictive warning.',
    ticker: 'BEMD',
    answer: 'long',
    explanation: 'Unrestricted approval clears the primary barrier to commercial sales of the therapy.',
    difficulty: 1,
  },
  {
    id: 'approval-rejected',
    setup: 'Regulators rejected Lumen Vale Bio’s only late-stage therapy and requested another trial.',
    ticker: 'LVBI',
    answer: 'short',
    explanation: 'Rejection delays revenue and adds costly trial risk to the company’s only lead asset.',
    difficulty: 1,
  },
  {
    id: 'input-cost-rise',
    setup: 'Cocoa prices doubled while Truffle Works kept retail prices and guidance unchanged.',
    ticker: 'TRFW',
    answer: 'short',
    explanation: 'A sharp unpriced input-cost increase compresses the manufacturer’s expected margins.',
    difficulty: 2,
  },
  {
    id: 'input-cost-fall',
    setup: 'Freight and resin costs fell sharply for Parcel Bloom while selling prices held firm.',
    ticker: 'PCBL',
    answer: 'long',
    explanation: 'Lower inputs with stable selling prices expand expected unit margins and cash flow.',
    difficulty: 2,
  },
  {
    id: 'demand-accelerates',
    setup: 'Weekly orders at Quasar Tools accelerated for eight weeks with no promotional discounting.',
    ticker: 'QSTL',
    answer: 'long',
    explanation: 'Sustained full-price order acceleration signals stronger underlying customer demand.',
    difficulty: 1,
  },
  {
    id: 'demand-slows',
    setup: 'Daily active users and paid conversions at Pixel Orchard declined for a third month.',
    ticker: 'PXOR',
    answer: 'short',
    explanation: 'Persistent declines in usage and conversion point to weakening product demand.',
    difficulty: 1,
  },
  {
    id: 'margin-expansion',
    setup: 'Saffron Circuit held sales guidance but raised margin guidance after automation gains.',
    ticker: 'SFCT',
    answer: 'long',
    explanation: 'Higher margins on unchanged sales increase expected operating profit and cash flow.',
    difficulty: 2,
  },
  {
    id: 'restatement-risk',
    setup: 'Harbor Metric will restate two years of profit after finding premature revenue recognition.',
    ticker: 'HBMT',
    answer: 'short',
    explanation: 'A revenue-recognition restatement undermines reported earnings and management credibility.',
    difficulty: 3,
  },
  {
    id: 'refinancing-secured',
    setup: 'Granite Loop refinanced near-term debt at a lower rate with no equity dilution.',
    ticker: 'GRLP',
    answer: 'long',
    explanation: 'Cheaper long-dated debt removes refinancing risk without reducing shareholder ownership.',
    difficulty: 3,
  },
  {
    id: 'product-recall',
    setup: 'Nimbus Kettle recalled its highest-margin product and suspended shipments for inspection.',
    ticker: 'NMKT',
    answer: 'short',
    explanation: 'The recall removes profitable sales while adding remediation and reputation costs.',
    difficulty: 2,
  },
  {
    id: 'contract-win',
    setup: 'Iron Meadow won a five-year contract worth more than its prior annual revenue.',
    ticker: 'IRMD',
    answer: 'long',
    explanation: 'A funded multi-year contract materially increases visible future revenue and scale.',
    difficulty: 3,
  },
  {
    id: 'customer-loss',
    setup: 'Echo Basin lost a customer responsible for one quarter of its annual revenue.',
    ticker: 'ECBS',
    answer: 'short',
    explanation: 'Losing a concentrated customer creates an immediate, material revenue shortfall.',
    difficulty: 3,
  },
] as const satisfies readonly MarketGate[]

export const MARKET_GATES: readonly MarketGate[] = Object.freeze(
  GATE_DEFINITIONS.map((gate) => cloneMarketGate(gate)),
)
