import type { GameRouteMetadata } from './types'

export const FANSTOCKS_METADATA: GameRouteMetadata = {
  id: 'fanstocks',
  path: '/fanstocks',
  title: 'FanStocks',
  eyebrow: 'Draft and simulation',
  tagline: 'Draft. Trade. Outperform.',
  description:
    'Build a three-stock portfolio, negotiate with rival bots, and race to Friday close.',
  howItWorks: [
    'Draft one stock from each of three candidate groups.',
    'Watch a seeded market week and answer one-for-one trade offers.',
    'Finish Friday with the highest simulated portfolio value.',
  ],
  coverLabel: 'Three stock cards arranged over a glowing market table',
  accent: 'yellow',
}

export const FOUNDER_MODE_METADATA: GameRouteMetadata = {
  id: 'founder-mode',
  path: '/founder-mode',
  title: 'Founder Mode',
  eyebrow: 'Five-decision narrative',
  tagline: 'Five calls. One legacy.',
  description:
    'Make five historical founder decisions and compare your valuation with reality.',
  howItWorks: [
    'Choose an episode and step into a documented founder dilemma.',
    'Make exactly five decisions with deterministic valuation feedback.',
    'Compare Reality versus You and review your founder-style mix.',
  ],
  coverLabel: 'Editorial founder portrait split by an upward valuation line',
  accent: 'green',
}

export const WALLSTREET_SURFERS_METADATA: GameRouteMetadata = {
  id: 'wallstreet-surfers',
  path: '/wallstreet-surfers',
  title: 'Wallstreet Surfers',
  eyebrow: 'Three-lane endless runner',
  tagline: 'Run the market.',
  description:
    'Dodge ticker trains, read market gates, collect coins, and keep Powell behind you.',
  howItWorks: [
    'Move across three lanes, jump barriers, and roll under hazards.',
    'Answer LONG with Up and SHORT with Down at market gates.',
    'Build score and streak while the pace and obstacle density rise.',
  ],
  coverLabel: 'A runner facing ticker trains in dramatic street perspective',
  accent: 'red',
}

export const GAME_METADATA = [
  FANSTOCKS_METADATA,
  FOUNDER_MODE_METADATA,
  WALLSTREET_SURFERS_METADATA,
] as const
