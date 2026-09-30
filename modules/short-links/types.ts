export interface ShortLinkView {
  id: string;
  slug: string;
  title: string;
  description: string;
  destinationUrl: string;
  shortUrl: string;
  shareUrl: string;
  isActive: boolean;
  createdAt: string;
  clicks: number;
}

export interface HistoryView {
  id: string;
  originalUrl: string;
  resultUrl: string;
  kind: string;
  createdAt: string;
}

export interface PageResult<T> {
  items: T[];
  page: number;
  hasMore: boolean;
}

export interface LinkMetrics {
  total: number;
  last30Days: number;
  daily: { date: string; clicks: number }[];
  referrers: { name: string; clicks: number }[];
  devices: { name: string; clicks: number }[];
}
