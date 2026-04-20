import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode, type WheelEvent } from "react";
import {
  Activity,
  BarChart3,
  Building2,
  Globe2,
  Newspaper,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { getFinanceCompanies, getFinanceCompanyIntel, getFinanceProviders } from "../api/api";
import type {
  FinanceCandle,
  FinanceCompanyIntelResponse,
  FinanceCompanyItem,
  FinanceNewsItem,
  FinanceProvidersResponse,
} from "../types/api";

const AUTO_REFRESH_MS = 30_000;
const FETCH_CANDLE_POINTS = 200;
const GRAPH_WIDTH = 720;
const GRAPH_HEIGHT = 220;

const GRAPH_RANGE_OPTIONS = [
  { label: "2W", points: 14 },
  { label: "1M", points: 30 },
  { label: "3M", points: 90 },
  { label: "6M", points: 180 },
  { label: "Max", points: 200 },
] as const;

type ChartPoint = {
  x: number;
  y: number;
  yOpen: number;
  yHigh: number;
  yLow: number;
  yClose: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type ReturnPoint = {
  date: string;
  value: number;
};

type NovaPulse = {
  score: number;
  confidence: number;
  label: "bullish" | "neutral" | "bearish";
  regime: "trend" | "range" | "high-volatility";
  momentumPct: number;
  sentimentBias: number;
  volumeRatio: number;
  divergence: boolean;
  divergenceReason: string;
  drivers: string[];
};

type NewsRadarCluster = {
  theme: string;
  count: number;
  avgSentiment: number;
  stance: "bullish" | "neutral" | "bearish";
  topHeadline: string;
  topSource: string;
};

type ChartOverlays = {
  supportPrice: number | null;
  resistancePrice: number | null;
  supportY: number | null;
  resistanceY: number | null;
  trendStartY: number | null;
  trendEndY: number | null;
  upperStartY: number | null;
  upperEndY: number | null;
  lowerStartY: number | null;
  lowerEndY: number | null;
};

const DEFAULT_PROVIDERS: FinanceProvidersResponse = {
  alpha_vantage_configured: false,
  marketaux_configured: false,
  finnhub_configured: false,
  fmp_configured: false,
  sec_enabled: true,
  tradestie_enabled: true,
};

const toNum = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const avg = (values: number[]): number => {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const stddev = (values: number[]): number => {
  if (values.length < 2) {
    return 0;
  }

  const center = avg(values);
  const variance = avg(values.map((value) => (value - center) ** 2));
  return Math.sqrt(Math.max(variance, 0));
};

const percentile = (values: number[], p: number): number => {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const rank = clamp(p, 0, 1) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  const weight = rank - low;

  if (low === high) {
    return sorted[low];
  }

  return sorted[low] * (1 - weight) + sorted[high] * weight;
};

const stanceFromSentiment = (score: number): "bullish" | "neutral" | "bearish" => {
  if (score > 0.18) {
    return "bullish";
  }
  if (score < -0.18) {
    return "bearish";
  }
  return "neutral";
};

const fmtNum = (value: unknown, digits = 2): string => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return "-";
  }
  return parsed.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const fmtInt = (value: unknown): string => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return "-";
  }
  return Math.round(parsed).toLocaleString();
};

const fmtMoneyCompact = (value: unknown): string => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "-";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(parsed);
};

