import { FINANCE_FN_URL } from "./api";
import { supabase } from "./supabase";

export interface Quote {
  symbol: string;
  shortName: string | null;
  longName: string | null;
  exchangeName: string | null;
  currency: string | null;
  regularMarketPrice: number | null;
  regularMarketChange: number | null;
  regularMarketChangePercent: number | null;
  regularMarketDayHigh: number | null;
  regularMarketDayLow: number | null;
  regularMarketVolume: number | null;
  regularMarketOpen: number | null;
  regularMarketPreviousClose: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  marketState: string | null;
  instrumentType: string | null;
}

export interface HistoricalPoint {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}

export interface HistoricalResult {
  symbol: string;
  range: string;
  interval: string;
  currency: string | null;
  points: HistoricalPoint[];
}

export interface SearchResultRow {
  symbol: string;
  shortname: string | null;
  longname: string | null;
  exchange: string | null;
  type: string | null;
  sector: string | null;
  industry: string | null;
}

export interface SummaryResult {
  symbol: string;
  modules: {
    assetProfile?: {
      industry?: string;
      sector?: string;
      website?: string;
      longBusinessSummary?: string;
      country?: string;
      fullTimeEmployees?: number;
      city?: string;
      address1?: string;
      state?: string;
      zip?: string;
      phone?: string;
      companyOfficers?: Array<{
        name?: string;
        title?: string;
        age?: number;
        totalPay?: number;
      }>;
    };
    summaryDetail?: {
      marketCap?: number;
      trailingPE?: number;
      forwardPE?: number;
      dividendYield?: number;
      dividendRate?: number;
      payoutRatio?: number;
      exDividendDate?: number;
      beta?: number;
      averageVolume?: number;
      averageVolume10days?: number;
      volume?: number;
      fiftyDayAverage?: number;
      twoHundredDayAverage?: number;
    };
    financialData?: {
      totalRevenue?: number;
      revenueGrowth?: number;
      earningsGrowth?: number;
      profitMargins?: number;
      grossMargins?: number;
      operatingMargins?: number;
      ebitdaMargins?: number;
      returnOnEquity?: number;
      returnOnAssets?: number;
      debtToEquity?: number;
      currentRatio?: number;
      quickRatio?: number;
      totalCash?: number;
      totalDebt?: number;
      operatingCashflow?: number;
      freeCashflow?: number;
      currentPrice?: number;
      targetMeanPrice?: number;
      targetHighPrice?: number;
      targetLowPrice?: number;
      numberOfAnalystOpinions?: number;
      recommendationKey?: string;
      recommendationMean?: number;
    };
    defaultKeyStatistics?: {
      trailingPE?: number;
      forwardPE?: number;
      pegRatio?: number;
      priceToBook?: number;
      enterpriseValue?: number;
      enterpriseToRevenue?: number;
      enterpriseToEbitda?: number;
      sharesOutstanding?: number;
      floatShares?: number;
      sharesShort?: number;
      shortRatio?: number;
      bookValue?: number;
      heldPercentInsiders?: number;
      heldPercentInstitutions?: number;
      "52WeekChange"?: number;
    };
    calendarEvents?: {
      earnings?: {
        earningsDate?: number[];
        earningsAverage?: number;
        earningsLow?: number;
        earningsHigh?: number;
        revenueAverage?: number;
        revenueLow?: number;
        revenueHigh?: number;
      };
      exDividendDate?: number;
      dividendDate?: number;
    };
    earnings?: {
      earningsChart?: {
        quarterly?: Array<{ date?: string; actual?: number; estimate?: number }>;
        currentQuarterEstimate?: number;
        currentQuarterEstimateDate?: string;
        currentQuarterEstimateYear?: number;
      };
      financialsChart?: {
        yearly?: Array<{ date?: number; revenue?: number; earnings?: number }>;
        quarterly?: Array<{ date?: string; revenue?: number; earnings?: number }>;
      };
    };
    recommendationTrend?: {
      trend?: Array<{
        period?: string;
        strongBuy?: number;
        buy?: number;
        hold?: number;
        sell?: number;
        strongSell?: number;
      }>;
    };
    upgradeDowngradeHistory?: {
      history?: Array<{
        epochGradeDate?: number;
        firm?: string;
        toGrade?: string;
        fromGrade?: string;
        action?: string;
      }>;
    };
    majorHoldersBreakdown?: {
      insidersPercentHeld?: number;
      institutionsPercentHeld?: number;
      institutionsFloatPercentHeld?: number;
      institutionsCount?: number;
    };
    insiderHolders?: {
      holders?: Array<{
        name?: string;
        relation?: string;
        latestTransDate?: number;
        positionDirect?: number;
        positionDirectDate?: number;
      }>;
    };
    insiderTransactions?: {
      transactions?: Array<{
        filerName?: string;
        filerRelation?: string;
        startDate?: number;
        transactionText?: string;
        value?: number;
        shares?: number;
      }>;
    };
    secFilings?: {
      filings?: Array<{
        date?: string;
        epochDate?: number;
        type?: string;
        title?: string;
        edgarUrl?: string;
      }>;
    };
  };
}

