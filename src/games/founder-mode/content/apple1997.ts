import { freezeEpisode } from './freezeEpisode'
import type { FounderEpisode } from './types'

export const apple1997: FounderEpisode = freezeEpisode({
  id: 'apple-1997',
  episodeNumber: 2,
  company: 'Apple Computer',
  founder: 'Steve Jobs',
  startYear: 1997,
  rulesetVersion: 1,
  initialValueBn: 3,
  historicalEndValueBn: 10,
  intro: {
    classic:
      'Apple is losing money, its product line is confused, and Steve Jobs has returned through the NeXT acquisition. Rebuild focus, distribution, and the product ecosystem in five consequential decisions.',
    brainrot:
      'Apple is low on cash, high on beige computers, and Steve Jobs just respawned through NeXT. Cut the clutter, rebuild belief, and assemble the ecosystem combo.',
  },
  sources: [
    {
      id: 'microsoft-apple-1997',
      title: 'Microsoft and Apple Affirm Commitment to Build Next Generation Software for Macintosh',
      url: 'https://news.microsoft.com/source/1997/08/06/microsoft-and-apple-affirm-commitment-to-build-next-generation-software-for-macintosh/',
      publisher: 'Microsoft Source',
      accessed: '2026-07-21',
    },
    {
      id: 'apple-1997-report',
      title: 'Apple Computer 1997 Annual Report',
      url: 'https://www.annualreports.com/HostedData/AnnualReportArchive/a/NASDAQ_AAPL_1997.pdf',
      publisher: 'Apple Computer via AnnualReports archive',
      accessed: '2026-07-21',
    },
    {
      id: 'apple-retail-2001',
      title: 'Apple to Open 25 Retail Stores in 2001',
      url: 'https://www.apple.com/newsroom/2001/05/15Apple-to-Open-25-Retail-Stores-in-2001/',
      publisher: 'Apple Newsroom',
      accessed: '2026-07-21',
    },
    {
      id: 'apple-ipod-2001',
      title: 'Apple Presents iPod',
      url: 'https://www.apple.com/newsroom/2001/10/23Apple-Presents-iPod/',
      publisher: 'Apple Newsroom',
      accessed: '2026-07-21',
    },
    {
      id: 'apple-itunes-2003',
      title: 'Apple Launches the iTunes Music Store',
      url: 'https://www.apple.com/newsroom/2003/04/28Apple-Launches-the-iTunes-Music-Store/',
      publisher: 'Apple Newsroom',
      accessed: '2026-07-21',
    },
    {
      id: 'apple-intel-2005',
      title: 'Apple to Use Intel Microprocessors Beginning in 2006',
      url: 'https://www.apple.com/newsroom/2005/06/06Apple-to-Use-Intel-Microprocessors-Beginning-in-2006/',
      publisher: 'Apple Newsroom',
      accessed: '2026-07-21',
    },
  ],
  decisions: [
    {
      id: 'microsoft-investment',
      year: 1997,
      prompt: {
        classic:
          'Microsoft offers $150 million in non-voting stock investment, continued Office support, and a patent settlement. Do you accept, reject the rival, or seek a broader rescue consortium?',
        brainrot:
          'Bill Gates offers $150 million, Office support, and a patent truce while the Macworld crowd boos. Take rival money, reject the crossover episode, or assemble a rescue group chat?',
      },
      sourceIds: ['microsoft-apple-1997', 'apple-1997-report'],
      choices: [
        {
          id: 'accept-microsoft',
          label: 'Accept the Microsoft alliance and investment',
          matchedHistory: true,
          worked: true,
          valueMultiplier: 1.15,
          styleWeights: { visionary: 1, operator: 2, consensus: 2 },
          outcome: {
            classic:
              'Cash matters, but software confidence matters more: Office support and legal peace reassure customers that Macintosh remains viable.',
            brainrot:
              'The rival cameo stabilizes the whole platform; cash lands, Office stays, and customers stop treating every Mac purchase like a farewell tour.',
          },
        },
        {
          id: 'reject-microsoft',
          label: 'Reject Microsoft and preserve independence',
          matchedHistory: false,
          worked: false,
          valueMultiplier: 0.78,
          styleWeights: { visionary: 2, operator: 0, consensus: 1 },
          outcome: {
            classic:
              'Symbolic independence cannot replace liquidity or application support; uncertainty deepens among developers, customers, and suppliers.',
            brainrot:
              'You win the purity argument and lose the platform confidence bar; no cash and shaky Office support make independence extremely expensive.',
          },
        },
        {
          id: 'rescue-consortium',
          label: 'Raise capital from several neutral partners',
          matchedHistory: false,
          worked: true,
          valueMultiplier: 1.02,
          styleWeights: { visionary: 0, operator: 2, consensus: 3 },
          outcome: {
            classic:
              'Diversified backing reduces dependence on Microsoft, but negotiations consume time and do less to settle the critical application question.',
            brainrot:
              'A consortium spreads the risk and multiplies the meetings; Apple gets runway, but the “will Office stay?” boss remains undefeated.',
          },
        },
      ],
    },
    {
      id: 'simplify-product-matrix',
      year: 1997,
      prompt: {
        classic:
          'Apple sells overlapping models that confuse customers and consume engineering resources. Do you reduce the matrix to four products, preserve choice, or trim only licensed clones?',
        brainrot:
          'The product catalog looks like beige-computer alphabet soup. Make the famous four-square grid, keep every SKU for “choice,” or only delete the clones?',
      },
      sourceIds: ['apple-1997-report'],
      choices: [
        {
          id: 'four-product-grid',
          label: 'Focus on four consumer/pro desktop/portable products',
          matchedHistory: true,
          worked: true,
          valueMultiplier: 1.25,
          styleWeights: { visionary: 2, operator: 3, consensus: 0 },
          outcome: {
            classic:
              'A clear matrix concentrates engineering and marketing, making each launch legible while painful cancellations restore operating discipline.',
            brainrot:
              'Four boxes replace the SKU maze; teams stop spreading pixels across doomed models and each launch finally gets main-character resources.',
          },
        },
        {
          id: 'preserve-lineup',
          label: 'Preserve the broad lineup for every segment',
          matchedHistory: false,
          worked: false,
          valueMultiplier: 0.8,
          styleWeights: { visionary: 0, operator: 1, consensus: 4 },
          outcome: {
            classic:
              'Breadth avoids immediate cancellations but sustains duplicated engineering, inventory, and a value proposition customers cannot decipher.',
            brainrot:
              'Every niche keeps its beige rectangle and the company keeps the chaos; inventory stacks while customers need a decoder ring to buy a Mac.',
          },
        },
        {
          id: 'end-clones-only',
          label: 'End clone licensing but retain most Apple models',
          matchedHistory: false,
          worked: true,
          valueMultiplier: 1.08,
          styleWeights: { visionary: 0, operator: 2, consensus: 2 },
          outcome: {
            classic:
              'Ending clones protects hardware economics, yet the internal catalog still divides investment and delays a coherent product story.',
            brainrot:
              'You stop outsiders from undercutting Mac hardware, which helps, but Apple’s own SKU hydra still has most of its heads.',
          },
        },
      ],
    },
    {
      id: 'open-apple-retail',
      year: 2001,
      prompt: {
        classic:
          'Third-party stores poorly explain the Mac experience. Do you open Apple-owned retail, improve reseller concessions, or rely on a direct website?',
        brainrot:
          'Retailers park Macs in a sad back corner with nobody to explain them. Build Apple Stores, bribe resellers for better shelves, or go web-only?',
      },
      sourceIds: ['apple-retail-2001'],
      choices: [
        {
          id: 'owned-retail',
          label: 'Open high-touch Apple retail stores',
          matchedHistory: true,
          worked: true,
          valueMultiplier: 1.18,
          styleWeights: { visionary: 2, operator: 2, consensus: 0 },
          outcome: {
            classic:
              'Owned stores make complete solutions tangible, control service quality, and create a direct customer relationship despite fixed-cost risk.',
            brainrot:
              'You build the glass-and-Genius-Bar experience; critics predict a retail flop while customers finally get to touch the whole ecosystem.',
          },
        },
        {
          id: 'reseller-program',
          label: 'Pay resellers for dedicated Apple sections',
          matchedHistory: false,
          worked: false,
          valueMultiplier: 0.94,
          styleWeights: { visionary: 0, operator: 2, consensus: 3 },
          outcome: {
            classic:
              'Dedicated sections improve visibility, but Apple still cannot control staffing, education, or the end-to-end experience at the point of sale.',
            brainrot:
              'The Mac gets nicer shelf space and the same borrowed sales floor; visibility rises, but the customer experience remains someone else’s side job.',
          },
        },
        {
          id: 'online-only',
          label: 'Expand direct web sales without stores',
          matchedHistory: false,
          worked: false,
          valueMultiplier: 0.88,
          styleWeights: { visionary: 1, operator: 2, consensus: 1 },
          outcome: {
            classic:
              'Online efficiency serves existing fans, but switchers lack a place to understand unfamiliar products, software, and support before buying.',
            brainrot:
              'The website converts loyalists beautifully while curious switchers stare at unfamiliar specs alone; no physical demo means no ecosystem revelation.',
          },
        },
      ],
    },
    {
      id: 'ipod-itunes-ecosystem',
      year: 2001,
      prompt: {
        classic:
          'Digital music is fragmented across players, desktop software, and piracy. Do you integrate iPod with iTunes and a store, ship software only, or license the hardware design?',
        brainrot:
          'Digital music is a folder full of piracy, bad players, and worse syncing. Build the iPod+iTunes combo, stay a software DJ, or license the hardware skin?',
      },
      sourceIds: ['apple-ipod-2001', 'apple-itunes-2003'],
      choices: [
        {
          id: 'integrated-music',
          label: 'Build the integrated iPod and iTunes ecosystem',
          matchedHistory: true,
          worked: true,
          valueMultiplier: 1.32,
          styleWeights: { visionary: 3, operator: 2, consensus: 0 },
          outcome: {
            classic:
              'Hardware, syncing software, and legal downloads reinforce one another, expanding Apple from computers into a repeatable ecosystem strategy.',
            brainrot:
              'The device, sync app, and 99-cent store chain a perfect combo; Apple escapes the PC-only lobby and discovers the ecosystem meta.',
          },
        },
        {
          id: 'itunes-only',
          label: 'Build iTunes but leave players to partners',
          matchedHistory: false,
          worked: true,
          valueMultiplier: 1.08,
          styleWeights: { visionary: 1, operator: 2, consensus: 2 },
          outcome: {
            classic:
              'Strong software improves the Mac proposition, but inconsistent partner hardware prevents Apple from controlling the complete music experience.',
            brainrot:
              'iTunes organizes the chaos while random players keep breaking the vibe; useful software ships, but the end-to-end moat never fully spawns.',
          },
        },
        {
          id: 'license-player',
          label: 'License an Apple player design to manufacturers',
          matchedHistory: false,
          worked: false,
          valueMultiplier: 0.9,
          styleWeights: { visionary: 1, operator: 0, consensus: 3 },
          outcome: {
            classic:
              'Licensing reaches more shelves but fragments quality and economics, repeating the platform-control problems Apple is trying to escape.',
            brainrot:
              'More logos ship the design and every one remixes quality differently; Apple gets reach while donating the best margins and experience control.',
          },
        },
      ],
    },
    {
      id: 'intel-transition',
      year: 2005,
      prompt: {
        classic:
          'PowerPC performance per watt is limiting future Macs. Do you transition to Intel on a public schedule, remain loyal to PowerPC, or maintain both architectures indefinitely?',
        brainrot:
          'PowerPC cannot hit the laptop roadmap without becoming a space heater. Announce the Intel migration, stay loyal, or support two architectures forever?',
      },
      sourceIds: ['apple-intel-2005'],
      choices: [
        {
          id: 'move-to-intel',
          label: 'Move the Mac line to Intel processors',
          matchedHistory: true,
          worked: true,
          valueMultiplier: 1.22,
          styleWeights: { visionary: 2, operator: 3, consensus: 0 },
          outcome: {
            classic:
              'A staged migration with translation tools unlocks competitive notebooks and demonstrates that Apple can change foundations without abandoning users.',
            brainrot:
              'You swap the engine while the car is moving; Rosetta cushions the jump and the Mac roadmap escapes the performance-per-watt dungeon.',
          },
        },
        {
          id: 'stay-powerpc',
          label: 'Remain exclusively with PowerPC',
          matchedHistory: false,
          worked: false,
          valueMultiplier: 0.78,
          styleWeights: { visionary: 0, operator: 1, consensus: 3 },
          outcome: {
            classic:
              'Architectural continuity protects current software briefly, but thermal and performance limits make the notebook roadmap increasingly uncompetitive.',
            brainrot:
              'Compatibility stays cozy while laptop chips keep running out of road; loyalty turns into a thermal ceiling the product team cannot design around.',
          },
        },
        {
          id: 'dual-architecture',
          label: 'Ship PowerPC and Intel Macs in parallel long term',
          matchedHistory: false,
          worked: false,
          valueMultiplier: 0.92,
          styleWeights: { visionary: 0, operator: 2, consensus: 3 },
          outcome: {
            classic:
              'Permanent dual support reduces immediate disruption but doubles testing and fragments developer attention, slowing both product families.',
            brainrot:
              'Nobody has to choose, so every engineer chooses twice; the forever transition doubles QA and splits developer focus into parallel universes.',
          },
        },
      ],
    },
  ],
})
