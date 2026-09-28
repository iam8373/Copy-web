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

/**
 * Live markets use offsets from module load instead of hardcoded dates, so
 * their countdowns never read "Closed" as real time passes.
 *
 * The baseline is rounded to the top of the hour so the value the server
 * renders and the value the client computes agree (live cards render the
 * client-only <Countdown>, so no date text is server-rendered for them).
 */
const HOUR_MS = 3_600_000;
const BASELINE = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
const inHours = (h: number) => new Date(BASELINE + h * HOUR_MS).toISOString();
const inDays = (d: number) => inHours(d * 24);

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
  region?: string;
  tags: string[];
};

const SEEDS: Seed[] = [
  // --------------------------------------------------------------- CRICKET
  {
    title: "Will India win the 2026 T20 World Cup?",
    category: "cricket",
    subcategory: "World Cup",
    description:
      "Resolves Yes if India are declared winners of the ICC Men's T20 World Cup 2026 final. A tied final decided by Super Over resolves to the declared winner.",
    endDate: "2026-03-08T18:00:00.000Z",
    totalVolume: 184920000,
    volumeChange24h: 4820000,
    resolutionSource: "ICC official result",
    outcomes: binary(0.38, 0.042, 184920000),
    isBinary: true,
    tags: ["cricket", "world-cup", "india"],
  },
  {
    title: "IPL 2026 Winner",
    category: "cricket",
    subcategory: "IPL",
    description:
      "Resolves to the franchise that wins the Indian Premier League 2026 final at Narendra Modi Stadium, Ahmedabad.",
    endDate: "2026-05-24T18:00:00.000Z",
    totalVolume: 421840000,
    volumeChange24h: 12400000,
    resolutionSource: "BCCI official result",
    outcomes: multi(
      [
        ["Mumbai Indians", 0.19, 0.018],
        ["Chennai Super Kings", 0.17, -0.012],
        ["Royal Challengers Bengaluru", 0.14, 0.021],
        ["Kolkata Knight Riders", 0.12, -0.004],
        ["Gujarat Titans", 0.11, 0.006],
        ["Rajasthan Royals", 0.09, -0.003],
      ],
      421840000
    ),
    isBinary: false,
    tags: ["cricket", "ipl", "india"],
  },
  {
    title: "Mumbai Indians vs. Chennai Super Kings",
    category: "cricket",
    subcategory: "IPL",
    description:
      "Resolves to the winner of the IPL 2026 league fixture at Wankhede Stadium. A no-result or abandoned match resolves 50/50.",
    endDate: inHours(6),
    isLive: true,
    totalVolume: 38470000,
    volumeChange24h: 6120000,
    resolutionSource: "BCCI official scorecard",
    outcomes: binary(0.57, 0.048, 38470000, ["Mumbai Indians", "Chennai Super Kings"]),
    isBinary: true,
    tags: ["cricket", "ipl", "live"],
  },
  {
    title: "Virat Kohli to score a century in IPL 2026?",
    category: "cricket",
    subcategory: "IPL",
    description:
      "Resolves Yes if Virat Kohli scores 100 or more runs in a single innings during IPL 2026, including playoffs.",
    endDate: "2026-05-24T18:00:00.000Z",
    totalVolume: 62180000,
    volumeChange24h: 1840000,
    resolutionSource: "BCCI official scorecard",
    outcomes: binary(0.44, -0.021, 62180000),
    isBinary: true,
    tags: ["cricket", "ipl", "kohli"],
  },
  {
    title: "Will Rohit Sharma retire from ODIs after the 2026 World Cup?",
    category: "cricket",
    subcategory: "ODI",
    description:
      "Resolves Yes if Rohit Sharma announces retirement from One Day Internationals within 90 days of the 2026 World Cup final.",
    endDate: "2026-06-30T18:00:00.000Z",
    totalVolume: 28940000,
    volumeChange24h: -842000,
    resolutionSource: "BCCI or player official announcement",
    outcomes: binary(0.52, -0.018, 28940000),
    isBinary: true,
    tags: ["cricket", "india", "rohit-sharma"],
  },
  {
    title: "India vs. Australia — 3rd Test, Day 4",
    category: "cricket",
    subcategory: "Test",
    description:
      "Resolves to the result of the third Test of the Border-Gavaskar Trophy. A draw resolves to the Draw outcome.",
    endDate: inHours(28),
    isLive: true,
    totalVolume: 74210000,
    volumeChange24h: 8940000,
    resolutionSource: "ICC official result",
    outcomes: multi(
      [
        ["India", 0.51, 0.062],
        ["Australia", 0.28, -0.048],
        ["Draw", 0.21, -0.014],
      ],
      74210000
    ),
    isBinary: false,
    tags: ["cricket", "test", "live"],
  },
  {
    title: "Ranji Trophy 2026 Winner",
    category: "cricket",
    subcategory: "Ranji Trophy",
    description: "Resolves to the state team that wins the Ranji Trophy 2025-26 final.",
    endDate: "2026-03-01T11:00:00.000Z",
    totalVolume: 9240000,
    volumeChange24h: 214000,
    resolutionSource: "BCCI official result",
    outcomes: multi(
      [
        ["Mumbai", 0.26, 0.014],
        ["Vidarbha", 0.21, 0.008],
        ["Karnataka", 0.17, -0.006],
        ["Saurashtra", 0.14, 0.004],
        ["Bengal", 0.11, -0.003],
      ],
      9240000
    ),
    isBinary: false,
    tags: ["cricket", "ranji", "domestic"],
  },
  {
    title: "Will India win the Women's T20 World Cup 2026?",
    category: "cricket",
    subcategory: "Women's Cricket",
    description:
      "Resolves Yes if the India women's team wins the ICC Women's T20 World Cup 2026 final.",
    endDate: "2026-07-05T18:00:00.000Z",
    totalVolume: 21840000,
    volumeChange24h: 1240000,
    resolutionSource: "ICC official result",
    outcomes: binary(0.31, 0.026, 21840000),
    isBinary: true,
    tags: ["cricket", "womens-cricket", "india"],
  },
  {
    title: "PSL 2026: Will any Indian broadcaster air the tournament?",
    category: "cricket",
    subcategory: "PSL",
    description:
      "Resolves Yes if a licensed Indian broadcaster or OTT platform holds official PSL 2026 rights for India.",
    endDate: "2026-04-01T00:00:00.000Z",
    totalVolume: 4820000,
    volumeChange24h: -142000,
    resolutionSource: "Official broadcaster announcements",
    outcomes: binary(0.12, -0.008, 4820000),
    isBinary: true,
    tags: ["cricket", "psl", "broadcast"],
  },
  {
    title: "BBL 2026: Will an Indian-origin player be top run scorer?",
    category: "cricket",
    subcategory: "BBL",
    description:
      "Resolves Yes if a player of Indian origin finishes as the leading run scorer of the Big Bash League 2025-26 season.",
    endDate: "2026-01-25T11:00:00.000Z",
    totalVolume: 3140000,
    volumeChange24h: 84000,
    resolutionSource: "Cricket Australia official statistics",
    outcomes: binary(0.18, 0.012, 3140000),
    isBinary: true,
    tags: ["cricket", "bbl", "global"],
  },

  // -------------------------------------------------------------- POLITICS
  {
    title: "Will BJP win the 2026 West Bengal Assembly Elections?",
    category: "politics",
    subcategory: "State Elections",
    description:
      "Resolves Yes if the BJP wins a majority of seats in the West Bengal Legislative Assembly, either alone or as the largest party in the governing coalition.",
    endDate: "2026-05-15T18:00:00.000Z",
    totalVolume: 284120000,
    volumeChange24h: 9840000,
    resolutionSource: "Election Commission of India",
    outcomes: binary(0.34, 0.038, 284120000),
    isBinary: true,
    tags: ["politics", "elections", "west-bengal", "india"],
  },
  {
    title: "Narendra Modi to remain Prime Minister through 2026?",
    category: "politics",
    subcategory: "Lok Sabha",
    description:
      "Resolves Yes if Narendra Modi holds the office of Prime Minister of India continuously through 31 December 2026.",
    endDate: "2026-12-31T18:30:00.000Z",
    totalVolume: 421940000,
    volumeChange24h: 6240000,
    resolutionSource: "Press Information Bureau, Government of India",
    outcomes: binary(0.91, 0.006, 421940000),
    isBinary: true,
    tags: ["politics", "lok-sabha", "india"],
  },
  {
    title: "Which alliance wins the 2026 Bihar Assembly Elections?",
    category: "politics",
    subcategory: "State Elections",
    description:
      "Resolves to the alliance that secures a majority in the Bihar Legislative Assembly following the 2026 election.",
    endDate: "2026-11-20T18:00:00.000Z",
    totalVolume: 148920000,
    volumeChange24h: 4120000,
    resolutionSource: "Election Commission of India",
    outcomes: multi(
      [
        ["NDA", 0.54, 0.024],
        ["INDIA alliance", 0.41, -0.021],
        ["Hung assembly", 0.05, -0.003],
      ],
      148920000
    ),
    isBinary: false,
    tags: ["politics", "elections", "bihar", "india"],
  },
  {
    title: "Will Congress win more than 100 Lok Sabha seats in the next general election?",
    category: "politics",
    subcategory: "Congress",
    description:
      "Resolves Yes if the Indian National Congress wins 100 or more seats in the next Lok Sabha general election.",
    endDate: "2029-06-01T18:00:00.000Z",
    totalVolume: 94820000,
    volumeChange24h: -2140000,
    resolutionSource: "Election Commission of India",
    outcomes: binary(0.47, -0.016, 94820000),
    isBinary: true,
    tags: ["politics", "congress", "lok-sabha"],
  },
  {
    title: "Will AAP retain Delhi in the next municipal polls?",
    category: "politics",
    subcategory: "AAP",
    description:
      "Resolves Yes if the Aam Aadmi Party wins the largest number of wards in the next Municipal Corporation of Delhi election.",
    endDate: "2027-04-30T18:00:00.000Z",
    totalVolume: 42180000,
    volumeChange24h: 1240000,
    resolutionSource: "State Election Commission, Delhi",
    outcomes: binary(0.39, 0.022, 42180000),
    isBinary: true,
    tags: ["politics", "aap", "delhi"],
  },
  {
    title: "Will the Women's Reservation Act be implemented before the 2029 election?",
    category: "politics",
    subcategory: "Parliament",
    description:
      "Resolves Yes if seat reservation under the Nari Shakti Vandan Adhiniyam is operative for the 2029 Lok Sabha election.",
    endDate: "2029-04-01T18:30:00.000Z",
    totalVolume: 68420000,
    volumeChange24h: 2840000,
    resolutionSource: "Gazette of India notification",
    outcomes: binary(0.58, 0.031, 68420000),
    isBinary: true,
    tags: ["politics", "parliament", "legislation"],
  },
  {
    title: "Monsoon session 2026: Will more than 20 bills be passed?",
    category: "politics",
    subcategory: "Parliament",
    description:
      "Resolves Yes if both Houses pass more than 20 bills during the 2026 monsoon session of Parliament.",
    endDate: inDays(9),
    isLive: true,
    totalVolume: 18240000,
    volumeChange24h: 940000,
    resolutionSource: "Lok Sabha and Rajya Sabha bulletins",
    outcomes: binary(0.43, 0.028, 18240000),
    isBinary: true,
    tags: ["politics", "parliament", "live"],
  },
  {
    title: "US Presidential Election 2028 Winner",
    category: "politics",
    subcategory: "Global Election",
    description:
      "Resolves to the candidate certified as the winner of the 2028 United States presidential election.",
    endDate: "2028-11-07T23:59:00.000Z",
    totalVolume: 184210000,
    volumeChange24h: 3840000,
    resolutionSource: "Certified Electoral College result",
    outcomes: multi(
      [
        ["Democratic nominee", 0.49, 0.014],
        ["Republican nominee", 0.48, -0.012],
        ["Third party", 0.03, -0.002],
      ],
      184210000
    ),
    isBinary: false,
    tags: ["politics", "global-election", "us"],
  },
  {
    title: "Will a new state be created in India before 2030?",
    category: "politics",
    subcategory: "India News",
    description:
      "Resolves Yes if a new state is formally constituted under Article 3 of the Constitution before 1 January 2030.",
    endDate: "2030-01-01T00:00:00.000Z",
    totalVolume: 24180000,
    volumeChange24h: 420000,
    resolutionSource: "Gazette of India notification",
    outcomes: binary(0.22, 0.009, 24180000),
    isBinary: true,
    tags: ["politics", "india-news", "states"],
  },

  // --------------------------------------------------------- ENTERTAINMENT
  {
    title: "Bigg Boss 19 Winner",
    category: "entertainment",
    subcategory: "Bigg Boss",
    description:
      "Resolves to the contestant declared winner in the Bigg Boss 19 grand finale. Wildcard entrants are eligible.",
    endDate: inDays(4),
    isLive: true,
    totalVolume: 94820000,
    volumeChange24h: 12400000,
    resolutionSource: "Official broadcast result",
    outcomes: multi(
      [
        ["Ankita Sharma", 0.31, 0.042],
        ["Rahul Verma", 0.24, -0.018],
        ["Priya Nair", 0.19, 0.012],
        ["Sameer Khan", 0.14, -0.008],
        ["Divya Rathi", 0.12, -0.006],
      ],
      94820000
    ),
    isBinary: false,
    tags: ["entertainment", "bigg-boss", "reality-tv", "live"],
  },
  {
    title: "Highest grossing Bollywood film of 2026?",
    category: "entertainment",
    subcategory: "Bollywood",
    description:
      "Resolves to the Hindi film with the highest worldwide gross for films released in calendar year 2026.",
    endDate: "2027-01-15T00:00:00.000Z",
    totalVolume: 128410000,
    volumeChange24h: 4820000,
    resolutionSource: "Certified distributor collections",
    outcomes: multi(
      [
        ["Untitled Khan action film", 0.27, 0.021],
        ["Spirit", 0.23, 0.014],
        ["Ramayana Part 2", 0.21, -0.009],
        ["Dhurandhar sequel", 0.16, -0.006],
        ["Other", 0.13, -0.004],
      ],
      128410000
    ),
    isBinary: false,
    tags: ["entertainment", "bollywood", "box-office"],
  },
  {
    title: "Will the biggest Bollywood release of 2026 cross ₹1,000 crore worldwide?",
    category: "entertainment",
    subcategory: "Bollywood",
    description:
      "Resolves Yes if any Hindi film released in 2026 reports worldwide gross collections above ₹1,000 crore.",
    endDate: "2027-01-15T00:00:00.000Z",
    totalVolume: 84210000,
    volumeChange24h: 2140000,
    resolutionSource: "Certified distributor collections",
    outcomes: binary(0.61, 0.028, 84210000),
    isBinary: true,
    tags: ["entertainment", "bollywood", "box-office"],
  },
  {
    title: "Roadies 20 Winner",
    category: "entertainment",
    subcategory: "Roadies",
    description: "Resolves to the contestant declared winner of the Roadies season 20 finale.",
    endDate: "2026-06-14T16:30:00.000Z",
    totalVolume: 18420000,
    volumeChange24h: 842000,
    resolutionSource: "Official broadcast result",
    outcomes: multi(
      [
        ["Arjun Mehta", 0.29, 0.018],
        ["Kavya Joshi", 0.26, 0.011],
        ["Imran Sheikh", 0.23, -0.009],
        ["Neha Bisht", 0.22, -0.007],
      ],
      18420000
    ),
    isBinary: false,
    tags: ["entertainment", "roadies", "reality-tv"],
  },
  {
    title: "Will any Indian YouTube channel cross 500 million subscribers in 2026?",
    category: "entertainment",
    subcategory: "YouTube",
    description:
      "Resolves Yes if an India-based YouTube channel publicly displays 500 million or more subscribers during 2026.",
    endDate: "2026-12-31T18:30:00.000Z",
    totalVolume: 42180000,
    volumeChange24h: 1840000,
    resolutionSource: "YouTube public subscriber count",
    outcomes: binary(0.36, -0.014, 42180000),
    isBinary: true,
    tags: ["entertainment", "youtube", "creators"],
  },
  {
    title: "Will an Indian film win an Oscar in 2027?",
    category: "entertainment",
    subcategory: "Movies",
    description:
      "Resolves Yes if an Indian production or co-production wins any competitive category at the 2027 Academy Awards.",
    endDate: "2027-03-14T04:00:00.000Z",
    totalVolume: 31240000,
    volumeChange24h: 620000,
    resolutionSource: "Academy of Motion Picture Arts and Sciences",
    outcomes: binary(0.19, 0.008, 31240000),
    isBinary: true,
    tags: ["entertainment", "movies", "oscars"],
  },
  {
    title: "Most watched Indian OTT series of 2026?",
    category: "entertainment",
    subcategory: "OTT",
    description:
      "Resolves to the Indian original series with the highest reported viewing hours across streaming platforms in 2026.",
    endDate: "2027-01-31T00:00:00.000Z",
    totalVolume: 24820000,
    volumeChange24h: 940000,
    resolutionSource: "Platform published viewership reports",
    outcomes: multi(
      [
        ["Mirzapur 4", 0.33, 0.024],
        ["The Family Man 3", 0.29, 0.016],
        ["Panchayat 5", 0.22, -0.011],
        ["Sacred Games revival", 0.16, -0.008],
      ],
      24820000
    ),
    isBinary: false,
    tags: ["entertainment", "ott", "streaming"],
  },
  {
    title: "Will a top-5 Bollywood star announce a Hollywood lead role in 2026?",
    category: "entertainment",
    subcategory: "Celebrity",
    description:
      "Resolves Yes if a leading Bollywood actor confirms a lead role in a major Hollywood studio production during 2026.",
    endDate: "2026-12-31T18:30:00.000Z",
    totalVolume: 14820000,
    volumeChange24h: -320000,
    resolutionSource: "Studio or talent agency announcement",
    outcomes: binary(0.28, -0.012, 14820000),
    isBinary: true,
    tags: ["entertainment", "celebrity", "bollywood"],
  },

  // --------------------------------------------------------------- ECONOMY
  {
    title: "Will the RBI cut the repo rate in 2026?",
    category: "economy",
    subcategory: "RBI",
    description:
      "Resolves Yes if the Monetary Policy Committee announces at least one reduction to the policy repo rate during calendar year 2026.",
    endDate: "2026-12-31T18:30:00.000Z",
    totalVolume: 214820000,
    volumeChange24h: 7840000,
    resolutionSource: "RBI Monetary Policy Committee statement",
    outcomes: binary(0.67, 0.034, 214820000),
    isBinary: true,
    tags: ["economy", "rbi", "rates", "india"],
  },
  {
    title: "How many RBI repo rate cuts in 2026?",
    category: "economy",
    subcategory: "RBI",
    description:
      "Resolves to the total number of 25bp-equivalent repo rate reductions announced by the MPC in calendar year 2026.",
    endDate: "2026-12-31T18:30:00.000Z",
    totalVolume: 148210000,
    volumeChange24h: 3240000,
    resolutionSource: "RBI Monetary Policy Committee statement",
    outcomes: multi(
      [
        ["2 cuts", 0.34, 0.021],
        ["1 cut", 0.28, -0.014],
        ["3 cuts", 0.19, 0.011],
        ["0 cuts", 0.12, -0.008],
        ["4+ cuts", 0.07, -0.004],
      ],
      148210000
    ),
    isBinary: false,
    tags: ["economy", "rbi", "rates"],
  },
  {
    title: "India GDP growth above 7% in FY27?",
    category: "economy",
    subcategory: "GDP",
    description:
      "Resolves Yes if the provisional estimate of real GDP growth for FY2026-27 is above 7.0%.",
    endDate: "2027-05-31T12:00:00.000Z",
    totalVolume: 184920000,
    volumeChange24h: 4120000,
    resolutionSource: "MoSPI National Accounts Statistics",
    outcomes: binary(0.54, 0.019, 184920000),
    isBinary: true,
    tags: ["economy", "gdp", "india"],
  },
  {
    title: "Union Budget 2026: Will income tax slabs change?",
    category: "economy",
    subcategory: "Budget",
    description:
      "Resolves Yes if the Union Budget 2026-27 announces any change to personal income tax slab rates or thresholds.",
    endDate: inDays(12),
    isLive: true,
    totalVolume: 248120000,
    volumeChange24h: 18400000,
    resolutionSource: "Union Budget Finance Bill",
    outcomes: binary(0.72, 0.058, 248120000),
    isBinary: true,
    tags: ["economy", "budget", "tax", "live"],
  },
  {
    title: "Will India's CPI inflation fall below 5% by December 2026?",
    category: "economy",
    subcategory: "Inflation",
    description:
      "Resolves Yes if the headline CPI year-on-year print for December 2026 is below 5.0%.",
    endDate: "2027-01-12T12:00:00.000Z",
    totalVolume: 94210000,
    volumeChange24h: -1840000,
    resolutionSource: "MoSPI Consumer Price Index release",
    outcomes: binary(0.58, -0.022, 94210000),
    isBinary: true,
    tags: ["economy", "inflation", "india"],
  },
  {
    title: "Will India's unemployment rate fall below 6% in 2026?",
    category: "economy",
    subcategory: "Jobs",
    description:
      "Resolves Yes if any quarterly PLFS urban unemployment print during 2026 is below 6.0%.",
    endDate: "2026-12-31T18:30:00.000Z",
    totalVolume: 42180000,
    volumeChange24h: 840000,
    resolutionSource: "Periodic Labour Force Survey, MoSPI",
    outcomes: binary(0.41, 0.013, 42180000),
    isBinary: true,
    tags: ["economy", "jobs", "india"],
  },
  {
    title: "Will GST collections cross ₹2 lakh crore in a single month in 2026?",
    category: "economy",
    subcategory: "Tax",
    description:
      "Resolves Yes if gross monthly GST collections exceed ₹2,00,000 crore in any month of calendar 2026.",
    endDate: "2026-12-31T18:30:00.000Z",
    totalVolume: 68420000,
    volumeChange24h: 2140000,
    resolutionSource: "Ministry of Finance GST collection release",
    outcomes: binary(0.76, 0.024, 68420000),
    isBinary: true,
    tags: ["economy", "tax", "gst", "india"],
  },
  {
    title: "Will the US Fed cut rates more than India's RBI in 2026?",
    category: "economy",
    subcategory: "World",
    description:
      "Resolves Yes if the US Federal Reserve announces more cumulative basis points of cuts than the RBI during 2026.",
    endDate: "2026-12-31T18:30:00.000Z",
    totalVolume: 54820000,
    volumeChange24h: 1240000,
    resolutionSource: "FOMC and RBI MPC statements",
    outcomes: binary(0.49, -0.011, 54820000),
    isBinary: true,
    tags: ["economy", "world", "rates"],
  },

  // --------------------------------------------------------------- FINANCE
  {
    title: "Nifty 50 to cross 30,000 by December 2026?",
    category: "finance",
    subcategory: "Nifty",
    description:
      "Resolves Yes if the Nifty 50 index closes above 30,000 on any NSE trading day before 31 December 2026.",
    endDate: "2026-12-31T10:00:00.000Z",
    totalVolume: 312840000,
    volumeChange24h: 9840000,
    resolutionSource: "NSE official closing index level",
    outcomes: binary(0.44, 0.026, 312840000),
    isBinary: true,
    tags: ["finance", "nifty", "stocks", "india"],
  },
  {
    title: "Sensex to hit 95,000 in 2026?",
    category: "finance",
    subcategory: "Sensex",
    description:
      "Resolves Yes if the BSE Sensex closes above 95,000 on any trading day during calendar year 2026.",
    endDate: "2026-12-31T10:00:00.000Z",
    totalVolume: 248210000,
    volumeChange24h: 6240000,
    resolutionSource: "BSE official closing index level",
    outcomes: binary(0.51, 0.018, 248210000),
    isBinary: true,
    tags: ["finance", "sensex", "stocks", "india"],
  },
  {
    title: "Gold to cross ₹1,20,000 per 10g in 2026?",
    category: "finance",
    subcategory: "Gold",
    description:
      "Resolves Yes if the MCX spot price for 24-carat gold exceeds ₹1,20,000 per 10 grams at any point in 2026.",
    endDate: inDays(94),
    isLive: true,
    totalVolume: 184920000,
    volumeChange24h: 14200000,
    resolutionSource: "MCX India spot price",
    outcomes: binary(0.63, 0.048, 184920000),
    isBinary: true,
    tags: ["finance", "gold", "commodities", "live"],
  },
  {
    title: "Silver to cross ₹2,00,000 per kg in 2026?",
    category: "finance",
    subcategory: "Silver",
    description:
      "Resolves Yes if the MCX silver spot price exceeds ₹2,00,000 per kilogram at any point during 2026.",
    endDate: "2026-12-31T18:30:00.000Z",
    totalVolume: 94210000,
    volumeChange24h: 4820000,
    resolutionSource: "MCX India spot price",
    outcomes: binary(0.47, 0.032, 94210000),
    isBinary: true,
    tags: ["finance", "silver", "commodities"],
  },
  {
    title: "Reliance Jio IPO to list in 2026?",
    category: "finance",
    subcategory: "IPO",
    description:
      "Resolves Yes if Reliance Jio Infocomm shares begin trading on an Indian exchange before 31 December 2026.",
    endDate: "2026-12-31T10:00:00.000Z",
    totalVolume: 284120000,
    volumeChange24h: 12400000,
    resolutionSource: "NSE/BSE listing notice",
    outcomes: binary(0.42, 0.036, 284120000),
    isBinary: true,
    tags: ["finance", "ipo", "reliance", "india"],
  },
  {
    title: "Reliance Industries market cap above ₹25 lakh crore by Dec 2026?",
    category: "finance",
    subcategory: "Market Cap",
    description:
      "Resolves Yes if Reliance Industries' closing market capitalisation exceeds ₹25 lakh crore on 31 December 2026.",
    endDate: "2026-12-31T10:00:00.000Z",
    totalVolume: 128420000,
    volumeChange24h: -2840000,
    resolutionSource: "NSE closing price and share count",
    outcomes: binary(0.38, -0.014, 128420000),
    isBinary: true,
    tags: ["finance", "market-cap", "reliance"],
  },
  {
    title: "HDFC Bank Up or Down today?",
    category: "finance",
    subcategory: "Stocks",
    description:
      "Resolves Up if HDFC Bank closes higher than the previous session close on the NSE, otherwise Down.",
    endDate: inHours(3),
    isLive: true,
    totalVolume: 42180000,
    volumeChange24h: 8420000,
    resolutionSource: "NSE official closing price",
    outcomes: binary(0.58, 0.041, 42180000, ["Up", "Down"]),
    isBinary: true,
    tags: ["finance", "stocks", "live", "india"],
  },
  {
    title: "Will India approve a spot Bitcoin ETF before 2028?",
    category: "finance",
    subcategory: "Crypto India",
    description:
      "Resolves Yes if SEBI approves a spot Bitcoin exchange-traded fund for Indian retail investors before 1 January 2028.",
    endDate: "2028-01-01T00:00:00.000Z",
    totalVolume: 94820000,
    volumeChange24h: 3140000,
    resolutionSource: "SEBI approval order",
    outcomes: binary(0.29, 0.019, 94820000),
    isBinary: true,
    tags: ["finance", "crypto-india", "sebi"],
  },
  {
    title: "Crude oil above $95/barrel before 2027?",
    category: "finance",
    subcategory: "Commodities",
    description:
      "Resolves Yes if front-month Brent crude settles above $95 per barrel before 1 January 2027.",
    endDate: "2027-01-01T00:00:00.000Z",
    totalVolume: 68240000,
    volumeChange24h: 1840000,
    resolutionSource: "ICE Brent front-month settlement",
    outcomes: binary(0.33, 0.014, 68240000),
    isBinary: true,
    tags: ["finance", "commodities", "crude"],
  },
  {
    title: "Zepto to be valued above $10B in its next round?",
    category: "finance",
    subcategory: "Pre-IPO",
    description:
      "Resolves Yes if Zepto's next reported primary funding round values the company above $10 billion.",
    endDate: "2027-06-30T18:30:00.000Z",
    totalVolume: 48210000,
    volumeChange24h: -940000,
    resolutionSource: "Reported round terms from two major outlets",
    outcomes: binary(0.41, -0.017, 48210000),
    isBinary: true,
    tags: ["finance", "pre-ipo", "startups", "india"],
  },

  // ---------------------------------------------------------------- SPORTS
  {
    title: "Will India win hockey gold at the 2026 Asian Games?",
    category: "sports",
    subcategory: "Asian Games",
    description:
      "Resolves Yes if the India men's hockey team wins the gold medal at the 2026 Asian Games.",
    endDate: "2026-10-04T14:00:00.000Z",
    totalVolume: 84920000,
    volumeChange24h: 3240000,
    resolutionSource: "Olympic Council of Asia official results",
    outcomes: binary(0.48, 0.028, 84920000),
    isBinary: true,
    tags: ["sports", "hockey", "asian-games", "india"],
  },
  {
    title: "Neeraj Chopra to win gold at the 2026 Asian Games?",
    category: "sports",
    subcategory: "Asian Games",
    description:
      "Resolves Yes if Neeraj Chopra wins the men's javelin gold medal at the 2026 Asian Games.",
    endDate: "2026-10-02T14:00:00.000Z",
    totalVolume: 68420000,
    volumeChange24h: 2140000,
    resolutionSource: "Olympic Council of Asia official results",
    outcomes: binary(0.71, 0.016, 68420000),
    isBinary: true,
    tags: ["sports", "athletics", "asian-games", "india"],
  },
  {
    title: "ISL 2026 Winner",
    category: "sports",
    subcategory: "Football",
    description: "Resolves to the club that wins the Indian Super League 2025-26 final.",
    endDate: inDays(17),
    isLive: true,
    totalVolume: 42180000,
    volumeChange24h: 4820000,
    resolutionSource: "AIFF official result",
    outcomes: multi(
      [
        ["Mohun Bagan SG", 0.31, 0.024],
        ["Mumbai City FC", 0.24, -0.012],
        ["Bengaluru FC", 0.19, 0.008],
        ["FC Goa", 0.15, -0.006],
        ["Kerala Blasters", 0.11, -0.004],
      ],
      42180000
    ),
    isBinary: false,
    tags: ["sports", "football", "isl", "live"],
  },
  {
    title: "Will India qualify for the 2030 FIFA World Cup?",
    category: "sports",
    subcategory: "Football",
    description:
      "Resolves Yes if the India men's national team qualifies for the 2030 FIFA World Cup finals.",
    endDate: "2029-12-01T18:30:00.000Z",
    totalVolume: 31240000,
    volumeChange24h: 620000,
    resolutionSource: "FIFA official qualification record",
    outcomes: binary(0.07, 0.003, 31240000),
    isBinary: true,
    tags: ["sports", "football", "india"],
  },
  {
    title: "Will an Indian reach a Grand Slam singles quarter-final in 2026?",
    category: "sports",
    subcategory: "Tennis",
    description:
      "Resolves Yes if any Indian player reaches the singles quarter-finals of a 2026 Grand Slam.",
    endDate: "2026-09-13T18:00:00.000Z",
    totalVolume: 18420000,
    volumeChange24h: 420000,
    resolutionSource: "ATP/WTA official draw results",
    outcomes: binary(0.11, -0.006, 18420000),
    isBinary: true,
    tags: ["sports", "tennis", "india"],
  },
  {
    title: "2026 F1 Drivers' Championship Winner",
    category: "sports",
    subcategory: "F1",
    description:
      "Resolves to the driver classified first in the 2026 FIA Formula One Drivers' Championship.",
    endDate: "2026-12-06T18:00:00.000Z",
    totalVolume: 94210000,
    volumeChange24h: 3840000,
    resolutionSource: "FIA final classification",
    outcomes: multi(
      [
        ["Max Verstappen", 0.34, -0.018],
        ["Lando Norris", 0.26, 0.021],
        ["Charles Leclerc", 0.18, 0.009],
        ["Oscar Piastri", 0.14, 0.006],
        ["George Russell", 0.08, -0.004],
      ],
      94210000
    ),
    isBinary: false,
    tags: ["sports", "f1", "global"],
  },
  {
    title: "Pro Kabaddi League 2026 Winner",
    category: "sports",
    subcategory: "Kabaddi",
    description: "Resolves to the franchise that wins the Pro Kabaddi League 2026 final.",
    endDate: "2026-08-30T15:00:00.000Z",
    totalVolume: 24820000,
    volumeChange24h: 940000,
    resolutionSource: "Pro Kabaddi League official result",
    outcomes: multi(
      [
        ["Patna Pirates", 0.24, 0.014],
        ["Jaipur Pink Panthers", 0.22, 0.011],
        ["Puneri Paltan", 0.19, -0.008],
        ["Dabang Delhi", 0.17, -0.006],
        ["Bengaluru Bulls", 0.14, -0.004],
      ],
      24820000
    ),
    isBinary: false,
    tags: ["sports", "kabaddi", "india"],
  },
  {
    title: "Will an Indian win badminton singles gold at the 2026 Asian Games?",
    category: "sports",
    subcategory: "Badminton",
    description:
      "Resolves Yes if an Indian player wins either the men's or women's badminton singles gold at the 2026 Asian Games.",
    endDate: "2026-10-03T14:00:00.000Z",
    totalVolume: 31840000,
    volumeChange24h: 1240000,
    resolutionSource: "Olympic Council of Asia official results",
    outcomes: binary(0.34, 0.021, 31840000),
    isBinary: true,
    tags: ["sports", "badminton", "asian-games", "india"],
  },

  // --------------------------------------------------------------- ESPORTS
  {
    title: "BGMI Masters Series 2026 Winner",
    category: "esports",
    subcategory: "BGMI",
    description:
      "Resolves to the team that finishes first in the BGMI Masters Series 2026 grand finals.",
    endDate: inDays(25),
    isLive: true,
    totalVolume: 48210000,
    volumeChange24h: 6240000,
    resolutionSource: "Krafton official tournament standings",
    outcomes: multi(
      [
        ["Team Soul", 0.26, 0.031],
        ["GodLike Esports", 0.23, -0.014],
        ["Team XSpark", 0.19, 0.011],
        ["Orangutan", 0.16, -0.008],
        ["Gladiators", 0.11, -0.005],
      ],
      48210000
    ),
    isBinary: false,
    tags: ["esports", "bgmi", "india", "live"],
  },
  {
    title: "Will Team Soul win the Free Fire India Championship 2026?",
    category: "esports",
    subcategory: "Free Fire",
    description:
      "Resolves Yes if Team Soul finishes first in the Free Fire India Championship 2026 grand finals.",
    endDate: "2026-09-27T14:00:00.000Z",
    totalVolume: 21840000,
    volumeChange24h: 842000,
    resolutionSource: "Garena official tournament standings",
    outcomes: binary(0.24, 0.014, 21840000),
    isBinary: true,
    tags: ["esports", "free-fire", "india"],
  },
  {
    title: "Valorant Champions 2026: Will an Indian team finish top 4?",
    category: "esports",
    subcategory: "Valorant",
    description:
      "Resolves Yes if a team with an Indian organisation licence places in the top four at Valorant Champions 2026.",
    endDate: "2026-10-04T22:00:00.000Z",
    totalVolume: 18420000,
    volumeChange24h: -420000,
    resolutionSource: "Riot Games official bracket",
    outcomes: binary(0.16, -0.009, 18420000),
    isBinary: true,
    tags: ["esports", "valorant", "india"],
  },
  {
    title: "CS2 Major 2026 Champion",
    category: "esports",
    subcategory: "CS2",
    description: "Resolves to the team that wins the 2026 Counter-Strike 2 Major.",
    endDate: "2026-11-15T20:00:00.000Z",
    totalVolume: 31240000,
    volumeChange24h: 1240000,
    resolutionSource: "Official Major bracket result",
    outcomes: multi(
      [
        ["NAVI", 0.24, 0.018],
        ["Vitality", 0.22, -0.011],
        ["FaZe", 0.17, 0.006],
        ["G2", 0.14, -0.004],
        ["Spirit", 0.12, 0.002],
      ],
      31240000
    ),
    isBinary: false,
    tags: ["esports", "cs2", "global"],
  },
  {
    title: "Will GTA 6 release before December 2026?",
    category: "esports",
    subcategory: "GTA",
    description:
      "Resolves Yes if Grand Theft Auto VI is commercially released on any platform before 1 December 2026.",
    endDate: "2026-12-01T00:00:00.000Z",
    totalVolume: 128420000,
    volumeChange24h: 8420000,
    resolutionSource: "Rockstar Games official release",
    outcomes: binary(0.56, -0.038, 128420000),
    isBinary: true,
    tags: ["esports", "gta", "gaming"],
  },
  {
    title: "Will PUBG Mobile return to India in 2026?",
    category: "esports",
    subcategory: "PUBG",
    description:
      "Resolves Yes if PUBG Mobile is officially available on Indian app stores at any point during 2026.",
    endDate: "2026-12-31T18:30:00.000Z",
    totalVolume: 24820000,
    volumeChange24h: 620000,
    resolutionSource: "Google Play and Apple App Store India listings",
    outcomes: binary(0.14, 0.007, 24820000),
    isBinary: true,
    tags: ["esports", "pubg", "india"],
  },

  // ------------------------------------------------------------------ TECH
  {
    title: "Will UPI transactions cross 20 billion per month in 2026?",
    category: "tech",
    subcategory: "Indian Startups",
    description:
      "Resolves Yes if NPCI reports monthly UPI transaction volume above 20 billion for any month in 2026.",
    endDate: "2026-12-31T18:30:00.000Z",
    totalVolume: 148920000,
    volumeChange24h: 4820000,
    resolutionSource: "NPCI monthly UPI statistics",
    outcomes: binary(0.69, 0.028, 148920000),
    isBinary: true,
    tags: ["tech", "upi", "fintech", "india"],
  },
  {
    title: "Will Ola Electric launch an autonomous scooter in 2026?",
    category: "tech",
    subcategory: "EV",
    description:
      "Resolves Yes if Ola Electric begins commercial deliveries of a scooter marketed with autonomous riding features during 2026.",
    endDate: "2026-12-31T18:30:00.000Z",
    totalVolume: 42180000,
    volumeChange24h: -1240000,
    resolutionSource: "Ola Electric official product launch",
    outcomes: binary(0.21, -0.014, 42180000),
    isBinary: true,
    tags: ["tech", "ev", "ola", "india"],
  },
  {
    title: "Will Zomato acquire a fintech startup in 2026?",
    category: "tech",
    subcategory: "Indian Startups",
    description:
      "Resolves Yes if Eternal/Zomato announces a definitive agreement to acquire a fintech company during 2026.",
    endDate: "2026-12-31T18:30:00.000Z",
    totalVolume: 31240000,
    volumeChange24h: 842000,
    resolutionSource: "Company filings with Indian exchanges",
    outcomes: binary(0.27, 0.011, 31240000),
    isBinary: true,
    tags: ["tech", "startups", "zomato", "india"],
  },
  {
    title: "Will an Indian smartphone brand ship a foldable in 2026?",
    category: "tech",
    subcategory: "Smartphones",
    description:
      "Resolves Yes if an India-headquartered brand begins retail sales of a foldable smartphone during 2026.",
    endDate: "2026-12-31T18:30:00.000Z",
    totalVolume: 18420000,
    volumeChange24h: 420000,
    resolutionSource: "Official product availability",
    outcomes: binary(0.32, 0.016, 18420000),
    isBinary: true,
    tags: ["tech", "smartphones", "india"],
  },
  {
    title: "Will India's semiconductor fab begin commercial production before 2028?",
    category: "tech",
    subcategory: "Indian Startups",
    description:
      "Resolves Yes if any India-based semiconductor fabrication plant announces commercial-scale production before 1 January 2028.",
    endDate: "2028-01-01T00:00:00.000Z",
    totalVolume: 94210000,
    volumeChange24h: 3240000,
    resolutionSource: "MeitY and company announcements",
    outcomes: binary(0.46, 0.022, 94210000),
    isBinary: true,
    tags: ["tech", "semiconductors", "india"],
  },
  {
    title: "Will Apple manufacture more than 25% of iPhones in India by 2027?",
    category: "tech",
    subcategory: "Global Tech",
    description:
      "Resolves Yes if credible reporting confirms India accounts for more than 25% of global iPhone production by the end of 2027.",
    endDate: "2028-01-31T00:00:00.000Z",
    totalVolume: 68420000,
    volumeChange24h: 1840000,
    resolutionSource: "Two major outlets citing supply-chain data",
    outcomes: binary(0.53, 0.019, 68420000),
    isBinary: true,
    tags: ["tech", "global-tech", "apple", "india"],
  },

  // ------------------------------------------------------------ WORLD NEWS
  {
    title: "Will the Russia-Ukraine war end in 2026?",
    category: "world-news",
    subcategory: "Russia",
    description:
      "Resolves Yes if a formal ceasefire or peace agreement signed by both parties takes effect during 2026.",
    endDate: "2026-12-31T23:59:00.000Z",
    totalVolume: 214820000,
    volumeChange24h: 8420000,
    resolutionSource: "Official government announcements",
    outcomes: binary(0.37, 0.029, 214820000),
    isBinary: true,
    tags: ["world-news", "russia", "ukraine"],
  },
  {
    title: "Will China invade Taiwan before 2028?",
    category: "world-news",
    subcategory: "China",
    description:
      "Resolves Yes if Chinese military forces conduct a large-scale amphibious or airborne landing on Taiwan before 1 January 2028.",
    endDate: "2028-01-01T00:00:00.000Z",
    totalVolume: 184210000,
    volumeChange24h: -4820000,
    resolutionSource: "Consensus reporting from three major outlets",
    outcomes: binary(0.09, -0.006, 184210000),
    isBinary: true,
    tags: ["world-news", "china", "taiwan"],
  },
  {
    title: "Will an Indian-American be a major party nominee in the 2028 US election?",
    category: "world-news",
    subcategory: "US",
    description:
      "Resolves Yes if a candidate of Indian origin secures the Democratic or Republican presidential nomination for 2028.",
    endDate: "2028-09-01T23:59:00.000Z",
    totalVolume: 94820000,
    volumeChange24h: 2140000,
    resolutionSource: "Official party convention results",
    outcomes: binary(0.18, 0.012, 94820000),
    isBinary: true,
    tags: ["world-news", "us", "india-diaspora"],
  },
  {
    title: "Will India get a permanent UN Security Council seat before 2030?",
    category: "world-news",
    subcategory: "Global Election",
    description:
      "Resolves Yes if India is granted permanent membership of the UN Security Council before 1 January 2030.",
    endDate: "2030-01-01T00:00:00.000Z",
    totalVolume: 128420000,
    volumeChange24h: 3240000,
    resolutionSource: "United Nations official record",
    outcomes: binary(0.14, 0.008, 128420000),
    isBinary: true,
    tags: ["world-news", "un", "india"],
  },
  {
    title: "Will oil supply through the Strait of Hormuz be disrupted in 2026?",
    category: "world-news",
    subcategory: "Middle East",
    description:
      "Resolves Yes if commercial traffic through the Strait of Hormuz is suspended for more than 72 consecutive hours during 2026.",
    endDate: "2026-12-31T23:59:00.000Z",
    totalVolume: 68240000,
    volumeChange24h: 2840000,
    resolutionSource: "Consensus reporting and IMO advisories",
    outcomes: binary(0.16, 0.014, 68240000),
    isBinary: true,
    tags: ["world-news", "middle-east", "oil"],
  },
  {
    title: "Will the UK hold a general election before 2028?",
    category: "world-news",
    subcategory: "Europe",
    description:
      "Resolves Yes if a UK general election is held before 1 January 2028.",
    endDate: "2028-01-01T00:00:00.000Z",
    totalVolume: 42180000,
    volumeChange24h: 940000,
    resolutionSource: "UK Electoral Commission",
    outcomes: binary(0.31, 0.011, 42180000),
    isBinary: true,
    tags: ["world-news", "europe", "uk"],
  },

  // ------------------------------------------------------------------- WAR
  {
    title: "Will India finalise the Rafale-M naval fighter deal in 2026?",
    category: "war",
    subcategory: "India Defense",
    description:
      "Resolves Yes if the Cabinet Committee on Security approves and signs the Rafale-M procurement contract during 2026.",
    endDate: "2026-12-31T18:30:00.000Z",
    totalVolume: 84920000,
    volumeChange24h: 3240000,
    resolutionSource: "Ministry of Defence, Government of India",
    outcomes: binary(0.64, 0.026, 84920000),
    isBinary: true,
    tags: ["war", "india-defense", "procurement"],
  },
  {
    title: "Will India's defence budget exceed ₹7 lakh crore in FY27?",
    category: "war",
    subcategory: "India Defense",
    description:
      "Resolves Yes if the Union Budget allocates more than ₹7,00,000 crore to the Ministry of Defence for FY2026-27.",
    endDate: inDays(12),
    isLive: true,
    totalVolume: 68420000,
    volumeChange24h: 8420000,
    resolutionSource: "Union Budget expenditure documents",
    outcomes: binary(0.71, 0.034, 68420000),
    isBinary: true,
    tags: ["war", "india-defense", "budget", "live"],
  },
  {
    title: "Will a Russia-Ukraine ceasefire hold for 90 days in 2026?",
    category: "war",
    subcategory: "Russia-Ukraine",
    description:
      "Resolves Yes if a ceasefire between Russia and Ukraine remains in effect for 90 consecutive days during 2026.",
    endDate: "2026-12-31T23:59:00.000Z",
    totalVolume: 128420000,
    volumeChange24h: 4820000,
    resolutionSource: "Consensus reporting from three major outlets",
    outcomes: binary(0.28, 0.021, 128420000),
    isBinary: true,
    tags: ["war", "russia-ukraine", "ceasefire"],
  },
  {
    title: "Will a permanent Israel-Palestine settlement be signed before 2028?",
    category: "war",
    subcategory: "Israel-Palestine",
    description:
      "Resolves Yes if a comprehensive final-status agreement is signed by both parties before 1 January 2028.",
    endDate: "2028-01-01T00:00:00.000Z",
    totalVolume: 94210000,
    volumeChange24h: -2140000,
    resolutionSource: "Official government announcements",
    outcomes: binary(0.11, -0.007, 94210000),
    isBinary: true,
    tags: ["war", "israel-palestine", "diplomacy"],
  },
  {
    title: "Will China conduct a Taiwan Strait blockade exercise in 2026?",
    category: "war",
    subcategory: "China-Taiwan",
    description:
      "Resolves Yes if the PLA announces or conducts an exercise described as a blockade or quarantine of Taiwan during 2026.",
    endDate: "2026-12-31T23:59:00.000Z",
    totalVolume: 68240000,
    volumeChange24h: 1840000,
    resolutionSource: "PLA announcements and consensus reporting",
    outcomes: binary(0.39, 0.018, 68240000),
    isBinary: true,
    tags: ["war", "china-taiwan", "military"],
  },

  // -------------------------------------------------------------------- AI
  {
    title: "Will India launch a sovereign LLM in 2026?",
    category: "ai",
    subcategory: "Indian AI",
    description:
      "Resolves Yes if a government-backed Indian foundation model is publicly released under the IndiaAI Mission during 2026.",
    endDate: "2026-12-31T18:30:00.000Z",
    totalVolume: 148920000,
    volumeChange24h: 6240000,
    resolutionSource: "MeitY IndiaAI Mission announcement",
    outcomes: binary(0.58, 0.032, 148920000),
    isBinary: true,
    tags: ["ai", "indian-ai", "india"],
  },
  {
    title: "Will OpenAI release GPT-6 in 2026?",
    category: "ai",
    subcategory: "OpenAI",
    description:
      "Resolves Yes if a model branded GPT-6 is made publicly available during calendar year 2026.",
    endDate: "2026-12-31T23:59:00.000Z",
    totalVolume: 184210000,
    volumeChange24h: -4820000,
    resolutionSource: "OpenAI official announcement",
    outcomes: binary(0.43, -0.026, 184210000),
    isBinary: true,
    tags: ["ai", "openai", "models"],
  },
  {
    title: "Will Google Gemini lead Indian-language benchmarks in 2026?",
    category: "ai",
    subcategory: "Google Gemini",
    description:
      "Resolves Yes if a Gemini model ranks first on a recognised Indic-language evaluation leaderboard at any point in 2026.",
    endDate: "2026-12-31T23:59:00.000Z",
    totalVolume: 68420000,
    volumeChange24h: 2140000,
    resolutionSource: "Published Indic LLM leaderboard results",
    outcomes: binary(0.51, 0.024, 68420000),
    isBinary: true,
    tags: ["ai", "gemini", "indic-languages"],
  },
  {
    title: "Will India notify AI regulation rules before 2028?",
    category: "ai",
    subcategory: "AI Regulation",
    description:
      "Resolves Yes if binding AI-specific rules are notified in the Gazette of India before 1 January 2028.",
    endDate: "2028-01-01T00:00:00.000Z",
    totalVolume: 94820000,
    volumeChange24h: 3240000,
    resolutionSource: "Gazette of India notification",
    outcomes: binary(0.62, 0.018, 94820000),
    isBinary: true,
    tags: ["ai", "ai-regulation", "india"],
  },
  {
    title: "Which lab leads the text arena leaderboard on 31 Dec 2026?",
    category: "ai",
    subcategory: "AI",
    description:
      "Resolves to the organisation holding the top position on the public text arena leaderboard on 31 December 2026.",
    endDate: inDays(94),
    isLive: true,
    totalVolume: 128420000,
    volumeChange24h: 9840000,
    resolutionSource: "Public LLM arena leaderboard",
    outcomes: multi(
      [
        ["Google DeepMind", 0.34, 0.028],
        ["OpenAI", 0.31, -0.021],
        ["Anthropic", 0.18, 0.011],
        ["xAI", 0.09, -0.006],
        ["Meta", 0.08, -0.004],
      ],
      128420000
    ),
    isBinary: false,
    tags: ["ai", "models", "leaderboard", "live"],
  },
// ---------------------------------------- PHASE B: fill previously-empty chips
  {
    title: "India to win the next T20I series against South Africa?",
    category: "cricket",
    subcategory: "T20",
    description:
      "Resolves Yes if India win the bilateral T20I series outright. A drawn series resolves No.",
    endDate: "2027-01-24T13:30:00.000Z",
    totalVolume: 74210000,
    volumeChange24h: 2840000,
    resolutionSource: "BCCI official series result",
    outcomes: binary(0.61, 0.024, 74210000),
    isBinary: true,
    tags: ["cricket", "t20", "india"],
  },
  {
    title: "Most T20I runs by an Indian batter in 2027?",
    category: "cricket",
    subcategory: "T20",
    description:
      "Resolves to the India batter with the most T20I runs across the 2027 calendar year.",
    endDate: "2028-01-01T00:00:00.000Z",
    totalVolume: 42180000,
    volumeChange24h: 1240000,
    resolutionSource: "ICC official statistics",
    outcomes: multi(
      [
        ["Abhishek Sharma", 0.29, 0.021],
        ["Shubman Gill", 0.26, -0.011],
        ["Tilak Varma", 0.19, 0.008],
        ["Suryakumar Yadav", 0.16, -0.006],
      ],
      42180000
    ),
    isBinary: false,
    tags: ["cricket", "t20", "india"],
  },
  {
    title: "Will BJP cross 300 seats in the next Lok Sabha election?",
    category: "politics",
    subcategory: "BJP",
    description:
      "Resolves Yes if the BJP wins 300 or more seats on its own in the next Lok Sabha general election.",
    endDate: "2029-06-01T18:00:00.000Z",
    totalVolume: 184920000,
    volumeChange24h: 4820000,
    resolutionSource: "Election Commission of India",
    outcomes: binary(0.41, -0.018, 184920000),
    isBinary: true,
    tags: ["politics", "bjp", "lok-sabha"],
  },
  {
    title: "BJP to retain Uttar Pradesh in the 2027 Assembly election?",
    category: "politics",
    subcategory: "BJP",
    description:
      "Resolves Yes if the BJP or a BJP-led alliance secures a majority in the 2027 Uttar Pradesh Legislative Assembly.",
    endDate: "2027-03-15T18:00:00.000Z",
    totalVolume: 214180000,
    volumeChange24h: 7240000,
    resolutionSource: "Election Commission of India",
    outcomes: binary(0.58, 0.026, 214180000),
    isBinary: true,
    tags: ["politics", "bjp", "uttar-pradesh"],
  },
  {
    title: "India to become the world's third-largest economy by 2028?",
    category: "economy",
    subcategory: "India",
    description:
      "Resolves Yes if IMF World Economic Outlook data ranks India third by nominal GDP before 1 January 2028.",
    endDate: "2028-01-01T00:00:00.000Z",
    totalVolume: 148210000,
    volumeChange24h: 3840000,
    resolutionSource: "IMF World Economic Outlook",
    outcomes: binary(0.66, 0.019, 148210000),
    isBinary: true,
    tags: ["economy", "india", "gdp"],
  },
  {
    title: "India's forex reserves above $750B during 2027?",
    category: "economy",
    subcategory: "India",
    description:
      "Resolves Yes if any RBI weekly statistical supplement in 2027 reports foreign exchange reserves above $750 billion.",
    endDate: "2028-01-01T00:00:00.000Z",
    totalVolume: 68420000,
    volumeChange24h: 1840000,
    resolutionSource: "RBI Weekly Statistical Supplement",
    outcomes: binary(0.52, 0.014, 68420000),
    isBinary: true,
    tags: ["economy", "india", "rbi"],
  },
  {
    title: "India to win the FIH Pro League 2027?",
    category: "sports",
    subcategory: "Hockey",
    description:
      "Resolves Yes if the India men's hockey team finishes first in the 2026-27 FIH Pro League standings.",
    endDate: "2027-06-30T18:00:00.000Z",
    totalVolume: 42840000,
    volumeChange24h: 1240000,
    resolutionSource: "FIH official standings",
    outcomes: binary(0.34, 0.021, 42840000),
    isBinary: true,
    tags: ["sports", "hockey", "india"],
  },
  {
    title: "Hockey India League 2027 Winner",
    category: "sports",
    subcategory: "Hockey",
    description: "Resolves to the franchise that wins the Hockey India League 2027 final.",
    endDate: "2027-02-14T15:00:00.000Z",
    totalVolume: 24180000,
    volumeChange24h: 842000,
    resolutionSource: "Hockey India official result",
    outcomes: multi(
      [
        ["Soorma Hockey Club", 0.27, 0.016],
        ["Delhi SG Pipers", 0.24, -0.009],
        ["Shrachi Rarh Bengal Tigers", 0.2, 0.007],
        ["Team Gonasika", 0.17, -0.005],
      ],
      24180000
    ),
    isBinary: false,
    tags: ["sports", "hockey", "india"],
  },
  {
    title: "Will an Indian AI startup raise a $1B round before 2028?",
    category: "tech",
    subcategory: "AI",
    description:
      "Resolves Yes if an India-headquartered AI company announces a single primary funding round of $1 billion or more before 1 January 2028.",
    endDate: "2028-01-01T00:00:00.000Z",
    totalVolume: 94820000,
    volumeChange24h: 3240000,
    resolutionSource: "Company announcement corroborated by two major outlets",
    outcomes: binary(0.37, 0.022, 94820000),
    isBinary: true,
    tags: ["tech", "ai", "startups", "india"],
  },
  {
    title: "India's AI market to cross $20B by 2027?",
    category: "tech",
    subcategory: "AI",
    description:
      "Resolves Yes if a NASSCOM or equivalent industry report values India's AI market above $20 billion for 2027.",
    endDate: "2028-03-31T18:30:00.000Z",
    totalVolume: 54210000,
    volumeChange24h: 1420000,
    resolutionSource: "NASSCOM industry report",
    outcomes: binary(0.48, 0.011, 54210000),
    isBinary: true,
    tags: ["tech", "ai", "india"],
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
  currency: "INR",
  region: seed.region ?? "India",
  tags: seed.tags,
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
  const names = ["arjun_m", "priya.s", "rohit0791", "bharat_trades", "sneha_k", "kabir.v"];
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
