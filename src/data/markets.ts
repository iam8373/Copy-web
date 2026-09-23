import type { Category, Market, Outcome } from "@/lib/types";

function binary(
  yes: number,
  change: number,
  volume: number,
  labels: [string, string] = ["Yes", "No"]
): Outcome[] {
  return [
    {
      id: "yes",
      label: labels[0],
      price: yes,
      change24h: change,
      volume: Math.round(volume * 0.56),
    },
    {
      id: "no",
      label: labels[1],
      price: Number((1 - yes).toFixed(4)),
      change24h: Number((-change).toFixed(4)),
      volume: Math.round(volume * 0.44),
    },
  ];
}

function multi(entries: Array<[string, number, number]>, volume: number): Outcome[] {
  return entries.map(([label, price, change], i) => ({
    id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    label,
    price,
    change24h: change,
    volume: Math.round((volume / entries.length) * (1 + (entries.length - i) * 0.08)),
  }));
}

type Seed = {
  title: string;
  category: Category;
  subcategory: string;
  description: string;
  endDate: string;
  isLive?: boolean;
  totalVolume: number;
  volumeChange24h: number;
  resolutionSource: string;
  outcomes: Outcome[];
  isBinary: boolean;
};

const SEEDS: Seed[] = [
  // ---------------------------------------------------------------- SPORTS
  {
    title: "Tampa Bay Rays vs. New York Yankees",
    category: "sports",
    subcategory: "MLB",
    description:
      "This market resolves to the team that wins the scheduled regular season game. If the game is postponed and not completed, the market resolves 50/50.",
    endDate: "2026-09-23T23:05:00.000Z",
    isLive: true,
    totalVolume: 38170,
    volumeChange24h: 4120,
    resolutionSource: "MLB official box score",
    outcomes: binary(0.64, 0.05, 38170, ["Rays", "Yankees"]),
    isBinary: true,
  },
  {
    title: "Miami Marlins vs. Chicago Cubs",
    category: "sports",
    subcategory: "MLB",
    description:
      "Resolves to the winner of the scheduled MLB regular season game between Miami and Chicago.",
    endDate: "2026-09-23T20:20:00.000Z",
    isLive: true,
    totalVolume: 21944,
    volumeChange24h: -1830,
    resolutionSource: "MLB official box score",
    outcomes: binary(0.41, -0.03, 21944, ["Marlins", "Cubs"]),
    isBinary: true,
  },
  {
    title: "NFL Champion 2027",
    category: "sports",
    subcategory: "NFL",
    description:
      "This market resolves to the team that wins Super Bowl LXI. Odds reflect the implied probability of each franchise lifting the Lombardi Trophy.",
    endDate: "2027-02-07T23:30:00.000Z",
    totalVolume: 19319958,
    volumeChange24h: 384000,
    resolutionSource: "NFL official result",
    outcomes: multi(
      [
        ["Kansas City Chiefs", 0.21, 0.02],
        ["Baltimore Ravens", 0.16, -0.01],
        ["Detroit Lions", 0.13, 0.01],
        ["Philadelphia Eagles", 0.11, 0.004],
        ["San Francisco 49ers", 0.09, -0.005],
        ["Buffalo Bills", 0.08, 0.003],
      ],
      19319958
    ),
    isBinary: false,
  },
  {
    title: "Manchester City vs. Arsenal",
    category: "sports",
    subcategory: "EPL",
    description:
      "Resolves to the result of the Premier League fixture at full time, including stoppage time but excluding extra time.",
    endDate: "2026-09-26T16:30:00.000Z",
    totalVolume: 2841000,
    volumeChange24h: 96500,
    resolutionSource: "Premier League official result",
    outcomes: multi(
      [
        ["Man City", 0.46, 0.02],
        ["Draw", 0.26, -0.01],
        ["Arsenal", 0.28, -0.01],
      ],
      2841000
    ),
    isBinary: false,
  },
  {
    title: "Real Madrid to win LaLiga 2026/27?",
    category: "sports",
    subcategory: "LaLiga",
    description:
      "Resolves Yes if Real Madrid finish first in the LaLiga table at the conclusion of the 2026/27 season.",
    endDate: "2027-05-23T20:00:00.000Z",
    totalVolume: 1290400,
    volumeChange24h: 21400,
    resolutionSource: "LaLiga final standings",
    outcomes: binary(0.52, 0.015, 1290400),
    isBinary: true,
  },
  {
    title: "Max Verstappen wins the 2026 Drivers' Championship?",
    category: "sports",
    subcategory: "F1",
    description:
      "Resolves Yes if Max Verstappen is classified first in the FIA Formula One Drivers' Championship for the 2026 season.",
    endDate: "2026-12-06T18:00:00.000Z",
    totalVolume: 3105220,
    volumeChange24h: 118300,
    resolutionSource: "FIA final classification",
    outcomes: binary(0.58, -0.022, 3105220),
    isBinary: true,
  },
  {
    title: "Boston Celtics vs. Denver Nuggets",
    category: "sports",
    subcategory: "Basketball",
    description: "Resolves to the winner of the scheduled NBA regular season game.",
    endDate: "2026-09-24T01:00:00.000Z",
    isLive: true,
    totalVolume: 462310,
    volumeChange24h: 38200,
    resolutionSource: "NBA official box score",
    outcomes: binary(0.55, 0.04, 462310, ["Celtics", "Nuggets"]),
    isBinary: true,
  },
  {
    title: "Edmonton Oilers vs. Vegas Golden Knights",
    category: "sports",
    subcategory: "NHL",
    description:
      "Resolves to the winner of the scheduled NHL game, including overtime and shootout.",
    endDate: "2026-09-24T02:00:00.000Z",
    totalVolume: 184920,
    volumeChange24h: -6400,
    resolutionSource: "NHL official box score",
    outcomes: binary(0.48, -0.012, 184920, ["Oilers", "Golden Knights"]),
    isBinary: true,
  },
  {
    title: "UCL Winner 2026/27",
    category: "sports",
    subcategory: "UCL",
    description: "Resolves to the club that wins the UEFA Champions League final.",
    endDate: "2027-05-29T21:00:00.000Z",
    totalVolume: 5412800,
    volumeChange24h: 143900,
    resolutionSource: "UEFA official result",
    outcomes: multi(
      [
        ["Real Madrid", 0.19, 0.01],
        ["Manchester City", 0.17, -0.008],
        ["Bayern Munich", 0.13, 0.006],
        ["Liverpool", 0.11, 0.004],
        ["Inter", 0.08, -0.002],
      ],
      5412800
    ),
    isBinary: false,
  },
  {
    title: "Will any NFL team go 17-0 in the 2026 season?",
    category: "sports",
    subcategory: "Football",
    description:
      "Resolves Yes if any NFL franchise completes the 2026 regular season with a perfect 17-0 record.",
    endDate: "2027-01-04T05:00:00.000Z",
    totalVolume: 742300,
    volumeChange24h: 8900,
    resolutionSource: "NFL official standings",
    outcomes: binary(0.06, 0.004, 742300),
    isBinary: true,
  },

  // -------------------------------------------------------------- POLITICS
  {
    title: "Presidential Election Winner 2028",
    category: "politics",
    subcategory: "Elections",
    description:
      "This market resolves to the candidate who is certified as the winner of the 2028 United States presidential election.",
    endDate: "2028-11-07T23:59:00.000Z",
    totalVolume: 84120500,
    volumeChange24h: 1284000,
    resolutionSource: "Certified Electoral College result",
    outcomes: multi(
      [
        ["James Talarico", 0.88, 0.031],
        ["Tucker Carlson", 0.498, -0.021],
        ["Gavin Newsom", 0.21, 0.012],
        ["JD Vance", 0.19, -0.009],
        ["Alexandria Ocasio-Cortez", 0.11, 0.004],
        ["Josh Shapiro", 0.07, 0.002],
      ],
      84120500
    ),
    isBinary: false,
  },
  {
    title: "Clarity Act signed into law by 2026?",
    category: "politics",
    subcategory: "Legislation",
    description:
      "Resolves Yes if the Digital Asset Market Clarity Act is signed into law by the President on or before December 31, 2026.",
    endDate: "2026-12-31T23:59:00.000Z",
    totalVolume: 6482100,
    volumeChange24h: 214000,
    resolutionSource: "congress.gov public law record",
    outcomes: binary(0.43, 0.058, 6482100),
    isBinary: true,
  },
  {
    title: "Will Trump attend the G20 summit in 2026?",
    category: "politics",
    subcategory: "Trump",
    description:
      "Resolves Yes if Donald Trump is physically present at the 2026 G20 leaders' summit.",
    endDate: "2026-11-22T23:59:00.000Z",
    totalVolume: 1842900,
    volumeChange24h: -42100,
    resolutionSource: "Official G20 delegation records",
    outcomes: binary(0.72, -0.014, 1842900),
    isBinary: true,
  },
  {
    title: "Which party controls the House after the 2026 midterms?",
    category: "politics",
    subcategory: "Elections",
    description:
      "Resolves to the party holding a majority of seats in the U.S. House of Representatives when the 120th Congress is sworn in.",
    endDate: "2027-01-03T17:00:00.000Z",
    totalVolume: 31204800,
    volumeChange24h: 802400,
    resolutionSource: "Certified congressional results",
    outcomes: multi(
      [
        ["Democrats", 0.63, 0.018],
        ["Republicans", 0.37, -0.018],
      ],
      31204800
    ),
    isBinary: false,
  },
  {
    title: "Ceasefire agreement signed in Eastern Europe before July 2026?",
    category: "politics",
    subcategory: "Global",
    description:
      "Resolves Yes if a formal ceasefire agreement is signed by all primary parties before July 1, 2026.",
    endDate: "2026-07-01T00:00:00.000Z",
    totalVolume: 9241300,
    volumeChange24h: 318000,
    resolutionSource: "Official government announcements",
    outcomes: binary(0.34, 0.027, 9241300),
    isBinary: true,
  },
  {
    title: "New UK Prime Minister before 2027?",
    category: "politics",
    subcategory: "Global",
    description:
      "Resolves Yes if a different person holds the office of UK Prime Minister at any point before January 1, 2027.",
    endDate: "2027-01-01T00:00:00.000Z",
    totalVolume: 2104700,
    volumeChange24h: 61200,
    resolutionSource: "gov.uk official record",
    outcomes: binary(0.28, 0.019, 2104700),
    isBinary: true,
  },

  // ---------------------------------------------------------------- CRYPTO
  {
    title: "Bitcoin above $150,000 on December 31, 2026?",
    category: "crypto",
    subcategory: "BTC Price",
    description:
      "Resolves Yes if the BTC/USD Chainlink price feed closes above $150,000 at 23:59 UTC on December 31, 2026.",
    endDate: "2026-12-31T23:59:00.000Z",
    totalVolume: 48219400,
    volumeChange24h: 1420000,
    resolutionSource: "Chainlink BTC/USD DataLink feed",
    outcomes: binary(0.47, 0.031, 48219400),
    isBinary: true,
  },
  {
    title: "Bitcoin Up or Down on September 23, 2026?",
    category: "crypto",
    subcategory: "BTC Price",
    description:
      "Resolves Up if the BTC/USD daily close is higher than the prior daily close, otherwise Down.",
    endDate: "2026-09-23T23:59:00.000Z",
    isLive: true,
    totalVolume: 1842700,
    volumeChange24h: 214900,
    resolutionSource: "Chainlink BTC/USD DataLink feed",
    outcomes: binary(0.68, 0.062, 1842700, ["Up", "Down"]),
    isBinary: true,
  },
  {
    title: "Ethereum above $6,000 before 2027?",
    category: "crypto",
    subcategory: "ETH Price",
    description:
      "Resolves Yes if the ETH/USD Chainlink feed trades above $6,000 at any point before January 1, 2027.",
    endDate: "2027-01-01T00:00:00.000Z",
    totalVolume: 21403900,
    volumeChange24h: 498000,
    resolutionSource: "Chainlink ETH/USD DataLink feed",
    outcomes: binary(0.39, -0.018, 21403900),
    isBinary: true,
  },
  {
    title: "BNB above $1,200 on October 31, 2026?",
    category: "crypto",
    subcategory: "BNB",
    description:
      "Resolves Yes if the BNB/USD Chainlink feed closes above $1,200 at 23:59 UTC on October 31, 2026.",
    endDate: "2026-10-31T23:59:00.000Z",
    isLive: true,
    totalVolume: 8412000,
    volumeChange24h: 392000,
    resolutionSource: "Chainlink BNB/USD DataLink feed",
    outcomes: binary(0.56, 0.041, 8412000),
    isBinary: true,
  },
  {
    title: "Solana ETF approved by the SEC before 2027?",
    category: "crypto",
    subcategory: "ETFs",
    description:
      "Resolves Yes if the SEC approves a spot Solana exchange-traded fund before January 1, 2027.",
    endDate: "2027-01-01T00:00:00.000Z",
    totalVolume: 14208300,
    volumeChange24h: -284000,
    resolutionSource: "SEC filings and orders",
    outcomes: binary(0.61, -0.026, 14208300),
    isBinary: true,
  },
  {
    title: "Which altcoin has the highest 2026 return?",
    category: "crypto",
    subcategory: "Altcoins",
    description:
      "Resolves to the asset with the greatest percentage return measured from Jan 1 to Dec 31, 2026.",
    endDate: "2026-12-31T23:59:00.000Z",
    totalVolume: 6104200,
    volumeChange24h: 141000,
    resolutionSource: "Chainlink price feeds",
    outcomes: multi(
      [
        ["SOL", 0.28, 0.014],
        ["BNB", 0.24, 0.02],
        ["XRP", 0.18, -0.01],
        ["AVAX", 0.12, -0.004],
        ["TON", 0.09, 0.002],
      ],
      6104200
    ),
    isBinary: false,
  },
  {
    title: "Total crypto market cap above $5T before 2027?",
    category: "crypto",
    subcategory: "All Crypto",
    description:
      "Resolves Yes if aggregate crypto market capitalization exceeds $5 trillion before January 1, 2027.",
    endDate: "2027-01-01T00:00:00.000Z",
    totalVolume: 10482100,
    volumeChange24h: 241000,
    resolutionSource: "Chainlink CRE aggregated market cap",
    outcomes: binary(0.44, 0.012, 10482100),
    isBinary: true,
  },

  // --------------------------------------------------------------- ESPORTS
  {
    title: "CS2 Major Champion 2026",
    category: "esports",
    subcategory: "CS2",
    description: "Resolves to the team that wins the 2026 Counter-Strike 2 Major.",
    endDate: "2026-11-15T20:00:00.000Z",
    totalVolume: 1284200,
    volumeChange24h: 48200,
    resolutionSource: "Official Major bracket result",
    outcomes: multi(
      [
        ["NAVI", 0.24, 0.018],
        ["Vitality", 0.22, -0.01],
        ["FaZe", 0.16, 0.006],
        ["G2", 0.14, -0.004],
        ["Spirit", 0.12, 0.002],
      ],
      1284200
    ),
    isBinary: false,
  },
  {
    title: "T1 vs. Gen.G — LCK Finals",
    category: "esports",
    subcategory: "League of Legends",
    description: "Resolves to the winner of the LCK Finals best-of-five series.",
    endDate: "2026-09-23T12:00:00.000Z",
    isLive: true,
    totalVolume: 421900,
    volumeChange24h: 61800,
    resolutionSource: "LCK official bracket",
    outcomes: binary(0.57, 0.048, 421900, ["T1", "Gen.G"]),
    isBinary: true,
  },
  {
    title: "Will Team Falcons win The International 2026?",
    category: "esports",
    subcategory: "Dota 2",
    description:
      "Resolves Yes if Team Falcons wins the Grand Final of The International 2026.",
    endDate: "2026-10-18T18:00:00.000Z",
    totalVolume: 284100,
    volumeChange24h: -9400,
    resolutionSource: "Valve official bracket",
    outcomes: binary(0.23, -0.011, 284100),
    isBinary: true,
  },
  {
    title: "Valorant Champions 2026 Winner",
    category: "esports",
    subcategory: "Valorant",
    description: "Resolves to the team that wins Valorant Champions 2026.",
    endDate: "2026-10-04T22:00:00.000Z",
    totalVolume: 392800,
    volumeChange24h: 14200,
    resolutionSource: "Riot Games official bracket",
    outcomes: multi(
      [
        ["Sentinels", 0.21, 0.01],
        ["Fnatic", 0.19, 0.008],
        ["Paper Rex", 0.18, -0.006],
        ["EDward Gaming", 0.15, 0.003],
      ],
      392800
    ),
    isBinary: false,
  },

  // --------------------------------------------------------------- FINANCE
  {
    title: "Polymarket IPO closing market cap above $20B?",
    category: "finance",
    subcategory: "IPO",
    description:
      "Resolves Yes if the closing market capitalization on the first day of public trading exceeds $20 billion.",
    endDate: "2026-12-15T21:00:00.000Z",
    totalVolume: 12048900,
    volumeChange24h: 412000,
    resolutionSource: "Closing price on listing exchange",
    outcomes: binary(0.38, 0.024, 12048900),
    isBinary: true,
  },
  {
    title: "SK Hynix Inc. Up or Down on September 23, 2026?",
    category: "finance",
    subcategory: "Stocks",
    description:
      "Resolves Up if SK Hynix closes higher than the prior session close on the KRX, otherwise Down.",
    endDate: "2026-09-23T06:30:00.000Z",
    isLive: true,
    totalVolume: 284900,
    volumeChange24h: 38400,
    resolutionSource: "KRX official closing price",
    outcomes: binary(0.61, 0.033, 284900, ["Up", "Down"]),
    isBinary: true,
  },
  {
    title: "Gold above $4,500/oz before 2027?",
    category: "finance",
    subcategory: "Commodities",
    description:
      "Resolves Yes if spot gold trades above $4,500 per troy ounce at any point before January 1, 2027.",
    endDate: "2027-01-01T00:00:00.000Z",
    totalVolume: 4820100,
    volumeChange24h: 98200,
    resolutionSource: "Chainlink XAU/USD feed",
    outcomes: binary(0.49, 0.021, 4820100),
    isBinary: true,
  },
  {
    title: "Nvidia market cap above $6T on December 31, 2026?",
    category: "finance",
    subcategory: "Market Cap",
    description:
      "Resolves Yes if Nvidia's closing market capitalization exceeds $6 trillion on December 31, 2026.",
    endDate: "2026-12-31T21:00:00.000Z",
    totalVolume: 18402300,
    volumeChange24h: 612000,
    resolutionSource: "Nasdaq closing price and share count",
    outcomes: binary(0.42, -0.017, 18402300),
    isBinary: true,
  },
  {
    title: "Will SpaceX be valued above $500B in its next round?",
    category: "finance",
    subcategory: "Pre-IPO",
    description:
      "Resolves Yes if the next reported primary funding round values SpaceX above $500 billion.",
    endDate: "2027-06-30T23:59:00.000Z",
    totalVolume: 6204800,
    volumeChange24h: -142000,
    resolutionSource: "Reported round terms from two major outlets",
    outcomes: binary(0.36, -0.009, 6204800),
    isBinary: true,
  },
  {
    title: "Brent crude above $95 before 2027?",
    category: "finance",
    subcategory: "Commodities",
    description:
      "Resolves Yes if front-month Brent crude settles above $95 per barrel before January 1, 2027.",
    endDate: "2027-01-01T00:00:00.000Z",
    totalVolume: 2941800,
    volumeChange24h: 72400,
    resolutionSource: "ICE Brent front-month settlement",
    outcomes: binary(0.31, 0.014, 2941800),
    isBinary: true,
  },

  // ------------------------------------------------------------------ TECH
  {
    title: "Which companies will be acquired before 2027?",
    category: "tech",
    subcategory: "Acquisitions",
    description:
      "Each outcome resolves Yes if a definitive acquisition agreement for that company is announced before January 1, 2027.",
    endDate: "2027-01-01T00:00:00.000Z",
    totalVolume: 8412900,
    volumeChange24h: 184000,
    resolutionSource: "SEC filings or official company announcements",
    outcomes: multi(
      [
        ["Figma", 0.34, 0.021],
        ["Databricks", 0.22, -0.012],
        ["Anthropic", 0.09, 0.003],
        ["Discord", 0.18, 0.008],
        ["Stripe", 0.07, -0.002],
      ],
      8412900
    ),
    isBinary: false,
  },
  {
    title: "Next Google Gemini Pro Model: Arena Debut?",
    category: "tech",
    subcategory: "AI",
    description:
      "Resolves Yes if the next Gemini Pro release debuts at #1 on the LMArena text leaderboard.",
    endDate: "2026-12-31T23:59:00.000Z",
    totalVolume: 3842100,
    volumeChange24h: 214000,
    resolutionSource: "LMArena public leaderboard",
    outcomes: binary(0.58, 0.037, 3842100),
    isBinary: true,
  },
  {
    title: "SpaceX Starship Flight Test 14 successful?",
    category: "tech",
    subcategory: "Space",
    description:
      "Resolves Yes if Starship Flight Test 14 completes its stated mission objectives including a controlled splashdown.",
    endDate: "2026-10-30T23:59:00.000Z",
    totalVolume: 5204900,
    volumeChange24h: 312000,
    resolutionSource: "SpaceX official mission statement",
    outcomes: binary(0.71, 0.028, 5204900),
    isBinary: true,
  },
  {
    title: "Will OpenAI release GPT-6 before July 2026?",
    category: "tech",
    subcategory: "AI",
    description:
      "Resolves Yes if a model branded GPT-6 is made publicly available before July 1, 2026.",
    endDate: "2026-07-01T00:00:00.000Z",
    totalVolume: 9481200,
    volumeChange24h: -284000,
    resolutionSource: "OpenAI official announcement",
    outcomes: binary(0.33, -0.024, 9481200),
    isBinary: true,
  },
  {
    title: "Apple ships a foldable iPhone before 2028?",
    category: "tech",
    subcategory: "Launches",
    description:
      "Resolves Yes if Apple begins retail sales of a foldable iPhone before January 1, 2028.",
    endDate: "2028-01-01T00:00:00.000Z",
    totalVolume: 4102800,
    volumeChange24h: 61000,
    resolutionSource: "Apple official product availability",
    outcomes: binary(0.54, 0.011, 4102800),
    isBinary: true,
  },

  // --------------------------------------------------------------- ECONOMY
  {
    title: "How many Fed rate cuts in 2026?",
    category: "economy",
    subcategory: "Fed",
    description:
      "Resolves to the total number of 25bp-equivalent reductions to the federal funds target range announced in calendar year 2026.",
    endDate: "2026-12-16T19:00:00.000Z",
    totalVolume: 42918400,
    volumeChange24h: 1024000,
    resolutionSource: "FOMC statements",
    outcomes: multi(
      [
        ["3 cuts", 0.32, 0.024],
        ["2 cuts", 0.28, -0.014],
        ["4 cuts", 0.19, 0.011],
        ["1 cut", 0.12, -0.006],
        ["0 cuts", 0.09, -0.004],
      ],
      42918400
    ),
    isBinary: false,
  },
  {
    title: "What will the Fed Rate hit before 2027?",
    category: "economy",
    subcategory: "Fed",
    description:
      "Resolves to the lowest federal funds target range midpoint reached before January 1, 2027.",
    endDate: "2027-01-01T00:00:00.000Z",
    totalVolume: 18420900,
    volumeChange24h: 412000,
    resolutionSource: "FOMC statements",
    outcomes: multi(
      [
        ["3.00-3.25%", 0.34, 0.017],
        ["2.75-3.00%", 0.27, 0.009],
        ["3.25-3.50%", 0.22, -0.012],
        ["Below 2.75%", 0.17, -0.006],
      ],
      18420900
    ),
    isBinary: false,
  },
  {
    title: "Japan GDP growth in Q3 2026 above 1.0%?",
    category: "economy",
    subcategory: "GDP",
    description:
      "Resolves Yes if the annualized real GDP growth rate in the first preliminary estimate exceeds 1.0%.",
    endDate: "2026-11-16T23:50:00.000Z",
    totalVolume: 1284900,
    volumeChange24h: 24100,
    resolutionSource: "Cabinet Office of Japan preliminary release",
    outcomes: binary(0.46, 0.008, 1284900),
    isBinary: true,
  },
  {
    title: "US CPI above 3.0% year-over-year in December 2026?",
    category: "economy",
    subcategory: "Inflation",
    description:
      "Resolves Yes if headline CPI year-over-year for December 2026 is reported above 3.0%.",
    endDate: "2027-01-13T13:30:00.000Z",
    totalVolume: 14209800,
    volumeChange24h: -284000,
    resolutionSource: "BLS CPI release",
    outcomes: binary(0.37, -0.019, 14209800),
    isBinary: true,
  },
  {
    title: "US unemployment rate above 5.0% before 2027?",
    category: "economy",
    subcategory: "Jobs",
    description:
      "Resolves Yes if any monthly BLS household survey print before January 1, 2027 shows unemployment above 5.0%.",
    endDate: "2027-01-01T00:00:00.000Z",
    totalVolume: 7482100,
    volumeChange24h: 142000,
    resolutionSource: "BLS Employment Situation report",
    outcomes: binary(0.29, 0.013, 7482100),
    isBinary: true,
  },

  // --------------------------------------------------------------- CULTURE
  {
    title: "Will the US government confirm alien life before 2027?",
    category: "culture",
    subcategory: "Mentions",
    description:
      "Resolves Yes if an official US government body publicly confirms the existence of extraterrestrial life before January 1, 2027.",
    endDate: "2027-01-01T00:00:00.000Z",
    totalVolume: 3841200,
    volumeChange24h: 61400,
    resolutionSource: "Official US government statement",
    outcomes: binary(0.04, 0.002, 3841200),
    isBinary: true,
  },
  {
    title: "Highest temperature in Shanghai on Sep 23?",
    category: "culture",
    subcategory: "Weather",
    description:
      "Resolves to the bucket containing the maximum recorded temperature at Hongqiao station on September 23, 2026.",
    endDate: "2026-09-23T16:00:00.000Z",
    isLive: true,
    totalVolume: 184200,
    volumeChange24h: 21400,
    resolutionSource: "China Meteorological Administration",
    outcomes: multi(
      [
        ["28-30°C", 0.41, 0.032],
        ["30-32°C", 0.29, -0.018],
        ["26-28°C", 0.19, 0.006],
        ["Above 32°C", 0.11, -0.004],
      ],
      184200
    ),
    isBinary: false,
  },
  {
    title: "Best Picture Winner 2027",
    category: "culture",
    subcategory: "Awards",
    description: "Resolves to the film that wins Best Picture at the 99th Academy Awards.",
    endDate: "2027-03-14T04:00:00.000Z",
    totalVolume: 2941800,
    volumeChange24h: 84200,
    resolutionSource: "Academy of Motion Picture Arts and Sciences",
    outcomes: multi(
      [
        ["Sinners", 0.27, 0.019],
        ["One Battle After Another", 0.24, -0.012],
        ["Hamnet", 0.18, 0.007],
        ["Marty Supreme", 0.13, 0.004],
      ],
      2941800
    ),
    isBinary: false,
  },
  {
    title: "Will Taylor Swift announce a 2027 world tour before June 2026?",
    category: "culture",
    subcategory: "Music",
    description:
      "Resolves Yes if an official 2027 world tour announcement is made before June 1, 2026.",
    endDate: "2026-06-01T00:00:00.000Z",
    totalVolume: 1482900,
    volumeChange24h: -42800,
    resolutionSource: "Official artist announcement",
    outcomes: binary(0.47, -0.021, 1482900),
    isBinary: true,
  },
  {
    title: "Grammy Album of the Year 2027",
    category: "culture",
    subcategory: "Awards",
    description: "Resolves to the album that wins Album of the Year at the 69th Grammy Awards.",
    endDate: "2027-02-01T04:00:00.000Z",
    totalVolume: 942100,
    volumeChange24h: 18400,
    resolutionSource: "Recording Academy official results",
    outcomes: multi(
      [
        ["Kendrick Lamar", 0.31, 0.014],
        ["Sabrina Carpenter", 0.24, 0.008],
        ["Tyler, the Creator", 0.2, -0.006],
        ["Rosalía", 0.15, 0.003],
      ],
      942100
    ),
    isBinary: false,
  },
];

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
}

