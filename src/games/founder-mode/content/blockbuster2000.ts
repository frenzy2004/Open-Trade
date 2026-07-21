import { freezeEpisode } from './freezeEpisode'
import type { FounderEpisode } from './types'

export const blockbuster2000: FounderEpisode = freezeEpisode({
  id: 'blockbuster-2000',
  episodeNumber: 1,
  company: 'Blockbuster',
  founder: 'John Antioco leadership team',
  startYear: 2000,
  rulesetVersion: 1,
  initialValueBn: 5,
  historicalEndValueBn: 1.2,
  intro: {
    classic:
      'Blockbuster’s global stores dominate home-video rental, but broadband, DVD-by-mail, and heavy obligations are changing the economics. Decide whether the incumbent can migrate before its footprint becomes a trap.',
    brainrot:
      'Blockbuster owns Friday night, thousands of stores, and a dangerous amount of fixed cost. DVD-by-mail is knocking; evolve the giant before the blue signs become expensive nostalgia.',
  },
  sources: [
    {
      id: 'blockbuster-netflix-meeting',
      title: 'Inside Netflix’s 2000 Meeting with Blockbuster',
      url: 'https://www.vanityfair.com/news/2019/09/netflixs-crazy-doomed-meeting-with-blockbuster',
      publisher: 'Vanity Fair, adapted from Marc Randolph’s firsthand account',
      accessed: '2026-07-21',
    },
    {
      id: 'blockbuster-2005-10k',
      title: 'Blockbuster 2005 Annual Report on Form 10-K',
      url: 'https://www.sec.gov/Archives/edgar/data/1085734/000119312506055023/d10k.htm',
      publisher: 'U.S. Securities and Exchange Commission',
      accessed: '2026-07-21',
    },
    {
      id: 'blockbuster-2007-10k',
      title: 'Blockbuster 2007 Annual Report on Form 10-K',
      url: 'https://www.sec.gov/Archives/edgar/data/1085734/000119312508048757/d10k.htm',
      publisher: 'U.S. Securities and Exchange Commission',
      accessed: '2026-07-21',
    },
    {
      id: 'blockbuster-2010-10k',
      title: 'Blockbuster 2009 Annual Report on Form 10-K',
      url: 'https://www.sec.gov/Archives/edgar/data/1085734/000119312510058339/d10k.htm',
      publisher: 'U.S. Securities and Exchange Commission',
      accessed: '2026-07-21',
    },
    {
      id: 'blockbuster-recapitalization',
      title: 'Blockbuster Announces Chapter 11 Recapitalization Plan',
      url: 'https://www.sec.gov/Archives/edgar/data/1085734/000119312510215765/dex991.htm',
      publisher: 'Blockbuster via U.S. Securities and Exchange Commission',
      accessed: '2026-07-21',
    },
  ],
  decisions: [
    {
      id: 'netflix-acquisition',
      year: 2000,
      prompt: {
        classic:
          'Netflix’s founders propose a roughly $50 million sale and a role powering Blockbuster’s online business. Do you acquire the startup, form a partnership, or dismiss mail rental as a niche?',
        brainrot:
          'A tiny DVD-mail startup asks about a $50 million sale and offers to run your online lane. Buy Netflix, partner with the nerds, or laugh the dot-com pitch out of Dallas?',
      },
      sourceIds: ['blockbuster-netflix-meeting'],
      choices: [
        {
          id: 'decline-netflix',
          label: 'Decline Netflix and back the store network',
          matchedHistory: true,
          worked: false,
          valueMultiplier: 0.92,
          styleWeights: { visionary: 0, operator: 2, consensus: 3 },
          outcome: {
            classic:
              'Avoiding an unprofitable startup protects near-term focus, but Blockbuster loses an inexpensive team, subscription model, and digital learning engine.',
            brainrot:
              'The stores look unbeatable and the startup looks tiny, so you pass; the cheap learning engine leaves and returns later as the final boss.',
          },
        },
        {
          id: 'acquire-netflix',
          label: 'Acquire Netflix and protect its autonomous team',
          matchedHistory: false,
          worked: true,
          valueMultiplier: 1.22,
          styleWeights: { visionary: 3, operator: 2, consensus: 0 },
          outcome: {
            classic:
              'The purchase adds subscription expertise and customer data at manageable scale; autonomy keeps the new model from being optimized around stores.',
            brainrot:
              'You buy the future before it has a giant valuation and keep its team out of store politics; the disruption now works for Blockbuster.',
          },
        },
        {
          id: 'distribution-partnership',
          label: 'Partner on subscriptions without an acquisition',
          matchedHistory: false,
          worked: true,
          valueMultiplier: 1.12,
          styleWeights: { visionary: 1, operator: 3, consensus: 1 },
          outcome: {
            classic:
              'A partnership limits capital risk and teaches subscription operations, though shared control leaves both parties free to become competitors later.',
            brainrot:
              'You rent the startup’s playbook instead of buying it; the online muscles grow, but Netflix can still level up into a rival on its own.',
          },
        },
      ],
    },
    {
      id: 'sustainable-late-fees',
      year: 2004,
      prompt: {
        classic:
          'Customers resent late fees, a meaningful revenue source. Do you remove them with automatic sale/restocking terms, replace them with a clear subscription, or preserve the existing policy?',
        brainrot:
          'Late fees print money and customer resentment. Delete them with a confusing auto-sale mechanic, swap in a transparent membership, or defend the fee machine?',
      },
      sourceIds: ['blockbuster-2005-10k'],
      choices: [
        {
          id: 'auto-sale-program',
          label: 'End late fees with auto-sale and restocking terms',
          matchedHistory: true,
          worked: false,
          valueMultiplier: 0.87,
          styleWeights: { visionary: 2, operator: 1, consensus: 2 },
          outcome: {
            classic:
              'The headline addresses a major complaint, but replacement charges confuse customers while lost fee revenue and higher inventory needs pressure margins.',
            brainrot:
              '“No late fees” wins the billboard and the fine print adds an auto-purchase plot twist; goodwill and margin both arrive with damage.',
          },
        },
        {
          id: 'transparent-subscription',
          label: 'Replace fees with a transparent subscription',
          matchedHistory: false,
          worked: true,
          valueMultiplier: 1.14,
          styleWeights: { visionary: 1, operator: 3, consensus: 1 },
          outcome: {
            classic:
              'A simple recurring price aligns incentives and makes retention measurable, while careful pilots fund inventory and protect store economics.',
            brainrot:
              'One clear monthly price replaces penalty roulette; pilots tune inventory, customers understand the deal, and recurring revenue becomes real.',
          },
        },
        {
          id: 'keep-late-fees',
          label: 'Keep late fees and improve reminders',
          matchedHistory: false,
          worked: false,
          valueMultiplier: 0.82,
          styleWeights: { visionary: 0, operator: 2, consensus: 3 },
          outcome: {
            classic:
              'Reminders soften surprises but preserve a revenue model customers increasingly compare with no-late-fee subscription alternatives.',
            brainrot:
              'Push notifications make the penalty less surprising, not less annoying; competitors still market your most hated revenue line against you.',
          },
        },
      ],
    },
    {
      id: 'online-subscriptions',
      year: 2004,
      prompt: {
        classic:
          'DVD-by-mail is growing while new stores still promise local reach. Do you prioritize online subscriptions, treat online as a store add-on, or continue store expansion?',
        brainrot:
          'Mail subscriptions are scaling while real estate still looks like the main quest. Put online first, bolt it onto stores, or keep planting blue signs?',
      },
      sourceIds: ['blockbuster-2005-10k', 'blockbuster-2007-10k'],
      choices: [
        {
          id: 'store-first-online-addon',
          label: 'Keep stores primary and treat online as an add-on',
          matchedHistory: true,
          worked: false,
          valueMultiplier: 0.84,
          styleWeights: { visionary: 0, operator: 2, consensus: 3 },
          outcome: {
            classic:
              'Online launches, but store metrics and budgets constrain it; the company learns the new channel while remaining committed to the old cost base.',
            brainrot:
              'The website exists and every important decision still reports to the store empire; digital learns with ankle weights while leases keep multiplying.',
          },
        },
        {
          id: 'online-first',
          label: 'Prioritize the online subscription business',
          matchedHistory: false,
          worked: true,
          valueMultiplier: 1.2,
          styleWeights: { visionary: 3, operator: 2, consensus: 0 },
          outcome: {
            classic:
              'Capital and leadership shift toward recurring subscriptions, letting fulfillment scale while store growth slows before leases become immovable.',
            brainrot:
              'Online gets the budget, talent, and scoreboard; stores stop expanding before every lease becomes a boss battle against changing behavior.',
          },
        },
        {
          id: 'franchise-fulfillment',
          label: 'Convert stores into franchised pickup and fulfillment hubs',
          matchedHistory: false,
          worked: true,
          valueMultiplier: 1.08,
          styleWeights: { visionary: 2, operator: 2, consensus: 1 },
          outcome: {
            classic:
              'A lighter network preserves convenience and brand presence while shifting fixed costs, though franchise coordination slows digital iteration.',
            brainrot:
              'The stores evolve into local logistics nodes with less corporate weight; the hybrid has promise, but franchise sync adds multiplayer lag.',
          },
        },
      ],
    },
    {
      id: 'stores-mail-integration',
      year: 2006,
      prompt: {
        classic:
          'Total Access can let mail subscribers exchange discs in stores. Do you offer unlimited free exchanges, price usage sustainably, or keep the channels separate?',
        brainrot:
          'Total Access can turn every store into a mail-return portal. Give away unlimited swaps, meter the expensive magic, or keep online and stores in separate timelines?',
      },
      sourceIds: ['blockbuster-2007-10k'],
      choices: [
        {
          id: 'unlimited-exchanges',
          label: 'Offer unlimited free in-store exchanges',
          matchedHistory: true,
          worked: false,
          valueMultiplier: 0.94,
          styleWeights: { visionary: 2, operator: 1, consensus: 1 },
          outcome: {
            classic:
              'Subscriber growth proves the integrated concept, but free exchanges generate roughly $140 million in 2007 costs and erode profitability.',
            brainrot:
              'Customers love the infinite swap combo and the cost ledger absolutely does not; growth arrives carrying about $140 million of pain.',
          },
        },
        {
          id: 'priced-exchanges',
          label: 'Include a measured exchange allowance by plan',
          matchedHistory: false,
          worked: true,
          valueMultiplier: 1.13,
          styleWeights: { visionary: 1, operator: 3, consensus: 1 },
          outcome: {
            classic:
              'Tiered allowances preserve the distinctive store benefit while usage data informs pricing, inventory, and which locations remain productive.',
            brainrot:
              'The hybrid perk stays, but the free buffet becomes a measured plan; customer value survives and the unit economics stop screaming.',
          },
        },
        {
          id: 'separate-channels',
          label: 'Keep mail and store subscriptions separate',
          matchedHistory: false,
          worked: false,
          valueMultiplier: 0.83,
          styleWeights: { visionary: 0, operator: 2, consensus: 3 },
          outcome: {
            classic:
              'Separation avoids exchange costs but wastes the network’s only distinctive advantage and leaves customers managing incompatible services.',
            brainrot:
              'The accounting stays tidy and the customer gets two unrelated products; thousands of stores contribute zero special sauce to online.',
          },
        },
      ],
    },
    {
      id: 'recapitalize-before-crisis',
      year: 2007,
      prompt: {
        classic:
          'Store traffic is declining and debt restricts investment. Do you defer restructuring, close weak stores and recapitalize early, or sell assets into a strategic combination?',
        brainrot:
          'Traffic is down, leases are long, and debt is sitting on the remote. Wait for the crisis, cut and recap now, or sell pieces while buyers still answer?',
      },
      sourceIds: [
        'blockbuster-2007-10k',
        'blockbuster-2010-10k',
        'blockbuster-recapitalization',
      ],
      choices: [
        {
          id: 'defer-restructuring',
          label: 'Defer major restructuring and preserve the footprint',
          matchedHistory: true,
          worked: false,
          valueMultiplier: 0.78,
          styleWeights: { visionary: 0, operator: 1, consensus: 4 },
          outcome: {
            classic:
              'Delay preserves near-term revenue but lets debt and leases consume strategic freedom until a 2010 Chapter 11 process dictates the recapitalization.',
            brainrot:
              'You keep every option open until debt closes them all; by 2010, Chapter 11 becomes the project manager and the runway is already gone.',
          },
        },
        {
          id: 'early-recapitalization',
          label: 'Close weak stores and recapitalize before distress',
          matchedHistory: false,
          worked: true,
          valueMultiplier: 1.2,
          styleWeights: { visionary: 2, operator: 3, consensus: 0 },
          outcome: {
            classic:
              'Early closures and negotiated debt reduction are painful, but they preserve cash for digital products and retain bargaining power with creditors.',
            brainrot:
              'You take the ugly medicine while the company can still choose the dosage; fewer stores and less debt fund an actual digital comeback attempt.',
          },
        },
        {
          id: 'strategic-sale',
          label: 'Sell selected assets and pursue a strategic merger',
          matchedHistory: false,
          worked: true,
          valueMultiplier: 1.05,
          styleWeights: { visionary: 1, operator: 2, consensus: 2 },
          outcome: {
            classic:
              'An orderly combination sacrifices independence but monetizes assets before distress and can place the subscriber base inside a stronger balance sheet.',
            brainrot:
              'You trade independence for oxygen while the assets still have buyers; not a heroic ending, but far better than selling from bankruptcy spawn.',
          },
        },
      ],
    },
  ],
})