export interface NewsItem {
  uuid: string | null;
  title: string | null;
  publisher: string | null;
  link: string | null;
  thumbnail: string | null;
  publishedAt: string | null;
  relatedTickers: string[];
  type: string | null;
}

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const auth = data.session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
  return {
    Authorization: `Bearer ${auth}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
  };
}

async function call<T>(params: Record<string, string>): Promise<T> {
  if (!FINANCE_FN_URL) {
    throw new Error("Finance endpoint not configured.");
  }
  const headers = await getAuthHeaders();
  const url = `${FINANCE_FN_URL}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export function getQuote(symbol: string): Promise<Quote> {
  return call<Quote>({ action: "quote", symbol });
}

export function getHistorical(
  symbol: string,
  range = "1y",
  interval = "1d",
): Promise<HistoricalResult> {
  return call<HistoricalResult>({ action: "historical", symbol, range, interval });
}

export function searchSymbols(q: string): Promise<{ quotes: SearchResultRow[] }> {
  return call<{ quotes: SearchResultRow[] }>({ action: "search", q });
}

export function getSummary(
  symbol: string,
  modules = "assetProfile,summaryDetail,financialData,defaultKeyStatistics,calendarEvents,earnings,recommendationTrend,upgradeDowngradeHistory,majorHoldersBreakdown,insiderHolders,insiderTransactions,secFilings",
): Promise<SummaryResult> {
  return call<SummaryResult>({ action: "summary", symbol, modules });
}

export function getNews(symbol: string): Promise<{ symbol: string; news: NewsItem[] }> {
  return call<{ symbol: string; news: NewsItem[] }>({ action: "news", symbol });
}

export interface AiAboutResult {
  symbol: string;
  source: string;
  about: {
    name?: string | null;
    ticker?: string | null;
    exchange?: string | null;
    sector?: string | null;
    industry?: string | null;
    country?: string | null;
    headquarters?: string | null;
    founded?: number | null;
    employees?: number | null;
    ceo?: string | null;
    website?: string | null;
    description?: string | null;
    businessSegments?: string[];
    products?: string[];
    majorMarkets?: string[];
    keyMetrics?: { label: string; value: string }[];
    competitors?: string[];
    recentNews?: { headline: string; source?: string; date?: string; summary?: string }[];
    risks?: string[];
    opportunities?: string[];
  };
}

export function getAiAbout(symbol: string, name?: string): Promise<AiAboutResult> {
  const params: Record<string, string> = { action: "ai-about", symbol };
  if (name) params.name = name;
  return call<AiAboutResult>(params);
}

export function formatCurrency(value: number | null | undefined, currency: string | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const code = currency ?? "USD";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: value >= 1000 ? 0 : 2,
    }).format(value);
  } catch {
    return value.toLocaleString();
  }
}

export function formatNumber(value: number | null | undefined, fractionDigits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  });
}

export function formatLargeNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e7) return `${(value / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${(value / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(0);
}

export function formatPercent(value: number | null | undefined, fractionDigits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(fractionDigits)}%`;
}
