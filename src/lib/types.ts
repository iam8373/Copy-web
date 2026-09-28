export type Category =
  | "cricket"
  | "politics"
  | "entertainment"
  | "economy"
  | "finance"
  | "sports"
  | "esports"
  | "tech"
  | "world-news"
  | "war"
  | "ai";

export type NavSlug = Category | "live";

export interface Outcome {
  id: string;
  label: string;
  price: number;
  change24h: number;
  volume: number;
}

export interface Market {
  id: string;
  slug: string;
  title: string;
  category: Category;
  subcategory: string;
  description: string;
  imageUrl?: string;
  endDate: string;
  isLive: boolean;
  totalVolume: number;
  volumeChange24h: number;
  outcomes: Outcome[];
  resolutionSource: string;
  isBinary: boolean;
  /**
   * Optional localised copy (Phase E). Market text stays English for now; the
   * UI can prefer `title_hi` etc. once translated titles exist.
   */
  title_hi?: string;
  description_hi?: string;
  /** Indian-first metadata */
  currency: "INR";
  region: string;
  tags: string[];
}

export interface SubFilter {
  label: string;
  isHighlighted?: boolean;
}

export interface CategoryMeta {
  slug: NavSlug;
  label: string;
  href: string;
  subFilters: SubFilter[];
  blurb: string;
}

/** Helper so category definitions stay readable. */
function chips(labels: string[], highlighted: string[] = []): SubFilter[] {
  return labels.map((label) => ({
    label,
    isHighlighted: highlighted.includes(label),
  }));
}

export const CATEGORIES: CategoryMeta[] = [
  {
    slug: "live",
    label: "Live",
    href: "/markets/live",
    subFilters: chips(["Live", "Cricket", "Politics", "Finance", "Esports", "Entertainment"]),
    blurb: "Markets trading right now, updating in real time.",
  },
  {
    slug: "cricket",
    label: "Cricket",
    href: "/markets/cricket",
    subFilters: chips(
      [
        "Cricket",
        "IPL",
        "World Cup",
        "T20",
        "ODI",
        "Test",
        "Ranji Trophy",
        "Women's Cricket",
        "BBL",
        "PSL",
      ],
      ["IPL", "World Cup"]
    ),
    blurb: "IPL, World Cups and every format — India's biggest market.",
  },
  {
    slug: "politics",
    label: "Politics",
    href: "/markets/politics",
    subFilters: chips(
      [
        "Politics",
        "Lok Sabha",
        "State Elections",
        "BJP",
        "Congress",
        "AAP",
        "Parliament",
        "India News",
        "Global Election",
      ],
      ["Lok Sabha", "State Elections"]
    ),
    blurb: "Lok Sabha, state assemblies and the numbers behind them.",
  },
  {
    slug: "entertainment",
    label: "Entertainment",
    href: "/markets/entertainment",
    subFilters: chips(
      [
        "Entertainment",
        "Bollywood",
        "Bigg Boss",
        "Roadies",
        "YouTube",
        "Movies",
        "Celebrity",
        "OTT",
      ],
      ["Bigg Boss", "Bollywood"]
    ),
    blurb: "Bollywood box office, reality TV and creator culture.",
  },
  {
    slug: "economy",
    label: "Economy",
    href: "/markets/economy",
    subFilters: chips(
      ["Economy", "India", "RBI", "Jobs", "Tax", "Budget", "GDP", "Inflation", "World"],
      ["RBI", "Budget"]
    ),
    blurb: "RBI policy, the Union Budget and India's growth data.",
  },
  {
    slug: "finance",
    label: "Finance",
    href: "/markets/finance",
    subFilters: chips([
      "Finance",
      "Stocks",
      "Commodities",
      "IPO",
      "Market Cap",
      "Pre-IPO",
      "Gold",
      "Silver",
      "Nifty",
      "Sensex",
      "Crypto India",
    ]),
    blurb: "Nifty, Sensex, commodities and the IPO pipeline.",
  },
  {
    slug: "sports",
    label: "Sports",
    href: "/markets/sports",
    subFilters: chips(
      ["Sports", "Football", "Hockey", "Tennis", "F1", "Asian Games", "Kabaddi", "Badminton"],
      ["Football", "Hockey"]
    ),
    blurb: "Everything outside cricket — ISL to the Asian Games.",
  },
  {
    slug: "esports",
    label: "Esports",
    href: "/markets/esports",
    subFilters: chips(["eSports", "BGMI", "Free Fire", "GTA", "CS2", "Valorant", "PUBG"]),
    blurb: "BGMI, Free Fire and India's competitive gaming circuit.",
  },
  {
    slug: "tech",
    label: "Tech",
    href: "/markets/tech",
    subFilters: chips(["Tech", "Indian Startups", "AI", "Global Tech", "Smartphones", "EV"]),
    blurb: "Indian startups, launches and the global tech cycle.",
  },
  {
    slug: "world-news",
    label: "World News",
    href: "/markets/world-news",
    subFilters: chips([
      "World News",
      "US",
      "China",
      "Russia",
      "Middle East",
      "Europe",
      "Global Election",
    ]),
    blurb: "Global events that move Indian markets.",
  },
  {
    slug: "war",
    label: "War",
    href: "/markets/war",
    subFilters: chips([
      "War",
      "India Defense",
      "Russia-Ukraine",
      "Israel-Palestine",
      "China-Taiwan",
    ]),
    blurb: "Defence procurement and active geopolitical conflicts.",
  },
  {
    slug: "ai",
    label: "AI",
    href: "/markets/ai",
    subFilters: chips(["AI", "OpenAI", "Google Gemini", "Indian AI", "AI Regulation"]),
    blurb: "Frontier models, Indian AI and the rules coming for both.",
  },
];

export const SORT_OPTIONS = ["Starting Soon", "All", "Popular"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];
