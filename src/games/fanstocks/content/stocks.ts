import type { StockCard, Ticker } from './types';

const ARTWORK_KEY_BY_TICKER: Readonly<Record<string, string>> = Object.freeze({
  XLE: 'energy',
  DKNG: 'sportsbook',
  HUBS: 'software',
  AMZN: 'consumer',
  ODFL: 'industrials',
  SBUX: 'consumer',
  LOW: 'consumer',
  MPC: 'energy',
  IWM: 'small-cap',
  SMCI: 'software',
  CTRI: 'industrials',
  BMY: 'healthcare',
});

function createReadonlyMapView<K, V>(source: ReadonlyMap<K, V>): ReadonlyMap<K, V> {
  const view: ReadonlyMap<K, V> = {
    get size() { return source.size; },
    get(key) { return source.get(key); },
    has(key) { return source.has(key); },
    entries() { return source.entries(); },
    keys() { return source.keys(); },
    values() { return source.values(); },
    [Symbol.iterator]() { return source[Symbol.iterator](); },
    forEach(callback, thisArg) {
      source.forEach((value, key) => callback.call(thisArg, value, key, view));
    },
  };
  return Object.freeze(view);
}

const card = (
  ticker: string,
  company: string,
  sector: StockCard['sector'],
  volatility: number,
  momentumBias: number,
  correlationGroup: StockCard['correlationGroup'],
  thesis: string,
  evidence: StockCard['evidence'],
): StockCard => {
  const frozenEvidence = Object.freeze([...evidence]) as StockCard['evidence'];
  return Object.freeze({
    ticker, company, sector, volatility, momentumBias, correlationGroup, thesis,
    evidence: frozenEvidence,
    artworkKey: ARTWORK_KEY_BY_TICKER[ticker] ?? 'fallback',
    syntheticDemo: true,
  });
};

export const STOCKS: readonly StockCard[] = Object.freeze([
  card('XLE', 'Energy Select Sector SPDR Fund', 'energy', 0.58, 0.12, 'energy-cycle',
    'A basket of major US energy companies that moves with fuel demand and commodity prices.',
    ['Broad energy exposure in one card', 'Cash flow can rise with oil prices', 'Commodity reversals can be sharp']),
  card('DKNG', 'DraftKings', 'consumer', 0.88, 0.42, 'growth',
    'A high-growth sports platform whose upside depends on expansion and disciplined customer acquisition.',
    ['More legal markets widen reach', 'Revenue growth can outpace mature peers', 'Promotion costs amplify volatility']),
  card('HUBS', 'HubSpot', 'technology', 0.76, 0.34, 'growth',
    'A subscription software compounder tied to small-business spending and customer retention.',
    ['Recurring revenue supports visibility', 'Product expansion raises account value', 'Premium valuation raises drawdown risk']),
  card('AMZN', 'Amazon', 'consumer', 0.66, 0.28, 'growth',
    'Commerce scale and cloud profits create two engines, with margins sensitive to investment cycles.',
    ['Cloud profit can offset retail pressure', 'Logistics scale strengthens convenience', 'Heavy investment can compress margins']),
  card('ODFL', 'Old Dominion Freight Line', 'industrials', 0.48, 0.18, 'consumer-cycle',
    'A disciplined freight network that benefits when shipment demand and pricing stay firm.',
    ['Dense routes improve efficiency', 'Service quality supports pricing', 'Freight volumes follow the economy']),
  card('SBUX', 'Starbucks', 'consumer', 0.54, -0.08, 'consumer-cycle',
    'A global habit brand balancing store traffic, pricing power, labor costs, and overseas growth.',
    ['Loyalty supports repeat visits', 'Global stores add runway', 'Traffic can weaken after price increases']),
  card('LOW', "Lowe's", 'consumer', 0.43, -0.03, 'defensive',
    'A home-improvement retailer with resilient repair demand and housing-cycle sensitivity.',
    ['Repair spending is recurring', 'Professional customers add stability', 'Large projects slow with housing']),
  card('MPC', 'Marathon Petroleum', 'energy', 0.62, 0.16, 'energy-cycle',
    'A refiner whose earnings follow fuel demand, refinery availability, and crack spreads.',
    ['Refining margins can expand quickly', 'Buybacks can magnify per-share gains', 'Outages and spreads create sharp swings']),
  card('IWM', 'Russell 2000 ETF', 'small-cap', 0.61, 0.04, 'small-cap',
    'A diversified small-company basket geared to domestic growth and financing conditions.',
    ['One card spreads company-specific risk', 'Domestic growth lifts many holdings', 'Higher rates pressure smaller borrowers']),
  card('SMCI', 'Super Micro Computer', 'technology', 0.96, 0.55, 'growth',
    'An infrastructure supplier with strong AI demand and unusually wide expectation-driven moves.',
    ['AI servers expand the addressable market', 'Rapid product cycles reward execution', 'Crowded expectations magnify misses']),
  card('CTRI', 'Centuri Holdings', 'industrials', 0.73, -0.22, 'small-cap',
    'A utility-infrastructure contractor whose backlog can recover before market sentiment does.',
    ['Grid investment supports demand', 'Backlog offers future visibility', 'Execution and leverage raise risk']),
  card('BMY', 'Bristol Myers Squibb', 'healthcare', 0.37, -0.15, 'defensive',
    'A cash-generating drug portfolio trading on pipeline execution and patent-cycle concerns.',
    ['Current medicines produce cash', 'Pipeline wins can reset expectations', 'Patent losses pressure future sales']),
]);

const stockByTicker = new Map<Ticker, StockCard>(
  STOCKS.map((stock) => [stock.ticker, stock] as const),
);

export const STOCK_BY_TICKER: ReadonlyMap<Ticker, StockCard> = createReadonlyMapView(stockByTicker);