export const MARKETS: Market[] = SEEDS.map((seed, i) => ({
  id: `mkt_${String(i + 1).padStart(3, "0")}`,
  slug: slugify(seed.title),
  title: seed.title,
  category: seed.category,
  subcategory: seed.subcategory,
  description: seed.description,
  endDate: seed.endDate,
  isLive: Boolean(seed.isLive),
  totalVolume: seed.totalVolume,
  volumeChange24h: seed.volumeChange24h,
  outcomes: seed.outcomes,
  resolutionSource: seed.resolutionSource,
  isBinary: seed.isBinary,
}));

export function getMarketBySlug(slug: string) {
  return MARKETS.find((m) => m.slug === slug);
}

export function getMarketsByCategory(category: string) {
  if (category === "live") return MARKETS.filter((m) => m.isLive);
  return MARKETS.filter((m) => m.category === category);
}

/** Deterministic pseudo-random probability history for the chart. */
export function buildHistory(market: Market, points = 60) {
  const base = market.outcomes[0].price;
  let seed = 0;
  for (let i = 0; i < market.slug.length; i++) seed += market.slug.charCodeAt(i);

  const out: Array<{ t: string; p: number }> = [];
  let value = Math.min(0.92, Math.max(0.08, base - market.outcomes[0].change24h * 6));
  for (let i = 0; i < points; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    const noise = (seed / 233280 - 0.5) * 0.045;
    value = Math.min(0.96, Math.max(0.04, value + noise + (base - value) * 0.06));
    const d = new Date(Date.now() - (points - i) * 3600 * 1000);
    out.push({
      t: d.toISOString(),
      p: Number((value * 100).toFixed(1)),
    });
  }
  out[out.length - 1].p = Number((base * 100).toFixed(1));
  return out;
}