const formatDate = (raw?: string): string => {
  if (!raw) {
    return "-";
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  return date.toLocaleString();
};

const chartSeriesFromCandles = (candles: FinanceCandle[], width: number, height: number): ChartPoint[] => {
  if (!candles.length) {
    return [];
  }

  const normalized = candles
    .map((row) => ({
      date: row.date,
      open: toNum(row.open),
      high: toNum(row.high),
      low: toNum(row.low),
      close: toNum(row.close),
      volume: Math.max(0, toNum(row.volume)),
    }))
    .filter((row) => row.date && Number.isFinite(row.close) && row.close > 0);

  if (!normalized.length) {
    return [];
  }

  const lows = normalized.map((row) => (row.low > 0 ? row.low : row.close));
  const highs = normalized.map((row) => (row.high > 0 ? row.high : row.close));
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const span = Math.max(max - min, 1e-9);
  const toY = (value: number) => height - ((value - min) / span) * height;

  return normalized.map((row, index) => {
    const open = row.open > 0 ? row.open : row.close;
    const high = row.high > 0 ? row.high : Math.max(open, row.close);
    const low = row.low > 0 ? row.low : Math.min(open, row.close);
    const x = (index / Math.max(normalized.length - 1, 1)) * width;
    const yOpen = toY(open);
    const yHigh = toY(high);
    const yLow = toY(low);
    const yClose = toY(row.close);

    return {
      ...row,
      open,
      high,
      low,
      x,
      y: yClose,
      yOpen,
      yHigh,
      yLow,
      yClose,
    };
  });
};

const linePointsFromSeries = (series: ChartPoint[]): string => {
  if (!series.length) {
    return "";
  }

  return series
    .map((point) => {
      return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
    })
    .join(" ");
};

const areaPathFromSeries = (series: ChartPoint[], height: number): string => {
  if (!series.length) {
    return "";
  }

  const first = series[0];
  const last = series[series.length - 1];
  const line = series
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(" ");

  return `${line} L ${last.x.toFixed(2)} ${height.toFixed(2)} L ${first.x.toFixed(2)} ${height.toFixed(2)} Z`;
};

const nearestPointIndex = (event: MouseEvent<SVGSVGElement>, totalPoints: number): number => {
  const rect = event.currentTarget.getBoundingClientRect();
  if (rect.width <= 0 || totalPoints <= 1) {
    return 0;
  }

  const rawX = event.clientX - rect.left;
  const clampedX = Math.max(0, Math.min(rawX, rect.width));
  const ratio = clampedX / rect.width;
  return Math.max(0, Math.min(totalPoints - 1, Math.round(ratio * (totalPoints - 1))));
};

const fmtMoney = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "-";
  }

  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtPercent = (value: number, digits = 2): string => {
  if (!Number.isFinite(value)) {
    return "-";
  }

  return `${value >= 0 ? "+" : ""}${value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
};

const fmtLabel = (value: string): string => {
  return value
    .split("-")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
};

const candleBodyWidth = (points: number): number => {
  if (points <= 0) {
    return 4;
  }

  return Math.max(2, Math.min(9, GRAPH_WIDTH / (points * 2.6)));
};

const dailyReturnsFromCandles = (candles: FinanceCandle[]): ReturnPoint[] => {
  if (candles.length < 2) {
    return [];
  }

  const out: ReturnPoint[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    const prevClose = toNum(candles[index - 1].close);
    const close = toNum(candles[index].close);
    if (!Number.isFinite(prevClose) || prevClose <= 0 || !Number.isFinite(close) || close <= 0) {
      continue;
    }

    out.push({
      date: candles[index].date,
      value: ((close - prevClose) / prevClose) * 100,
    });
  }

  return out;
};

const buildNewsRadar = (items: FinanceNewsItem[]): NewsRadarCluster[] => {
  const themes: Array<{ name: string; keywords: string[] }> = [
    { name: "earnings", keywords: ["earnings", "eps", "guidance", "quarter", "revenue"] },
    { name: "ai", keywords: ["ai", "artificial intelligence", "model", "chip"] },
    { name: "macro", keywords: ["inflation", "fed", "rates", "bond", "economy"] },
    { name: "regulation", keywords: ["regulation", "antitrust", "law", "lawsuit", "fine"] },
    { name: "deal", keywords: ["acquire", "acquisition", "merger", "partnership", "deal"] },
    { name: "product", keywords: ["launch", "product", "upgrade", "release"] },
  ];

  const positiveWords = ["beat", "upgrade", "surge", "growth", "record", "bullish"];
  const negativeWords = ["miss", "downgrade", "drop", "decline", "bearish", "weak"];

  const radarMap = new Map<
    string,
    {
      count: number;
      sentimentSum: number;
      sentimentN: number;
      topHeadline: string;
      topSource: string;
      bullishHint: number;
      bearishHint: number;
    }
  >();

  for (const item of items) {
    const title = (item.title || "").trim();
    if (!title) {
      continue;
    }

    const lowered = title.toLowerCase();
    let theme = "general";
    for (const candidate of themes) {
      if (candidate.keywords.some((keyword) => lowered.includes(keyword))) {
        theme = candidate.name;
        break;
      }
    }

    const current = radarMap.get(theme) || {
      count: 0,
      sentimentSum: 0,
      sentimentN: 0,
      topHeadline: title,
      topSource: item.source || "Unknown",
      bullishHint: 0,
      bearishHint: 0,
    };

    const sentimentScore = toNum(item.sentiment_score);
    if (Number.isFinite(sentimentScore) && sentimentScore !== 0) {
      current.sentimentSum += sentimentScore;
      current.sentimentN += 1;
    }

    if (positiveWords.some((word) => lowered.includes(word))) {
      current.bullishHint += 1;
    }
    if (negativeWords.some((word) => lowered.includes(word))) {
      current.bearishHint += 1;
    }

    current.count += 1;
    radarMap.set(theme, current);
  }

  return Array.from(radarMap.entries())
    .map(([theme, cluster]) => {
      const avgSentiment = cluster.sentimentN > 0 ? cluster.sentimentSum / cluster.sentimentN : 0;
      let stance = stanceFromSentiment(avgSentiment);

      if (cluster.sentimentN === 0) {
        if (cluster.bullishHint > cluster.bearishHint + 1) {
          stance = "bullish";
        } else if (cluster.bearishHint > cluster.bullishHint + 1) {
          stance = "bearish";
        } else {
          stance = "neutral";
        }
      }

      return {
        theme,
        count: cluster.count,
        avgSentiment,
        stance,
        topHeadline: cluster.topHeadline,
        topSource: cluster.topSource,
      };
    })
    .sort((a, b) => {
      const byCount = b.count - a.count;
      if (byCount !== 0) {
        return byCount;
      }
      return Math.abs(b.avgSentiment) - Math.abs(a.avgSentiment);
    })
    .slice(0, 5);
};

const computeNovaPulse = (
  series: ChartPoint[],
  returnsSeries: ReturnPoint[],
  quoteChange: number,
  newsItems: FinanceNewsItem[],
): NovaPulse => {
  if (series.length < 2) {
    return {
      score: 50,
      confidence: 0.32,
      label: "neutral",
      regime: "range",
      momentumPct: 0,
      sentimentBias: 0,
      volumeRatio: 1,
      divergence: false,
      divergenceReason: "Not enough candles to compute pulse.",
      drivers: ["Load more historical candles for stronger context."],
    };
  }

  const first = series[0];
  const last = series[series.length - 1];
  const momentumPct = first.close > 0 ? ((last.close - first.close) / first.close) * 100 : 0;
  const momentumScore = clamp((momentumPct + 8) / 16, 0, 1);

  const volumes = series.map((row) => row.volume).filter((value) => value > 0);
  const averageVolume = avg(volumes);
  const volumeRatio = averageVolume > 0 ? last.volume / averageVolume : 1;
  const volumeScore = clamp(volumeRatio / 2.2, 0, 1);

  const sentimentScores = newsItems
    .map((item) => toNum(item.sentiment_score))
    .filter((value) => Number.isFinite(value) && Math.abs(value) > 0);
  const sentimentBias = sentimentScores.length ? avg(sentimentScores) : 0;
  const sentimentScore = clamp((sentimentBias + 1) / 2, 0, 1);

  const volatility = stddev(returnsSeries.map((row) => row.value));
  const volatilityPenalty = clamp(volatility / 4.2, 0, 1);

  const quoteMomentumBlend = clamp((quoteChange + momentumPct) / 2, -14, 14);
  const quoteScore = clamp((quoteMomentumBlend + 14) / 28, 0, 1);

  const base = 0.36 * momentumScore + 0.24 * sentimentScore + 0.17 * volumeScore + 0.15 * quoteScore + 0.08 * (1 - volatilityPenalty);
  const score = Math.round(clamp(base, 0, 1) * 100);

  const label: "bullish" | "neutral" | "bearish" = score >= 63 ? "bullish" : score <= 37 ? "bearish" : "neutral";

  const absMomentum = Math.abs(momentumPct);
  const regime: "trend" | "range" | "high-volatility" =
    volatility > 2.6 ? "high-volatility" : absMomentum >= 3 ? "trend" : "range";

  const coverage = clamp((series.length / 120 + Math.min(newsItems.length, 12) / 12) / 2, 0, 1);
  const consistency = 1 - Math.min(1, stddev(returnsSeries.map((row) => row.value)) / 6.5);
  const confidence = clamp(0.38 + 0.34 * coverage + 0.28 * consistency, 0.25, 0.95);

  const divergence = Math.abs(momentumPct) >= 1.8 && Math.abs(sentimentBias) >= 0.22 && Math.sign(momentumPct) !== Math.sign(sentimentBias);
  const divergenceReason = divergence
    ? `Price momentum (${fmtPercent(momentumPct)}) and news sentiment (${fmtPercent(sentimentBias * 100)}) are moving in opposite directions.`
    : "No major sentiment-price divergence detected.";

  const drivers = [
    `Momentum ${fmtPercent(momentumPct)} in selected range`,
    `Volume ${volumeRatio >= 1 ? "surge" : "fade"} at ${volumeRatio.toFixed(2)}x average`,
    `News sentiment ${sentimentBias >= 0 ? "positive" : "negative"} (${fmtPercent(sentimentBias * 100, 1)})`,
  ];

  return {
    score,
    confidence,
    label,
    regime,
    momentumPct,
    sentimentBias,
    volumeRatio,
    divergence,
    divergenceReason,
    drivers,
  };
};

const buildNovaBriefing = (
  symbol: string,
  pulse: NovaPulse,
  radar: NewsRadarCluster[],
  companyName: string,
): string => {
  const topRadar = radar[0];
  const stanceText = pulse.label === "bullish" ? "risk-on" : pulse.label === "bearish" ? "risk-off" : "balanced";
  const radarText = topRadar
    ? `Top narrative: ${fmtLabel(topRadar.theme)} (${topRadar.stance}, ${topRadar.count} items).`
    : "News flow is currently light and mixed.";

  return `${companyName || symbol} is in a ${fmtLabel(pulse.regime)} regime with a Nova Pulse score of ${pulse.score}/100 (${stanceText}). ${radarText} Confidence is ${(pulse.confidence * 100).toFixed(0)}%.`;
};

const buildMoveExplanation = (
  rangeLabel: string,
  series: ChartPoint[],
  pulse: NovaPulse,
  radar: NewsRadarCluster[],
): string => {
  if (series.length < 2) {
    return "Not enough candles in this range to explain the move.";
  }

  const first = series[0];
  const last = series[series.length - 1];
  const movePct = first.close > 0 ? ((last.close - first.close) / first.close) * 100 : 0;
  const lead = radar[0];
  const leadText = lead
    ? `${fmtLabel(lead.theme)} headlines have a ${lead.stance} tilt`
    : "headline flow is neutral";

  return `Over ${rangeLabel}, price moved ${fmtPercent(movePct)} while volume tracked ${pulse.volumeRatio.toFixed(2)}x its average pace. ${leadText}. This aligns with a ${fmtLabel(pulse.regime)} setup and a ${fmtLabel(pulse.label)} pulse.`;
};

const computeChartOverlays = (series: ChartPoint[]): ChartOverlays => {
  if (series.length < 10) {
    return {
      supportPrice: null,
      resistancePrice: null,
      supportY: null,
      resistanceY: null,
      trendStartY: null,
      trendEndY: null,
      upperStartY: null,
      upperEndY: null,
      lowerStartY: null,
      lowerEndY: null,
    };
  }

  const lows = series.map((point) => point.low).filter((value) => value > 0);
  const highs = series.map((point) => point.high).filter((value) => value > 0);
  const supportPrice = lows.length ? percentile(lows, 0.2) : null;
  const resistancePrice = highs.length ? percentile(highs, 0.8) : null;

  const supportY = series.length ? percentile(series.map((point) => point.yLow), 0.8) : null;
  const resistanceY = series.length ? percentile(series.map((point) => point.yHigh), 0.2) : null;

  const pointsN = series.length;
  const meanX = (pointsN - 1) / 2;
  const meanY = avg(series.map((point) => point.yClose));
  let num = 0;
  let den = 0;

  for (let index = 0; index < pointsN; index += 1) {
    const dx = index - meanX;
    const dy = series[index].yClose - meanY;
    num += dx * dy;
    den += dx * dx;
  }

  const slope = den > 0 ? num / den : 0;
  const intercept = meanY - slope * meanX;
  const residuals = series.map((point, index) => point.yClose - (intercept + slope * index));
  const band = Math.max(6, stddev(residuals) * 1.35);

  const trendStartY = clamp(intercept, 0, GRAPH_HEIGHT);
  const trendEndY = clamp(intercept + slope * (pointsN - 1), 0, GRAPH_HEIGHT);

  return {
    supportPrice,
    resistancePrice,
    supportY,
    resistanceY,
    trendStartY,
    trendEndY,
    upperStartY: clamp(trendStartY - band, 0, GRAPH_HEIGHT),
    upperEndY: clamp(trendEndY - band, 0, GRAPH_HEIGHT),
    lowerStartY: clamp(trendStartY + band, 0, GRAPH_HEIGHT),
    lowerEndY: clamp(trendEndY + band, 0, GRAPH_HEIGHT),
  };
};

const sentimentFromNews = (items: FinanceNewsItem[]) => {
  const stats = {
    positive: 0,
    neutral: 0,
    negative: 0,
  };

  for (const item of items) {
    const score = Number(item.sentiment_score);
    if (!Number.isFinite(score)) {
      stats.neutral += 1;
      continue;
    }

    if (score > 0.15) {
      stats.positive += 1;
      continue;
    }

    if (score < -0.15) {
      stats.negative += 1;
      continue;
    }

    stats.neutral += 1;
  }

  return stats;
};

const FinanceIntelligence = () => {

  const [providers, setProviders] = useState<FinanceProvidersResponse>(DEFAULT_PROVIDERS);
  const [companies, setCompanies] = useState<FinanceCompanyItem[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>("AAPL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [graphPoints, setGraphPoints] = useState<number>(90);
  const [graphStyle, setGraphStyle] = useState<"line" | "area" | "candles">("candles");
  const [showAiOverlays, setShowAiOverlays] = useState<boolean>(true);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [intel, setIntel] = useState<FinanceCompanyIntelResponse | null>(null);
  const [loadingCompanies, setLoadingCompanies] = useState<boolean>(false);
  const [loadingIntel, setLoadingIntel] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [status, setStatus] = useState<string>("Preparing finance module...");
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const newsFeedRef = useRef<HTMLDivElement | null>(null);

  const loadCompanyIntel = useCallback(async (symbol: string, silent = false) => {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) {
      return;
    }

    if (!silent) {
      setStatus(`Loading ${normalized}...`);
    }

    setLoadingIntel(true);

    try {
      const payload = await getFinanceCompanyIntel(normalized, FETCH_CANDLE_POINTS, 22);
      setIntel(payload);
      setHoveredPointIndex(null);

      const softErrors: string[] = [];
      if (payload.quote_error) {
        softErrors.push(`Quote: ${payload.quote_error}`);
      }
      if (payload.candles_error) {
        softErrors.push(`Candles: ${payload.candles_error}`);
      }
      if (payload.company_provider_errors.length > 0) {
        softErrors.push(`Company providers: ${payload.company_provider_errors.slice(0, 2).join(" | ")}`);
      }

      const hasNewsItems = (payload.news || []).length > 0;
      const filteredNewsErrors = payload.news_provider_errors.filter((entry) => {
        const lowered = entry.toLowerCase();
        const isTradestieTransient =
          lowered.includes("tradestie") &&
          (lowered.includes("timed out") || lowered.includes("timeout") || lowered.includes("unreachable"));

        // Hide expected Tradestie network blips when other providers already returned news.
        return !(isTradestieTransient && hasNewsItems);
      });

      if (filteredNewsErrors.length > 0) {
        softErrors.push(`News providers: ${filteredNewsErrors.slice(0, 2).join(" | ")}`);
      }

      setError(softErrors.join("\n"));
      setStatus(`Updated ${new Date().toLocaleTimeString()} (${normalized})`);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load finance intelligence";
      setError(message);
      setStatus("Update failed");
    } finally {
      setLoadingIntel(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const payload = await getFinanceProviders();
        if (active) {
          setProviders(payload);
        }
      } catch {
        // Keep default provider flags when the check endpoint is unavailable.
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setLoadingCompanies(true);

      try {
        const payload = await getFinanceCompanies(searchQuery.trim(), 900);
        if (!active) {
          return;
        }

        const next = payload.items || [];
        setCompanies(next);

        if (!next.some((item) => item.symbol === selectedSymbol)) {
          const preferred = next.find((item) => item.symbol === "AAPL");
          const fallback = preferred?.symbol || next[0]?.symbol;
          if (fallback) {
            setSelectedSymbol(fallback);
          }
        }
      } catch (fetchError) {
        if (!active) {
          return;
        }

        const message = fetchError instanceof Error ? fetchError.message : "Unable to load company catalog";
        setError(message);
      } finally {
        if (active) {
          setLoadingCompanies(false);
        }
      }
    }, 260);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchQuery, selectedSymbol]);

  useEffect(() => {
    if (!selectedSymbol) {
      return;
    }

    void loadCompanyIntel(selectedSymbol);
  }, [loadCompanyIntel, selectedSymbol]);

  useEffect(() => {
    if (!autoRefresh || !selectedSymbol) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadCompanyIntel(selectedSymbol, true);
    }, AUTO_REFRESH_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [autoRefresh, loadCompanyIntel, selectedSymbol]);

  const candles = useMemo(() => intel?.candles ?? [], [intel?.candles]);
  const visibleCandles = useMemo(() => candles.slice(-Math.max(14, graphPoints)), [candles, graphPoints]);
  const chartSeries = useMemo(() => chartSeriesFromCandles(visibleCandles, GRAPH_WIDTH, GRAPH_HEIGHT), [visibleCandles]);
  const linePoints = useMemo(() => linePointsFromSeries(chartSeries), [chartSeries]);
  const areaPath = useMemo(() => areaPathFromSeries(chartSeries, GRAPH_HEIGHT), [chartSeries]);
  const candleWidth = useMemo(() => candleBodyWidth(chartSeries.length), [chartSeries.length]);
  const hoveredPoint = useMemo(() => {
    if (hoveredPointIndex === null) {
      return null;
    }

    if (hoveredPointIndex < 0 || hoveredPointIndex >= chartSeries.length) {
      return null;
    }

    return chartSeries[hoveredPointIndex];
  }, [chartSeries, hoveredPointIndex]);

  const trendUp = useMemo(() => {
    if (chartSeries.length < 2) {
      return true;
    }
    const first = chartSeries[0];
    const last = chartSeries[chartSeries.length - 1];
    return last.close >= first.close;
  }, [chartSeries]);

  const volumeSeries = useMemo(() => {
    const barsTarget = Math.min(56, Math.max(16, Math.floor(graphPoints / 1.8)));

    return visibleCandles
      .slice(-barsTarget)
      .map((row) => ({
        date: row.date,
        value: Math.max(0, toNum(row.volume)),
        bullish: toNum(row.close) >= toNum(row.open),
      }))
      .filter((row) => row.value > 0);
  }, [visibleCandles, graphPoints]);

  const volumeMax = useMemo(() => {
    if (!volumeSeries.length) {
      return 1;
    }
    return Math.max(...volumeSeries.map((row) => row.value), 1);
  }, [volumeSeries]);

  const returnsSeries = useMemo(() => {
    const barsTarget = Math.min(56, Math.max(18, Math.floor(graphPoints / 1.4)));
    return dailyReturnsFromCandles(visibleCandles).slice(-barsTarget);
  }, [visibleCandles, graphPoints]);

  const returnsMaxAbs = useMemo(() => {
    if (!returnsSeries.length) {
      return 1;
    }
    return Math.max(...returnsSeries.map((row) => Math.abs(row.value)), 1);
  }, [returnsSeries]);

  const newsItems = useMemo(() => intel?.news ?? [], [intel?.news]);
  const newsRadar = useMemo(() => buildNewsRadar(newsItems), [newsItems]);
  const sentiment = useMemo(() => sentimentFromNews(newsItems), [newsItems]);
  const sentimentTotal = sentiment.positive + sentiment.neutral + sentiment.negative;
  const candlesProvider = intel?.candles_provider || "unavailable";
  const selectedRangeLabel =
    GRAPH_RANGE_OPTIONS.find((option) => option.points === graphPoints)?.label || `${graphPoints}D`;

  const quote = intel?.quote;
  const company = intel?.company;
  const changeValue = quote ? toNum(quote.change) : 0;
  const isChangePositive = changeValue >= 0;
  const novaPulse = useMemo(
    () => computeNovaPulse(chartSeries, returnsSeries, changeValue, newsItems),
    [chartSeries, returnsSeries, changeValue, newsItems],
  );
  const novaBriefing = useMemo(
    () => buildNovaBriefing(intel?.symbol || selectedSymbol, novaPulse, newsRadar, company?.name || ""),
    [company?.name, intel?.symbol, newsRadar, novaPulse, selectedSymbol],
  );
  const moveExplanation = useMemo(
    () => buildMoveExplanation(selectedRangeLabel, chartSeries, novaPulse, newsRadar),
    [selectedRangeLabel, chartSeries, novaPulse, newsRadar],
  );
  const chartOverlays = useMemo(() => computeChartOverlays(chartSeries), [chartSeries]);
  const pulseToneClass =
    novaPulse.label === "bullish"
      ? "text-emerald-300"
      : novaPulse.label === "bearish"
        ? "text-rose-300"
        : "text-amber-200";
  const pulseRingClass =
    novaPulse.label === "bullish"
      ? "from-emerald-400/30 to-emerald-500/5"
      : novaPulse.label === "bearish"
        ? "from-rose-400/30 to-rose-500/5"
        : "from-amber-300/30 to-amber-500/5";

  const handleChartHoverMove = (event: MouseEvent<SVGSVGElement>) => {
    if (!chartSeries.length) {
      return;
    }
    const next = nearestPointIndex(event, chartSeries.length);
    setHoveredPointIndex((prev) => (prev === next ? prev : next));
  };

  const handleNewsWheel = (event: WheelEvent<HTMLDivElement>) => {
    const element = newsFeedRef.current;
    if (!element || element.scrollHeight <= element.clientHeight) {
      return;
    }

    const maxScrollTop = element.scrollHeight - element.clientHeight;
    const nextScrollTop = Math.max(0, Math.min(maxScrollTop, element.scrollTop + event.deltaY));
    element.scrollTop = nextScrollTop;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <section className="w-full p-3 sm:p-8 pb-20 max-w-7xl mx-auto h-full min-h-0">
      <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-panel)]/80 backdrop-blur-2xl p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-soft)]">Global Finance Intelligence</p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--app-text)] mt-1">Company Data + Live News Graphs</h2>
            <p className="text-sm text-[var(--text-muted)] mt-2 max-w-3xl">
              Browse listed companies, track market movement with in-app charts, and read finance news without leaving this workspace.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-chip)] px-4 py-3 min-w-[260px]">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">Feed Status</p>
            <p className="text-sm text-[var(--app-text)] mt-1 flex items-center gap-2">
              <Activity size={15} className="text-[var(--accent-primary)]" />
              {status}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <ProviderChip label="Alpha Vantage" active={providers.alpha_vantage_configured} />
          <ProviderChip label="MarketAux" active={providers.marketaux_configured} />
          <ProviderChip label="Finnhub" active={providers.finnhub_configured} />
          <ProviderChip label="FMP" active={providers.fmp_configured} />
          <ProviderChip label="SEC" active={providers.sec_enabled} />
          <ProviderChip label="Tradestie" active={providers.tradestie_enabled} />
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)]/85 p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-5">
                <label className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-soft)]">Search Company</label>
                <div className="mt-1.5 relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)]" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Type symbol or company"
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-input)] pl-9 pr-3 py-2.5 text-sm text-[var(--app-text)] placeholder:text-[var(--placeholder)] outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
              </div>

              <div className="md:col-span-4">
                <label className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-soft)]">Select Symbol</label>
                <select
                  className="nova-select mt-1.5 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-input)] px-3 py-2.5 text-sm text-[var(--app-text)] outline-none focus:border-[var(--accent-primary)]"
                  value={selectedSymbol}
                  onChange={(event) => setSelectedSymbol(event.target.value)}
                  disabled={loadingCompanies || companies.length === 0}
                >
                  {companies.length === 0 && <option value={selectedSymbol || "AAPL"}>Loading companies...</option>}
                  {companies.map((item) => (
                    <option key={item.symbol} value={item.symbol}>
                      {item.name} ({item.symbol})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3 flex items-end gap-2">
                <button
                  onClick={() => void loadCompanyIntel(selectedSymbol)}
                  disabled={loadingIntel || !selectedSymbol}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-chip)] px-3 py-2.5 text-sm text-[var(--app-text)] hover:bg-[var(--surface-chip-hover)] disabled:opacity-60"
                >
                  <RefreshCw size={14} className={loadingIntel ? "animate-spin" : ""} />
                  Reload
                </button>
                <button
                  onClick={() => setAutoRefresh((prev) => !prev)}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${
                    autoRefresh
                      ? "border-[var(--accent-primary)] bg-[var(--surface-chip-hover)] text-[var(--app-text)]"
                      : "border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-muted)]"
                  }`}
                >
                  <Activity size={14} />
                  Auto {autoRefresh ? "ON" : "OFF"}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-chip)] p-4 space-y-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">Company Snapshot</p>
              <h3 className="text-xl font-semibold text-[var(--app-text)]">{company?.name || intel?.symbol || selectedSymbol}</h3>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <InfoPill label="Symbol" value={intel?.symbol || selectedSymbol} />
                <InfoPill label="Sector" value={company?.sector || "-"} />
                <InfoPill label="Industry" value={company?.industry || "-"} />
                <InfoPill label="Country" value={company?.country || "-"} />
                <InfoPill label="Employees" value={fmtInt(company?.employees)} />
                <InfoPill label="Volume" value={fmtInt(quote?.volume)} />
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)]/70 p-3">
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  {company?.description?.trim() || "No long-form company description is currently available from active providers."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px]">
                {(intel?.company_sources || []).map((source) => (
                  <span key={source} className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)]/70 px-2 py-1 text-[var(--text-muted)]">
                    company:{source}
                  </span>
                ))}
                {(intel?.news_providers || []).map((source) => (
                  <span key={source} className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)]/70 px-2 py-1 text-[var(--text-muted)]">
                    news:{source}
                  </span>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 whitespace-pre-wrap">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <MetricCard
                label="Current Price"
                value={quote ? `$${fmtNum(quote.price)}` : "-"}
                sub={quote?.latest_trading_day ? `Day ${quote.latest_trading_day}` : "Market data pending"}
                icon={<BarChart3 size={16} />}
              />

              <MetricCard
                label="Day Change"
                value={`${isChangePositive ? "+" : ""}${fmtNum(changeValue)} ${quote?.change_percent ? `(${quote.change_percent})` : ""}`}
                sub={quote?.provider ? `Provider ${quote.provider}` : "Provider unavailable"}
                icon={isChangePositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              />

              <MetricCard
                label="Market Cap"
                value={fmtMoneyCompact(company?.market_cap)}
                sub={company?.exchange || "Exchange unavailable"}
                icon={<Building2 size={16} />}
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-chip)] p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">Nova Market Pulse</p>
                  <span className={`text-xs uppercase tracking-[0.14em] ${pulseToneClass}`}>{novaPulse.label}</span>
                </div>

                <div className={`rounded-lg border border-[var(--border-subtle)] bg-gradient-to-br ${pulseRingClass} p-3`}>
                  <p className="text-3xl font-semibold text-[var(--app-text)]">{novaPulse.score}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Score out of 100 • confidence {(novaPulse.confidence * 100).toFixed(0)}%</p>
                </div>

                <div className="space-y-1.5">
                  {novaPulse.drivers.map((driver) => (
                    <p key={driver} className="text-xs text-[var(--text-muted)] leading-relaxed">
                      • {driver}
                    </p>
                  ))}
                </div>

                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)]/75 px-2.5 py-2 text-xs text-[var(--text-muted)]">
                  Regime: {fmtLabel(novaPulse.regime)}
                </div>
              </div>

              <div className="xl:col-span-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-chip)] p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">Nova Briefing Card</p>
                  <span className="text-xs text-[var(--text-muted)]">range {selectedRangeLabel}</span>
                </div>

                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)]/75 p-3">
                  <p className="text-sm text-[var(--app-text)] leading-relaxed">{novaBriefing}</p>
                </div>

                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)]/75 p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-soft)]">Explain This Move</p>
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed mt-1.5">{moveExplanation}</p>
                </div>

                <div
                  className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${
                    novaPulse.divergence
                      ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
                      : "border-[var(--border-subtle)] bg-[var(--surface-card)]/75 text-[var(--text-muted)]"
                  }`}
                >
                  <p className="text-[11px] uppercase tracking-[0.16em]">Sentiment Divergence Alert</p>
                  <p className="mt-1">{novaPulse.divergenceReason}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)]/85 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">Price Trend Graph</p>
              <p className="text-xs text-[var(--text-muted)]">{candles.length} candles • provider {candlesProvider}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="flex flex-wrap gap-1.5">
                {GRAPH_RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setGraphPoints(option.points)}
                    className={`rounded-md border px-2 py-1 text-[11px] uppercase tracking-[0.08em] ${
                      graphPoints === option.points
                        ? "border-[var(--accent-primary)] bg-[var(--surface-chip-hover)] text-[var(--app-text)]"
                        : "border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-soft)]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowAiOverlays((prev) => !prev)}
                  className={`rounded-md border px-2 py-1 text-[11px] uppercase tracking-[0.08em] ${
                    showAiOverlays
                      ? "border-cyan-300/50 bg-cyan-500/10 text-cyan-100"
                      : "border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-soft)]"
                  }`}
                >
                  AI Overlays {showAiOverlays ? "ON" : "OFF"}
                </button>
                <button
                  type="button"
                  onClick={() => setGraphStyle("candles")}
                  className={`rounded-md border px-2 py-1 text-[11px] uppercase tracking-[0.08em] ${
                    graphStyle === "candles"
                      ? "border-[var(--accent-primary)] bg-[var(--surface-chip-hover)] text-[var(--app-text)]"
                      : "border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-soft)]"
                  }`}
                >
                  Candles
                </button>
                <button
                  type="button"
                  onClick={() => setGraphStyle("line")}
                  className={`rounded-md border px-2 py-1 text-[11px] uppercase tracking-[0.08em] ${
                    graphStyle === "line"
                      ? "border-[var(--accent-primary)] bg-[var(--surface-chip-hover)] text-[var(--app-text)]"
                      : "border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-soft)]"
                  }`}
                >
                  Line
                </button>
                <button
                  type="button"
                  onClick={() => setGraphStyle("area")}
                  className={`rounded-md border px-2 py-1 text-[11px] uppercase tracking-[0.08em] ${
                    graphStyle === "area"
                      ? "border-[var(--accent-primary)] bg-[var(--surface-chip-hover)] text-[var(--app-text)]"
                      : "border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-soft)]"
                  }`}
                >
                  Area
                </button>
              </div>
            </div>

            <div
              className="relative rounded-xl border border-[var(--border-subtle)] p-3 shadow-inner"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 18% 16%, rgba(34, 197, 94, 0.08), transparent 42%), radial-gradient(circle at 85% 12%, rgba(59, 130, 246, 0.08), transparent 40%), linear-gradient(180deg, rgba(9, 15, 24, 0.92), rgba(6, 10, 18, 0.92))",
              }}
            >
              <svg
                viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
                className="w-full h-56"
                role="img"
                aria-label="Price graph"
                onMouseMove={handleChartHoverMove}
                onMouseLeave={() => setHoveredPointIndex(null)}
              >
                <defs>
                  <linearGradient id="financePriceStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={trendUp ? "#22c55e" : "#f97316"} />
                    <stop offset="100%" stopColor={trendUp ? "#10b981" : "#ef4444"} />
                  </linearGradient>
                  <linearGradient id="financePriceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={trendUp ? "#22c55e" : "#ef4444"} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={trendUp ? "#22c55e" : "#ef4444"} stopOpacity="0.03" />
                  </linearGradient>
                </defs>
                <rect x="0" y="0" width={GRAPH_WIDTH} height={GRAPH_HEIGHT} fill="transparent" />

                {[0.16, 0.32, 0.48, 0.64, 0.8].map((ratio) => (
                  <line
                    key={`grid-${ratio}`}
                    x1="0"
                    y1={GRAPH_HEIGHT * ratio}
                    x2={GRAPH_WIDTH}
                    y2={GRAPH_HEIGHT * ratio}
                    stroke="rgba(148, 163, 184, 0.18)"
                    strokeWidth="1"
                    strokeDasharray="3 5"
                  />
                ))}
                <line x1="0" y1={GRAPH_HEIGHT - 1} x2={GRAPH_WIDTH} y2={GRAPH_HEIGHT - 1} stroke="rgba(148, 163, 184, 0.24)" strokeWidth="1" />

                {showAiOverlays && chartOverlays.trendStartY !== null && chartOverlays.trendEndY !== null && (
                  <>
                    <line
                      x1="0"
                      y1={chartOverlays.trendStartY}
                      x2={GRAPH_WIDTH}
                      y2={chartOverlays.trendEndY}
                      stroke="rgba(125, 211, 252, 0.95)"
                      strokeWidth="1.6"
                      strokeDasharray="7 5"
                    />
                    {chartOverlays.upperStartY !== null && chartOverlays.upperEndY !== null && (
                      <line
                        x1="0"
                        y1={chartOverlays.upperStartY}
                        x2={GRAPH_WIDTH}
                        y2={chartOverlays.upperEndY}
                        stroke="rgba(125, 211, 252, 0.5)"
                        strokeWidth="1"
                        strokeDasharray="4 5"
                      />
                    )}
                    {chartOverlays.lowerStartY !== null && chartOverlays.lowerEndY !== null && (
                      <line
                        x1="0"
                        y1={chartOverlays.lowerStartY}
                        x2={GRAPH_WIDTH}
                        y2={chartOverlays.lowerEndY}
                        stroke="rgba(125, 211, 252, 0.5)"
                        strokeWidth="1"
                        strokeDasharray="4 5"
                      />
                    )}
                  </>
                )}

                {showAiOverlays && chartOverlays.resistanceY !== null && (
                  <>
                    <line
                      x1="0"
                      y1={chartOverlays.resistanceY}
                      x2={GRAPH_WIDTH}
                      y2={chartOverlays.resistanceY}
                      stroke="rgba(248, 113, 113, 0.85)"
                      strokeWidth="1"
                      strokeDasharray="5 5"
                    />
                    {chartOverlays.resistancePrice !== null && (
                      <text x={GRAPH_WIDTH - 164} y={Math.max(10, chartOverlays.resistanceY - 5)} fill="rgba(254, 202, 202, 0.95)" fontSize="11">
                        R {fmtMoney(chartOverlays.resistancePrice)}
                      </text>
                    )}
                  </>
                )}

                {showAiOverlays && chartOverlays.supportY !== null && (
                  <>
                    <line
                      x1="0"
                      y1={chartOverlays.supportY}
                      x2={GRAPH_WIDTH}
                      y2={chartOverlays.supportY}
                      stroke="rgba(74, 222, 128, 0.85)"
                      strokeWidth="1"
                      strokeDasharray="5 5"
                    />
                    {chartOverlays.supportPrice !== null && (
                      <text x={GRAPH_WIDTH - 164} y={Math.max(12, chartOverlays.supportY - 5)} fill="rgba(187, 247, 208, 0.95)" fontSize="11">
                        S {fmtMoney(chartOverlays.supportPrice)}
                      </text>
                    )}
                  </>
                )}

                {graphStyle === "area" && areaPath && <path d={areaPath} fill="url(#financePriceFill)" />}

                {graphStyle === "candles" ? (
                  chartSeries.map((point, index) => {
                    const bullish = point.close >= point.open;
                    const color = bullish ? "#22c55e" : "#ef4444";
                    const bodyTop = Math.min(point.yOpen, point.yClose);
                    const bodyHeight = Math.max(1, Math.abs(point.yClose - point.yOpen));

                    return (
                      <g key={`${point.date || "candle"}-${index}`}>
                        <line
                          x1={point.x}
                          y1={point.yHigh}
                          x2={point.x}
                          y2={point.yLow}
                          stroke={color}
                          strokeWidth="1.3"
                          strokeOpacity="0.95"
                        />
                        <rect
                          x={Math.max(0, point.x - candleWidth / 2)}
                          y={bodyTop}
                          width={candleWidth}
                          height={bodyHeight}
                          rx="1"
                          fill={bullish ? "rgba(34, 197, 94, 0.85)" : "rgba(239, 68, 68, 0.85)"}
                          stroke={color}
                          strokeWidth="1"
                        />
                      </g>
                    );
                  })
                ) : (
                  <polyline
                    points={linePoints}
                    fill="none"
                    stroke="url(#financePriceStroke)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {hoveredPoint && (
                  <>
                    <line
                      x1={hoveredPoint.x}
                      y1={0}
                      x2={hoveredPoint.x}
                      y2={GRAPH_HEIGHT}
                      stroke="rgba(248, 250, 252, 0.55)"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <circle cx={hoveredPoint.x} cy={hoveredPoint.yClose} r="4.5" fill={trendUp ? "#22c55e" : "#ef4444"} stroke="rgba(15, 23, 42, 0.92)" strokeWidth="2" />
                  </>
                )}

                {!linePoints && (
                  <text x="20" y="34" fill="rgba(203, 213, 225, 0.75)" fontSize="12">
                    Candle data is unavailable for this symbol.
                  </text>
                )}
              </svg>

              {hoveredPoint && (
                <div className="pointer-events-none absolute top-4 left-4 rounded-lg border border-slate-500/45 bg-slate-950/92 px-3 py-2 text-xs text-slate-100 shadow-xl">
                  <p className="text-[11px] text-slate-300">{hoveredPoint.date}</p>
                  <p className="font-semibold mt-1">Close {fmtMoney(hoveredPoint.close)}</p>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    O {fmtMoney(hoveredPoint.open)} • H {fmtMoney(hoveredPoint.high)} • L {fmtMoney(hoveredPoint.low)}
                  </p>
                  <p className="text-[11px] text-slate-300 mt-0.5">Volume {fmtInt(hoveredPoint.volume)}</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)]/85 p-4 space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">Volume Graph</p>
                <span className="text-[11px] text-[var(--text-muted)]">{volumeSeries.length} bars</span>
              </div>

              <div
                className="mt-2 h-40 rounded-xl border border-[var(--border-subtle)] relative overflow-hidden"
                style={{
                  backgroundImage:
                    "linear-gradient(180deg, rgba(12, 18, 30, 0.92), rgba(6, 11, 20, 0.92)), repeating-linear-gradient(to right, rgba(148, 163, 184, 0.08) 0 1px, transparent 1px 18px)",
                }}
              >
                {volumeSeries.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)] p-3">No volume bars available for this selection.</p>
                )}

                <div className="absolute inset-0 px-2 py-2 flex items-end gap-1.5">
                  {volumeSeries.map((item, index) => {
                    const ratio = item.value / volumeMax;
                    const upClass = item.bullish ? "bg-emerald-400/80" : "bg-rose-400/80";

                    return (
                      <div
                        key={`${item.date}-${index}`}
                        className={`flex-1 rounded-t-sm ${upClass}`}
                        style={{ height: `${Math.max(8, Math.round(ratio * 100))}%` }}
                        title={`${item.date} | ${fmtInt(item.value)}`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">Daily Change Graph</p>
                <span className="text-[11px] text-[var(--text-muted)]">{returnsSeries.length} candles</span>
              </div>

              <div
                className="mt-2 h-44 rounded-xl border border-[var(--border-subtle)] relative overflow-hidden"
                style={{
                  backgroundImage:
                    "linear-gradient(180deg, rgba(8, 14, 24, 0.94), rgba(5, 9, 18, 0.94)), repeating-linear-gradient(to right, rgba(148, 163, 184, 0.08) 0 1px, transparent 1px 16px)",
                }}
              >
                <div className="absolute left-0 right-0 top-1/2 border-t border-slate-400/30" />

                {returnsSeries.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)] p-3">Not enough candles to compute daily changes yet.</p>
                )}

                <div className="absolute inset-0 px-2 py-2 flex items-stretch gap-1.5">
                  {returnsSeries.map((item, index) => {
                    const ratio = Math.abs(item.value) / returnsMaxAbs;
                    const height = `${Math.max(3, ratio * 48)}%`;
                    const up = item.value >= 0;

                    return (
                      <div key={`${item.date}-${index}`} className="relative flex-1">
                        <div
                          className={`absolute left-0 right-0 rounded-sm ${up ? "bg-emerald-400/75" : "bg-rose-400/75"}`}
                          style={up ? { bottom: "50%", height } : { top: "50%", height }}
                          title={`${item.date} | ${fmtPercent(item.value, 2)}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-1 space-y-4">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)]/85 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">News Sentiment Graph</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">From {sentimentTotal} recent articles</p>

              <div className="space-y-3 mt-4">
                <SentimentBar label="Positive" value={sentiment.positive} total={Math.max(sentimentTotal, 1)} color="#34d399" />
                <SentimentBar label="Neutral" value={sentiment.neutral} total={Math.max(sentimentTotal, 1)} color="#fbbf24" />
                <SentimentBar label="Negative" value={sentiment.negative} total={Math.max(sentimentTotal, 1)} color="#f87171" />
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)]/85 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">Smart News Radar</p>
                <span className="text-xs text-[var(--text-muted)]">{newsRadar.length} clusters</span>
              </div>

              <div className="mt-3 space-y-2">
                {newsRadar.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)]">Insufficient news items to build radar clusters.</p>
                )}

                {newsRadar.map((cluster) => (
                  <div key={cluster.theme} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)]/85 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[var(--app-text)] uppercase tracking-[0.12em]">{fmtLabel(cluster.theme)}</p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${
                          cluster.stance === "bullish"
                            ? "border-emerald-400/40 text-emerald-200"
                            : cluster.stance === "bearish"
                              ? "border-rose-400/40 text-rose-200"
                              : "border-amber-300/40 text-amber-200"
                        }`}
                      >
                        {cluster.stance}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">{cluster.count} articles • sentiment {fmtNum(cluster.avgSentiment, 3)}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">{cluster.topHeadline}</p>
                    <p className="text-[11px] text-[var(--text-soft)] mt-1">{cluster.topSource}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="xl:col-span-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)]/85 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-soft)]">In-App Finance News</p>
              <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                <Newspaper size={14} />
                {newsItems.length} items
              </span>
            </div>

            <div
              ref={newsFeedRef}
              onWheel={handleNewsWheel}
              data-lenis-prevent="true"
              className="h-[420px] overflow-y-auto overscroll-contain pr-2 space-y-2 finance-news-scroll"
              role="region"
              aria-label="Finance news feed"
            >
              {newsItems.length === 0 && (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-chip)] p-3 text-sm text-[var(--text-muted)]">
                  News feed is currently empty for this symbol.
                </div>
              )}

              {newsItems.map((item, index) => (
                <article key={`${item.url || item.title || "news"}-${index}`} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-chip)] p-3">
                  <h4 className="text-sm font-semibold text-[var(--app-text)] leading-snug">{item.title || "Untitled update"}</h4>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {item.source || "Unknown source"} | {formatDate(item.published_at)}
                  </p>
                  {item.summary && <p className="text-xs text-[var(--text-muted)] mt-2 leading-relaxed">{item.summary}</p>}
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    {(item.tickers || []).slice(0, 5).map((ticker) => (
                      <span key={`${ticker}-${index}`} className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[var(--text-muted)]">
                        {ticker}
                      </span>
                    ))}
                    {item.sentiment_score !== null && item.sentiment_score !== undefined && (
                      <span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[var(--text-muted)]">
                        sentiment {fmtNum(item.sentiment_score, 3)}
                      </span>
                    )}
                    {item.provider && (
                      <span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[var(--text-muted)]">
                        provider {item.provider}
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="text-xs text-[var(--text-soft)] flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <Globe2 size={13} />
            Company catalog size: {loadingCompanies ? "loading..." : companies.length.toLocaleString()} entries
          </span>
          <span className="inline-flex items-center gap-2">
            <RefreshCw size={13} className={loadingIntel ? "animate-spin" : ""} />
            Auto refresh every {Math.floor(AUTO_REFRESH_MS / 1000)}s
          </span>
        </div>
      </div>
    </section>
  );
};

function ProviderChip({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 text-xs ${
        active
          ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
          : "border-[var(--border-subtle)] bg-[var(--surface-chip)] text-[var(--text-muted)]"
      }`}
    >
      {label}
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-chip)] p-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-soft)]">{label}</p>
      <div className="mt-2 flex items-center gap-2 text-lg text-[var(--app-text)] font-semibold">
        {icon}
        <span>{value}</span>
      </div>
      <p className="text-xs text-[var(--text-muted)] mt-1">{sub}</p>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-chip)] px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-soft)]">{label}</p>
      <p className="text-xs text-[var(--app-text)] mt-1 truncate">{value}</p>
    </div>
  );
}

function SentimentBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const ratio = Math.max(0, Math.min(1, value / Math.max(total, 1)));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2.5 rounded-full bg-[var(--surface-chip)] overflow-hidden border border-[var(--border-subtle)]">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(6, ratio * 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default FinanceIntelligence;
