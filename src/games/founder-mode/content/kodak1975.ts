import { freezeEpisode } from './freezeEpisode'
import type { FounderEpisode } from './types'

export const kodak1975: FounderEpisode = freezeEpisode({
  id: 'kodak-1975',
  episodeNumber: 3,
  company: 'Eastman Kodak',
  founder: 'George Eastman legacy team',
  startYear: 1975,
  rulesetVersion: 1,
  initialValueBn: 12,
  historicalEndValueBn: 7.5,
  intro: {
    classic:
      'Kodak dominates a profitable film ecosystem when an engineer demonstrates a self-contained digital camera. Decide whether a century-old imaging leader can disrupt itself before competitors do.',
    brainrot:
      'Kodak owns the film kingdom, then an engineer walks in with a toaster-sized digital camera from the future. Your mission: disrupt the cash cow without getting deleted by it.',
  },
  sources: [
    {
      id: 'kodak-milestones',
      title: 'Kodak Company Milestones',
      url: 'https://www.kodak.com/en/company/page/milestones/',
      publisher: 'Eastman Kodak Company',
      accessed: '2026-07-21',
    },
    {
      id: 'kodak-renewal-study',
      title: 'The Problem of Sustaining a Successful Enterprise: Kodak’s Multiple Takes at Strategic Renewal',
      url: 'https://www.cambridge.org/core/journals/business-history-review/article/problem-of-sustaining-a-successful-enterprise-kodaks-multiple-takes-at-strategic-renewal-that-culminated-in-failure/BE8CCCEC173E0D91B1E7F0BBE2BF2744',
      publisher: 'Cambridge University Press, Business History Review',
      accessed: '2026-07-21',
    },
    {
      id: 'kodak-picture-cd',
      title: 'Kodak and Intel Define a Strategy to Bridge Pictures with Digital Imaging',
      url: 'https://www.intel.com/pressroom/archive/releases/1998/pi092898.htm',
      publisher: 'Intel Newsroom',
      accessed: '2026-07-21',
    },
    {
      id: 'kodak-2012-10k',
      title: 'Eastman Kodak 2012 Annual Report on Form 10-K',
      url: 'https://www.sec.gov/Archives/edgar/data/31235/000119312513101202/d495783d10k.htm',
      publisher: 'U.S. Securities and Exchange Commission',
      accessed: '2026-07-21',
    },
  ],
  decisions: [
    {
      id: 'first-digital-camera',
      year: 1975,
      prompt: {
        classic:
          'Steve Sasson’s prototype records a 0.01-megapixel image to cassette. Do you fund a protected digital venture, keep it exploratory, or rush an immature consumer product?',
        brainrot:
          'Sasson just made a toaster take a 0.01-megapixel photo onto cassette. Build a real digital squad, park it in the lab, or ship the science project before the world has pixels?',
      },
      sourceIds: ['kodak-milestones', 'kodak-renewal-study'],
      choices: [
        {
          id: 'keep-exploratory',
          label: 'Patent it and keep the program exploratory',
          matchedHistory: true,
          worked: false,
          valueMultiplier: 0.98,
          styleWeights: { visionary: 0, operator: 2, consensus: 3 },
          outcome: {
            classic:
              'Kodak preserves optionality but gives digital imaging no business model, allowing film incentives to govern the pace of development.',
            brainrot:
              'The patent drawer gets a legendary artifact while film economics keeps admin rights; digital remains a side quest with no launch path.',
          },
        },
        {
          id: 'autonomous-venture',
          label: 'Fund an autonomous digital imaging venture',
          matchedHistory: false,
          worked: true,
          valueMultiplier: 1.22,
          styleWeights: { visionary: 3, operator: 2, consensus: 0 },
          outcome: {
            classic:
              'A separate mandate protects patient investment from film-margin targets and begins building sensors, software, and digital distribution together.',
            brainrot:
              'You give digital its own budget and escape velocity; the tiny image now has a team that cannot be nerfed by every roll of profitable film.',
          },
        },
        {
          id: 'consumer-launch',
          label: 'Rush the prototype into consumer production',
          matchedHistory: false,
          worked: false,
          valueMultiplier: 0.82,
          styleWeights: { visionary: 3, operator: 0, consensus: 0 },
          outcome: {
            classic:
              'Storage, displays, and component costs are not ready for consumers; a premature launch turns a strategic breakthrough into an expensive novelty.',
            brainrot:
              'You ship before screens, storage, or wallets are ready; the future arrives as an eight-pound flop and teaches the board the wrong lesson.',
          },
        },
      ],
    },
    {
      id: 'build-digital-unit',
      year: 1981,
      prompt: {
        classic:
          'Electronic imaging is improving, but film and processing drive Kodak’s margins. Do you bind digital to film returns, build an independent unit, or stop cannibalization entirely?',
        brainrot:
          'Digital keeps leveling up while film prints money. Make every pixel justify film margins, spin up an independent unit, or ban the cannibal from the cafeteria?',
      },
      sourceIds: ['kodak-renewal-study', 'kodak-milestones'],
      choices: [
        {
          id: 'film-hurdle-rates',
          label: 'Make digital meet film hurdle rates',
          matchedHistory: true,
          worked: false,
          valueMultiplier: 0.95,
          styleWeights: { visionary: 0, operator: 2, consensus: 3 },
          outcome: {
            classic:
              'Near-term margin comparisons repeatedly favor consumables, so promising digital programs advance without the scale or autonomy needed to reshape the company.',
            brainrot:
              'Every pixel gets judged against the film cash printer and loses; innovation stays technically alive while strategically trapped in a margin boss fight.',
          },
        },
        {
          id: 'independent-unit',
          label: 'Build an independent digital business unit',
          matchedHistory: false,
          worked: true,
          valueMultiplier: 1.18,
          styleWeights: { visionary: 2, operator: 3, consensus: 0 },
          outcome: {
            classic:
              'Dedicated economics and leadership let digital products learn on their own curve while the core business funds a deliberate transition.',
            brainrot:
              'Digital gets a real P&L instead of film’s impossible rubric; the new unit can learn, scale, and eventually eat the parent on purpose.',
          },
        },
        {
          id: 'protect-film',
          label: 'Stop projects that threaten film demand',
          matchedHistory: false,
          worked: false,
          valueMultiplier: 0.76,
          styleWeights: { visionary: 0, operator: 1, consensus: 4 },
          outcome: {
            classic:
              'Film profits improve briefly, but Kodak loses talent and learning as the architecture of photography shifts outside the company.',
            brainrot:
              'Quarterly film numbers look elite while the future walks out with the engineers; you protect the castle by deleting every road forward.',
          },
        },
      ],
    },
    {
      id: 'japanese-competition',
      year: 1984,
      prompt: {
        classic:
          'Fujifilm is winning attention with aggressive pricing and global competition. Do you defend film share, redirect profits into digital services, or diversify using imaging science?',
        brainrot:
          'Fujifilm enters the chat with sharp pricing and global ambition. Fight over film, funnel the cash into digital services, or remix Kodak chemistry into new businesses?',
      },
      sourceIds: ['kodak-renewal-study', 'kodak-milestones'],
      choices: [
        {
          id: 'defend-film-share',
          label: 'Defend film share through price and trade action',
          matchedHistory: true,
          worked: false,
          valueMultiplier: 0.92,
          styleWeights: { visionary: 0, operator: 2, consensus: 3 },
          outcome: {
            classic:
              'The response contests immediate share but keeps leadership attention anchored to film while competitors accumulate broader capabilities.',
            brainrot:
              'You win some film rounds and keep the whole company staring backward; the rival uses the distraction to grind new capability XP.',
          },
        },
        {
          id: 'fund-digital-services',
          label: 'Redirect film profits into digital services',
          matchedHistory: false,
          worked: true,
          valueMultiplier: 1.16,
          styleWeights: { visionary: 2, operator: 3, consensus: 0 },
          outcome: {
            classic:
              'Price pressure becomes a forcing function: Kodak funds scanning, software, and distribution businesses that can survive lower film volumes.',
            brainrot:
              'Instead of arguing over each roll, you use film cash to build the post-film stack; competition accidentally funds the pivot arc.',
          },
        },
        {
          id: 'science-diversification',
          label: 'Diversify through Kodak’s materials science',
          matchedHistory: false,
          worked: true,
          valueMultiplier: 1.11,
          styleWeights: { visionary: 2, operator: 1, consensus: 2 },
          outcome: {
            classic:
              'Adjacent applications reduce dependence on consumer film, though management must still protect investment discipline across unfamiliar markets.',
            brainrot:
              'You turn chemistry lore into new revenue lanes; diversification lowers the film dependency meter, but focus can still get lost in the multiverse.',
          },
        },
      ],
    },
    {
      id: 'photo-cd-workflows',
      year: 1992,
      prompt: {
        classic:
          'Photo CD can bridge film, scanners, computers, and televisions. Do you sell it as a proprietary bridge, open a software platform, or skip directly to consumer digital cameras?',
        brainrot:
          'Photo CD can move film memories onto screens before consumer cameras are ready. Build a Kodak-only bridge, open the rails, or leap straight into digital hardware?',
      },
      sourceIds: ['kodak-milestones', 'kodak-renewal-study', 'kodak-picture-cd'],
      choices: [
        {
          id: 'proprietary-photo-cd',
          label: 'Commercialize Photo CD as a Kodak system',
          matchedHistory: true,
          worked: true,
          valueMultiplier: 0.98,
          styleWeights: { visionary: 2, operator: 2, consensus: 1 },
          outcome: {
            classic:
              'Photo CD establishes useful digital workflows and standards, but proprietary hardware and film ties limit its ability to become a broad platform.',
            brainrot:
              'The bridge works and puts family photos on screens, but Kodak keeps too many tollbooths; a clever hybrid never becomes the default platform.',
          },
        },
        {
          id: 'open-imaging-platform',
          label: 'Open the formats and build imaging software',
          matchedHistory: false,
          worked: true,
          valueMultiplier: 1.18,
          styleWeights: { visionary: 2, operator: 3, consensus: 1 },
          outcome: {
            classic:
              'Open interfaces invite computer and retail partners, positioning Kodak’s color science and workflow tools wherever digital images travel.',
            brainrot:
              'You open the rails and let every computer join; Kodak stops guarding discs and starts owning the color-and-workflow layer across the ecosystem.',
          },
        },
        {
          id: 'camera-first',
          label: 'Skip the bridge and prioritize digital cameras',
          matchedHistory: false,
          worked: false,
          valueMultiplier: 0.86,
          styleWeights: { visionary: 3, operator: 0, consensus: 0 },
          outcome: {
            classic:
              'Camera investment is necessary, but abandoning workflows leaves Kodak competing on low-margin electronics without a differentiated ecosystem.',
            brainrot:
              'You sprint into the camera spec war with no software moat; the future arrives, but every electronics rival can play the same game cheaper.',
          },
        },
      ],
    },
    {
      id: 'digital-restructure',
      year: 2011,
      prompt: {
        classic:
          'Film volumes have collapsed and debt limits options. Do you wait for court-led restructuring, reorganize early around commercial digital imaging, or license patents and exit consumer hardware?',
        brainrot:
          'Film demand has left the building and debt owns the calendar. Wait for Chapter 11, restructure around profitable digital lanes now, or monetize patents and leave the camera arena cleanly?',
      },
      sourceIds: ['kodak-2012-10k', 'kodak-renewal-study'],
      choices: [
        {
          id: 'late-court-restructure',
          label: 'Delay until a court-led restructuring is unavoidable',
          matchedHistory: true,
          worked: false,
          valueMultiplier: 0.78,
          styleWeights: { visionary: 0, operator: 1, consensus: 4 },
          outcome: {
            classic:
              'Chapter 11 eventually cuts obligations, but delay consumes cash and forces valuable consumer imaging businesses to be sold under pressure.',
            brainrot:
              'You let the runway expire and Chapter 11 grabs the wheel; debt shrinks, but valuable pieces leave during the emergency inventory sale.',
          },
        },
        {
          id: 'early-commercial-focus',
          label: 'Restructure early around commercial digital imaging',
          matchedHistory: false,
          worked: true,
          valueMultiplier: 1.2,
          styleWeights: { visionary: 2, operator: 3, consensus: 0 },
          outcome: {
            classic:
              'Earlier closures and debt negotiations preserve cash for defensible printing, packaging, and workflow businesses before distress dictates terms.',
            brainrot:
              'You take the painful cuts while choices still exist; cash moves to commercial imaging instead of feeding a slow-motion consumer hardware defeat.',
          },
        },
        {
          id: 'license-and-exit',
          label: 'License patents and exit consumer hardware orderly',
          matchedHistory: false,
          worked: true,
          valueMultiplier: 1.08,
          styleWeights: { visionary: 1, operator: 3, consensus: 1 },
          outcome: {
            classic:
              'An orderly exit sacrifices scale but converts intellectual property into runway and avoids carrying structurally uncompetitive camera operations.',
            brainrot:
              'You stop chasing camera volume, rent out the patent vault, and buy time; Kodak gets smaller without letting bankruptcy choose every cut.',
          },
        },
      ],
    },
  ],
})
