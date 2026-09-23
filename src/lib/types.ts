export type Category =
  | "sports"
  | "politics"
  | "crypto"
  | "esports"
  | "finance"
  | "tech"
  | "economy"
  | "culture";

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
}

export interface CategoryMeta {
  slug: Category | "live";
  label: string;
  href: string;
  subFilters: string[];
  blurb: string;
}

export const CATEGORIES: CategoryMeta[] = [
  {
    slug: "live",
    label: "Live",
    href: "/markets/live",
    subFilters: ["All Live", "Sports", "Crypto", "Esports", "Finance"],
    blurb: "Markets trading right now, updating in real time.",
  },
  {
    slug: "sports",
    label: "Sports",
    href: "/markets/sports",
    subFilters: [
      "All Sports",
      "Live",
      "Soccer",
      "F1",
      "Basketball",
      "Football",
      "Hockey",
      "Baseball",
      "MLB",
      "NHL",
      "NFL",
      "EPL",
      "LaLiga",
      "UCL",
    ],
    blurb: "Trade the outcome of every game, series and season.",
  },
  {
    slug: "politics",
    label: "Politics",
    href: "/markets/politics",
    subFilters: ["All Politics", "Trump", "Global", "Elections", "Legislation"],
    blurb: "Elections, legislation and geopolitics.",
  },
  {
    slug: "crypto",
    label: "Crypto",
    href: "/markets/crypto",
    subFilters: ["All Crypto", "Live", "BTC Price", "ETH Price", "BNB", "Altcoins", "ETFs"],
    blurb: "Price levels, ETFs and protocol milestones.",
  },
  {
    slug: "esports",
    label: "Esports",
    href: "/markets/esports",
    subFilters: ["All Esports", "Live", "CS2", "League of Legends", "Dota 2", "Valorant"],
    blurb: "Majors, splits and championship brackets.",
  },
  {
    slug: "finance",
    label: "Finance",
    href: "/markets/finance",
    subFilters: ["All Finance", "Stocks", "Commodities", "IPO", "Market Cap", "Pre-IPO"],
    blurb: "Equities, commodities and IPO pricing.",
  },
  {
    slug: "tech",
    label: "Tech",
    href: "/markets/tech",
    subFilters: ["All Tech", "AI", "Acquisitions", "Space", "Launches"],
    blurb: "AI model releases, M&A and launch windows.",
  },
  {
    slug: "economy",
    label: "Economy",
    href: "/markets/economy",
    subFilters: ["All Economy", "Fed", "Inflation", "GDP", "Jobs"],
    blurb: "Rates, inflation prints and growth data.",
  },
  {
    slug: "culture",
    label: "Culture",
    href: "/markets/culture",
    subFilters: ["All Culture", "Awards", "Music", "Weather", "Mentions"],
    blurb: "Awards, weather, and everything in between.",
  },
];

export const SORT_OPTIONS = ["Starting Soon", "All", "Popular"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];
