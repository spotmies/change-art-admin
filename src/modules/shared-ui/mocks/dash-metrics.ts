/**
 * Mock dashboard metrics — mirrors DASH_METRICS in change_artwork_demo_v2.html.
 * Keyed by selected time range; each role exposes the numbers its dashboard
 * needs.
 */

export type DashRange = 'This Month' | 'Last 6 months' | 'This year' | 'Max';

export const DASH_RANGES: DashRange[] = ['This Month', 'Last 6 months', 'This year', 'Max'];

export interface CSDashMetrics {
  pending: number;
  inProd: number;
  ready: number;
  delivered: number;
  sub1: string;
  sub2: string;
  sub3: string;
  sub4: string;
  orderSplit: {
    orders: number;
    art: number;
    artVal: number;
    dig: number;
    digVal: number;
    sew: number;
    sewVal: number;
  };
  trend: Array<{ v: number; h: number }>;
}

export interface TLDashMetrics {
  unassigned: number;
  inProg: number;
  srReview: number;
  comp: number;
}

export interface DesignerDashMetrics {
  comp: number;
  time: string;
  qcRej: string;
  jrRej: string;
}

export interface QCDashMetrics {
  pending: number;
  app: number;
  rej: number;
  time: string;
}

export interface AdminDashMetrics {
  open: number;
  inProd: number;
  inQc: number;
  readyByArtist: number;
  readyByQc: number;
  rev: string;
  revSub: string;
  revSplit: {
    art: number;
    artVal: string;
    dig: number;
    digVal: string;
    sew: number;
    sewVal: string;
  };
}

export interface RangeMetrics {
  cs: CSDashMetrics;
  tl: TLDashMetrics;
  ds: DesignerDashMetrics;
  qc: QCDashMetrics;
  admin: AdminDashMetrics;
}

export const DASH_METRICS: Record<DashRange, RangeMetrics> = {
  'This Month': {
    cs: {
      pending: 2,
      inProd: 4,
      ready: 1,
      delivered: 3,
      sub1: '↑ 1 new today',
      sub2: '3 on track',
      sub3: 'QC approved',
      sub4: '↑ vs yesterday',
      orderSplit: { orders: 7, art: 75, artVal: 5, dig: 17, digVal: 1, sew: 8, sewVal: 1 },
      trend: [
        { v: 1, h: 30 },
        { v: 2, h: 50 },
        { v: 1, h: 20 },
        { v: 4, h: 80 },
        { v: 5, h: 100 },
        { v: 1, h: 20 },
        { v: 0, h: 4 },
      ],
    },
    tl: { unassigned: 3, inProg: 5, srReview: 1, comp: 2 },
    ds: { comp: 34, time: '4.2h', qcRej: '6%', jrRej: '22%' },
    qc: { pending: 3, app: 4, rej: 1, time: '18m' },
    admin: {
      open: 7,
      inProd: 4,
      inQc: 1,
      readyByArtist: 3,
      readyByQc: 2,
      rev: '2.84L',
      revSub: '↑ 9%',
      revSplit: { art: 58, artVal: '1.65L', dig: 30, digVal: '85K', sew: 12, sewVal: '34K' },
    },
  },
  'Last 6 months': {
    cs: {
      pending: 12,
      inProd: 45,
      ready: 18,
      delivered: 134,
      sub1: '↑ 14 this week',
      sub2: '40 on track',
      sub3: 'Batch approved',
      sub4: '↑ 22 vs prev',
      orderSplit: { orders: 142, art: 60, artVal: 85, dig: 30, digVal: 43, sew: 10, sewVal: 14 },
      trend: [
        { v: 15, h: 25 },
        { v: 25, h: 41 },
        { v: 12, h: 20 },
        { v: 45, h: 75 },
        { v: 60, h: 100 },
        { v: 18, h: 30 },
        { v: 8, h: 13 },
      ],
    },
    tl: { unassigned: 12, inProg: 45, srReview: 14, comp: 134 },
    ds: { comp: 210, time: '3.8h', qcRej: '4.5%', jrRej: '18%' },
    qc: { pending: 18, app: 180, rej: 24, time: '15m' },
    admin: {
      open: 42,
      inProd: 45,
      inQc: 18,
      readyByArtist: 12,
      readyByQc: 8,
      rev: '15.4L',
      revSub: '↑ 18%',
      revSplit: { art: 65, artVal: '10L', dig: 25, digVal: '3.8L', sew: 10, sewVal: '1.6L' },
    },
  },
  'This year': {
    cs: {
      pending: 18,
      inProd: 65,
      ready: 24,
      delivered: 290,
      sub1: '↑ 20 this week',
      sub2: '60 on track',
      sub3: 'Batch approved',
      sub4: '↑ 45 vs prev',
      orderSplit: { orders: 320, art: 65, artVal: 208, dig: 25, digVal: 80, sew: 10, sewVal: 32 },
      trend: [
        { v: 30, h: 25 },
        { v: 50, h: 41 },
        { v: 25, h: 20 },
        { v: 90, h: 75 },
        { v: 120, h: 100 },
        { v: 35, h: 29 },
        { v: 15, h: 13 },
      ],
    },
    tl: { unassigned: 18, inProg: 65, srReview: 20, comp: 290 },
    ds: { comp: 420, time: '3.5h', qcRej: '4%', jrRej: '15%' },
    qc: { pending: 24, app: 340, rej: 42, time: '14m' },
    admin: {
      open: 65,
      inProd: 65,
      inQc: 24,
      readyByArtist: 20,
      readyByQc: 14,
      rev: '32.1L',
      revSub: '↑ 24%',
      revSplit: { art: 70, artVal: '22.5L', dig: 20, digVal: '6.4L', sew: 10, sewVal: '3.2L' },
    },
  },
  Max: {
    cs: {
      pending: 35,
      inProd: 120,
      ready: 45,
      delivered: 950,
      sub1: 'Lifetime',
      sub2: 'Lifetime',
      sub3: 'Lifetime',
      sub4: 'Lifetime',
      orderSplit: { orders: 1040, art: 70, artVal: 728, dig: 20, digVal: 208, sew: 10, sewVal: 104 },
      trend: [
        { v: 100, h: 31 },
        { v: 150, h: 46 },
        { v: 80, h: 25 },
        { v: 250, h: 78 },
        { v: 320, h: 100 },
        { v: 95, h: 30 },
        { v: 40, h: 13 },
      ],
    },
    tl: { unassigned: 35, inProg: 120, srReview: 40, comp: 950 },
    ds: { comp: 1150, time: '3.2h', qcRej: '3.5%', jrRej: '12%' },
    qc: { pending: 45, app: 1050, rej: 110, time: '12m' },
    admin: {
      open: 120,
      inProd: 120,
      inQc: 45,
      readyByArtist: 48,
      readyByQc: 32,
      rev: '98.5L',
      revSub: 'Lifetime',
      revSplit: { art: 75, artVal: '74L', dig: 15, digVal: '14.5L', sew: 10, sewVal: '10L' },
    },
  },
};
