import { freezeEpisode } from './freezeEpisode'
import type { FounderEpisode } from './types'

export const netflix2011: FounderEpisode = freezeEpisode({
  id: 'netflix-2011',
  episodeNumber: 4,
  company: 'Netflix',
  founder: 'Reed Hastings',
  startYear: 2011,
  rulesetVersion: 1,
  initialValueBn: 20,
  historicalEndValueBn: 25,
  intro: {
    classic:
      'Streaming is accelerating, DVDs still finance the transition, and every move risks confusing a fast-growing subscriber base. Guide Netflix through five linked bets in 2011.',
    brainrot:
      'Streaming is speed-running the future while the DVD cash cow still pays rent. Keep Netflix from ratioing its own subscribers through five very public 2011 bets.',
  },
  sources: [
    {
      id: 'netflix-q1-letter',
      title: 'Netflix Q1 2011 Letter to Shareholders',
      url: 'https://www.sec.gov/Archives/edgar/data/1065280/000119312511107751/dex991.htm',
      publisher: 'Netflix via U.S. Securities and Exchange Commission',
      accessed: '2026-07-21',
    },
    {
      id: 'netflix-2011-results',
      title: 'Netflix 2011 Financial Releases',
      url: 'https://ir.netflix.net/investor-news-and-events/financial-releases/2011/default.aspx',
      publisher: 'Netflix Investor Relations',
      accessed: '2026-07-21',
    },
    {
      id: 'netflix-2011-10k',
      title: 'Netflix 2011 Annual Report on Form 10-K',
      url: 'https://www.sec.gov/Archives/edgar/data/1065280/000119312512053009/d260328d10k.htm',
      publisher: 'U.S. Securities and Exchange Commission',
      accessed: '2026-07-21',
    },
    {
      id: 'netflix-q4-letter',
      title: 'Netflix Q4 2011 Investor Letter',
      url: 'https://s22.q4cdn.com/959853165/files/doc_financials/quarterly_reports/2011/q4/Investor-Letter-Q4-2011.pdf',
      publisher: 'Netflix Investor Relations',
      accessed: '2026-07-21',
    },
  ],
  decisions: [
    {
      id: 'split-pricing',
      year: 2011,
      prompt: {
        classic:
          'DVD and streaming now have different cost curves. Do you separate their prices immediately, preserve the bundle, or phase customers into the new model?',
        brainrot:
          'DVD mailers and streaming bits are two different beasts sharing one checkout. Do you hard-split the bill, keep the combo meal, or migrate without jump-scaring everyone?',
      },
      sourceIds: ['netflix-q1-letter', 'netflix-2011-10k'],
      choices: [
        {
          id: 'unbundle-now',
          label: 'Unbundle and reprice immediately',
          matchedHistory: true,
          worked: false,
          valueMultiplier: 0.92,
          styleWeights: { visionary: 2, operator: 1, consensus: 0 },
          outcome: {
            classic:
              'The economics become clearer, but the abrupt effective increase angers combined-plan members and damages hard-earned trust.',
            brainrot:
              'The spreadsheet gets clean while the customer timeline catches fire; the surprise price jump turns goodwill into a cancellation button.',
          },
        },
        {
          id: 'keep-bundle',
          label: 'Keep one bundle through the transition',
          matchedHistory: false,
          worked: true,
          valueMultiplier: 1.1,
          styleWeights: { visionary: 0, operator: 2, consensus: 2 },
          outcome: {
            classic:
              'A familiar bill protects retention while operations prepare a later separation, though streaming investment grows more slowly.',
            brainrot:
              'No billing plot twist means fewer rage-quits, buying the ops team time to untangle the bundle without setting growth to hard mode.',
          },
        },
        {
          id: 'phase-by-cohort',
          label: 'Grandfather members, then phase by cohort',
          matchedHistory: false,
          worked: true,
          valueMultiplier: 1.16,
          styleWeights: { visionary: 1, operator: 3, consensus: 1 },
          outcome: {
            classic:
              'Grandfathering and clear notice preserve trust while new subscribers establish sustainable streaming and DVD price points.',
            brainrot:
              'You ship the price migration in waves instead of dropping a billing nuke; members get context and the unit economics still level up.',
          },
        },
      ],
    },
    {
      id: 'announce-qwikster',
      year: 2011,
      prompt: {
        classic:
          'The teams want operational focus. Should the DVD service become a separate Qwikster brand and website, remain one branded account, or wait for customer evidence?',
        brainrot:
          'Ops wants a clean split and someone brought the name “Qwikster” to the boardroom. New brand, invisible back-end split, or maybe test the vibes first?',
      },
      sourceIds: ['netflix-2011-results', 'netflix-2011-10k'],
      choices: [
        {
          id: 'launch-qwikster',
          label: 'Launch Qwikster as a separate service',
          matchedHistory: true,
          worked: false,
          valueMultiplier: 0.84,
          styleWeights: { visionary: 3, operator: 0, consensus: 0 },
          outcome: {
            classic:
              'Separate sites and queues add customer friction just after the price shock, compounding cancellations and reputational damage.',
            brainrot:
              'You add a second login right after the price drama; customers reject the Qwikster side quest and the churn chart goes vertical.',
          },
        },
        {
          id: 'one-brand-two-operations',
          label: 'Separate operations behind one Netflix account',
          matchedHistory: false,
          worked: true,
          valueMultiplier: 1.15,
          styleWeights: { visionary: 1, operator: 3, consensus: 1 },
          outcome: {
            classic:
              'Internal focus improves without asking members to manage two brands, queues, or billing relationships during the transition.',
            brainrot:
              'The org chart gets its split but users keep one login; operational gains arrive without making subscribers learn bonus lore.',
          },
        },
        {
          id: 'validate-first',
          label: 'Delay the split and validate with members',
          matchedHistory: false,
          worked: true,
          valueMultiplier: 1.08,
          styleWeights: { visionary: 0, operator: 2, consensus: 3 },
          outcome: {
            classic:
              'Research exposes the cost of separate identities before launch, preserving flexibility while the teams refine their operating model.',
            brainrot:
              'A customer test catches the brand fumble before production; you lose a little speed and avoid an industrial-strength own goal.',
          },
        },
      ],
    },
    {
      id: 'reverse-qwikster',
      year: 2011,
      prompt: {
        classic:
          'The Qwikster announcement is drawing immediate criticism. Do you reverse it, force the separation through, or run a limited transition pilot?',
        brainrot:
          'Qwikster is getting cooked before launch. Delete the announcement, double down for “strategic clarity,” or put the split in a tiny beta cage?',
      },
      sourceIds: ['netflix-2011-results', 'netflix-2011-10k'],
      choices: [
        {
          id: 'cancel-qwikster',
          label: 'Cancel Qwikster and reunify the experience',
          matchedHistory: true,
          worked: true,
          valueMultiplier: 1.12,
          styleWeights: { visionary: 0, operator: 2, consensus: 3 },
          outcome: {
            classic:
              'The reversal limits additional friction and acknowledges the mistake, although repairing subscriber trust will still take time.',
            brainrot:
              'You hit undo before the second website ships; the apology stops the bleeding, but trust does not respawn at full health overnight.',
          },
        },
        {
          id: 'force-separation',
          label: 'Proceed with the full separation',
          matchedHistory: false,
          worked: false,
          valueMultiplier: 0.78,
          styleWeights: { visionary: 2, operator: 1, consensus: 0 },
          outcome: {
            classic:
              'Execution discipline cannot repair a proposition customers reject; two services deepen churn while attention shifts from content.',
            brainrot:
              'You call it conviction and ship the unpopular sequel anyway; two accounts unlock double friction and zero bonus subscriber love.',
          },
        },
        {
          id: 'pilot-separation',
          label: 'Pilot the split with a small member cohort',
          matchedHistory: false,
          worked: true,
          valueMultiplier: 1.04,
          styleWeights: { visionary: 1, operator: 3, consensus: 1 },
          outcome: {
            classic:
              'A reversible pilot measures real behavior and contains harm, but recovery remains slower than a direct public reversal.',
            brainrot:
              'You move the chaos into a sandbox; the data is useful and the blast radius is tiny, though the apology arc still runs long.',
          },
        },
      ],
    },
    {
      id: 'expand-internationally',
      year: 2012,
      prompt: {
        classic:
          'International launches require content commitments before local scale. Do you continue staged expansion, pause abroad, or license the platform to partners?',
        brainrot:
          'Going global means buying content before the subscriber army arrives. Keep rolling country by country, turtle at home, or rent the tech to local players?',
      },
      sourceIds: ['netflix-q1-letter', 'netflix-2011-10k'],
      choices: [
        {
          id: 'staged-expansion',
          label: 'Continue staged international launches',
          matchedHistory: true,
          worked: true,
          valueMultiplier: 1.2,
          styleWeights: { visionary: 3, operator: 1, consensus: 0 },
          outcome: {
            classic:
              'Near-term losses buy market learning and a wider subscriber base, establishing international streaming as a durable growth engine.',
            brainrot:
              'The new markets eat cash before breakfast, but each launch stacks global distribution XP and builds the next subscriber engine.',
          },
        },
        {
          id: 'pause-expansion',
          label: 'Pause abroad until domestic trust recovers',
          matchedHistory: false,
          worked: true,
          valueMultiplier: 1.08,
          styleWeights: { visionary: 0, operator: 3, consensus: 2 },
          outcome: {
            classic:
              'A pause protects cash and sharpens the domestic repair, but competitors gain time to secure rights and customer relationships abroad.',
            brainrot:
              'You stop the world tour to fix home base; cash gets breathing room while rivals quietly reserve the best international seats.',
          },
        },
        {
          id: 'partner-licensing',
          label: 'License the platform to regional partners',
          matchedHistory: false,
          worked: false,
          valueMultiplier: 0.92,
          styleWeights: { visionary: 1, operator: 1, consensus: 3 },
          outcome: {
            classic:
              'Partners reduce launch risk but fragment customer data and brand control, limiting Netflix’s ability to compound global learning.',
            brainrot:
              'Local partners carry the bags, then keep the customer signal; Netflix saves launch cash and gives away the global learning flywheel.',
          },
        },
      ],
    },
    {
      id: 'fund-house-of-cards',
      year: 2012,
      prompt: {
        classic:
          'Licensing leaves Netflix dependent on studios. Do you commit heavily to House of Cards, commission a smaller pilot, or remain a licensed-content distributor?',
        brainrot:
          'Studios still own the content faucet. Do you full-send House of Cards, test one episode like a normal mortal, or stay a very polished rental shelf?',
      },
      sourceIds: ['netflix-q4-letter', 'netflix-2011-10k'],
      choices: [
        {
          id: 'straight-to-series',
          label: 'Commit straight to a full original series',
          matchedHistory: true,
          worked: true,
          valueMultiplier: 1.32,
          styleWeights: { visionary: 3, operator: 1, consensus: 0 },
          outcome: {
            classic:
              'The large commitment differentiates the service and turns viewing data into a content advantage, despite substantial upfront risk.',
            brainrot:
              'You skip the pilot and order the whole season; the expensive swing unlocks original-content aura and makes the data moat actually matter.',
          },
        },
        {
          id: 'pilot-first',
          label: 'Fund a pilot before ordering the series',
          matchedHistory: false,
          worked: true,
          valueMultiplier: 1.12,
          styleWeights: { visionary: 1, operator: 3, consensus: 1 },
          outcome: {
            classic:
              'A pilot controls downside and builds production capability, but rivals retain time to claim prestige projects and creative talent.',
            brainrot:
              'You buy the sensible sample size; downside stays chill, but the bold originals era loads slowly while competitors browse the same scripts.',
          },
        },
        {
          id: 'license-only',
          label: 'Remain focused on licensed programming',
          matchedHistory: false,
          worked: false,
          valueMultiplier: 0.94,
          styleWeights: { visionary: 0, operator: 1, consensus: 3 },
          outcome: {
            classic:
              'Licensing preserves focus but leaves suppliers with leverage and gives subscribers fewer reasons to view Netflix as indispensable.',
            brainrot:
              'The safe catalog play avoids production drama and keeps the studios holding every rare drop; differentiation stays painfully mid.',
          },
        },
      ],
    },
  ],
})