export function buildOrderBook(market: Market) {
  const mid = market.outcomes[0].price;
  let seed = market.title.length * 7919;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const asks = Array.from({ length: 6 }, (_, i) => ({
    price: Number(Math.min(0.99, mid + 0.01 * (i + 1)).toFixed(2)),
    size: Math.round(400 + rnd() * 9000),
  }));
  const bids = Array.from({ length: 6 }, (_, i) => ({
    price: Number(Math.max(0.01, mid - 0.01 * (i + 1)).toFixed(2)),
    size: Math.round(400 + rnd() * 9000),
  }));
  return { asks: asks.reverse(), bids };
}

export function buildActivity(market: Market) {
  let seed = market.slug.length * 104729;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const names = ["0x9f…21a4", "predictoor", "0x3b…88de", "bnbmaxi", "0xa1…04c7", "yieldfarmer"];
  return Array.from({ length: 8 }, (_, i) => {
    const outcome = market.outcomes[Math.floor(rnd() * market.outcomes.length)];
    return {
      id: `act_${i}`,
      user: names[Math.floor(rnd() * names.length)],
      side: rnd() > 0.45 ? "bought" : "sold",
      shares: Math.round(20 + rnd() * 900),
      label: outcome.label,
      price: outcome.price,
      minutesAgo: Math.round(1 + rnd() * 240),
    };
  });
}
