/**
 * Static job fixtures used by every page until the backend endpoints land.
 * Mirrors the `JOBS` array in change_artwork/change_artwork_demo_v2.html so the
 * React port is visually identical to the prototype.
 *
 * NOT for production. Replace via TanStack Query selectors as each
 * F-FE-XXX spec hooks up its real endpoint.
 */

export type JobStage = 'quote' | 'junior' | 'senior' | 'sewout' | 'qc' | 'delivered';

export type JobOrderType = 'Artwork' | 'Digitizing' | 'Digitizing + Sewout' | 'Sewout' | 'Other';

export type JobProject = 'Live' | 'Quote' | 'Amend' | 'Live Quote';

export type JobPriority = 'Normal' | 'Rush' | 'Super Rush';

export type JobComplexity = 'Simple' | 'Medium' | 'Super Medium' | 'Complex' | 'Super Complex';

export type JobStatus =
  | 'In QC'
  | 'In Production'
  | 'Pending'
  | 'Senior Review'
  | 'Sewout'
  | 'Ready to Deliver'
  | 'Dispatched'
  | 'Quote Submitted'
  | 'Quote Approved'
  | 'Pending Client Confirm'
  | 'Cancelled'
  | 'Amend'
  | 'In Review'
  | 'On Hold';

export interface AiScore {
  colour: number;
  align: number;
  res: number;
  brief: number;
}

export interface Negotiation {
  status: 'pending_agency' | 'pending_client' | 'approved' | 'rejected';
  clientOffer: number | null;
  agencyOffer: number | null;
  finalPrice: number | null;
}

export interface Job {
  id: string;
  /** Backend UUID (IJobCard.id). Optional in mock data; required when calling
   *  CS panel endpoints (send-price, reject, dispatch). When absent, the API
   *  calls will warn and no-op instead of sending the human-readable job_id. */
  uuid?: string;
  /** Optimistic-lock version (IJobCard.version). Required to PATCH the job
   *  card from the Edit modal. Omitted in mock data. */
  version?: number;
  /** Raw backend JobStatus enum (e.g. 'QUOTE_SUBMITTED', 'READY_TO_DELIVER').
   *  The `status` field above is the UI-friendly collapsed string and loses
   *  distinctions like READY_TO_DELIVER vs DELIVERED that gating logic needs.
   *  Adapter sets this from IJobCard.status; mocks may omit it. */
  rawStatus?: string;
  ref: string;
  client: string;
  clientId: string;
  design: string;
  summary: string;
  order: JobOrderType;
  project: JobProject;
  complexity: JobComplexity;
  process: string | null;
  priority: JobPriority;
  /** Numeric hours — matches backend `eta_hours`. Display as `${etaHours}h`. */
  etaHours: number | null;
  specificType?: string | null;
  finalFiles?: string[];
  status: JobStatus;
  stage: JobStage;
  assignedTo: string | null;
  subType: 'Senior' | 'Junior' | null;
  notes: string;
  colors: number;
  created: string;
  aiScore: AiScore | null;
  images?: string[];
  negotiation?: Negotiation;
  clientPrice?: number;
  adminPrice?: number | null;
  /** Optional note the agency attached with the price (admin_price_note). */
  adminPriceNote?: string | null;
  /** Currency the agency quoted in. Defaults to USD when omitted. */
  adminPriceCurrency?: string | null;
  agreedPrice?: number | null;
  placement?: string;
  width?: number;
  height?: number;
  fabric?: string;
  stitchCount?: number;
  /** ISO timestamp when admin sent the acknowledgement. Countdown starts from here. */
  acknowledgedAt?: string | null;
  /** acknowledgedAt shifted forward by totalHeldMs — use this (not acknowledgedAt) for ETA countdown math so paused time doesn't count against the client. */
  effectiveAcknowledgedAt?: string | null;
  /** JobStatus the job was in before being put on HOLD; null unless status === HOLD. */
  preHoldStatus?: string | null;
  /** ISO timestamp the current hold began; null unless status === HOLD. */
  heldAt?: string | null;
  /** Cumulative hold duration in ms across all past hold periods. */
  totalHeldMs?: number;
  /** True when this job record is the admin-managed copy (not the original client submission). */
  isAdminCopy?: boolean;
  /** UUID of the original client job this was copied from (present when isAdminCopy = true). */
  parentJobId?: string | null;
  /** True on the original when an admin copy has been created for it. */
  hasAdminCopy?: boolean;
  /** Client's own PO / reference number entered when placing the order. */
  clientPo?: string | null;
  /** How many modification requests have been made on this job — drives Amend R1/R2 badge. */
  modificationCount?: number;
  /** The client's description from their latest modification request. */
  modificationNotes?: string | null;
  /** This client's card-on-file expiry, so CS/Admin can be warned it's expired/expiring soon. */
  clientCardExpMonth?: number | null;
  clientCardExpYear?: number | null;
  /** 'CREDIT_CARD' (one-time card details) vs 'CARD_ON_FILE' (saved card) — controls the
   *  expiry warning's wording so it doesn't call a one-time card a "card on file". */
  clientPaymentMode?: string | null;
  /** ISO timestamp of this client's most recent OTHER order (drafts excluded) — the Client
   *  Inactivity Indicator. Only populated on the job-detail fetch, not list views. */
  clientPreviousOrderAt?: string | null;
  /** Whether the current viewer has opened this job card (per-viewer, from backend `job_card_reads`). */
  isRead?: boolean;
}

export const JOBS: Job[] = [
  {
    id: 'J-2025-0047',
    ref: '04-30-2025-C001-047-A',
    client: 'Ravi Textiles',
    clientId: 'C001',
    design: 'Corporate Logo Set',
    summary: 'Logo lockups, export-ready vectors, and brand-safe color checks.',
    order: 'Artwork',
    project: 'Live',
    complexity: 'Complex',
    process: 'Screen Printing',
    priority: 'Rush',
    etaHours: 8,
    status: 'Quote Approved',
    stage: 'qc',
    assignedTo: 'Kavya Reddy',
    subType: 'Senior',
    notes:
      'Refer to brand guidelines. Use Pantone 286C for navy. All text must be vectorised.',
    colors: 4,
    created: '2025-04-30 09:15',
    aiScore: { colour: 88, align: 92, res: 85, brief: 90 },
    negotiation: { status: 'pending_agency', clientOffer: 12000, agencyOffer: null, finalPrice: null },
  },
  {
    id: 'J-2025-0046',
    ref: '04-29-2025-C002-046',
    client: 'Star Garments',
    clientId: 'C002',
    design: 'Team Jersey Digitizing',
    summary: 'Tight-deadline embroidery setup with a full color count.',
    order: 'Digitizing',
    project: 'Live',
    complexity: 'Super Complex',
    process: null,
    priority: 'Super Rush',
    etaHours: 6,
    status: 'Senior Review',
    stage: 'senior',
    assignedTo: 'Arjun Patel',
    subType: 'Junior',
    notes: '8-color embroidery. Tight deadline. 450 pieces.',
    placement: 'Left Chest',
    width: 4.5,
    height: 3.2,
    fabric: 'Cotton Blend',
    colors: 8,
    created: '2025-04-29 14:30',
    aiScore: null,
    negotiation: { status: 'pending_client', clientOffer: 8500, agencyOffer: 9500, finalPrice: null },
  },
  {
    id: 'J-2025-0045',
    ref: '04-28-2025-C003-045',
    client: 'Heritage Caps',
    clientId: 'C003',
    design: 'Cap Emblem Full Set',
    summary: 'Cap emblem artwork prepared for sewout and fit checks.',
    order: 'Digitizing + Sewout',
    project: 'Live',
    complexity: 'Medium',
    process: null,
    priority: 'Normal',
    etaHours: 12,
    status: 'Sewout',
    stage: 'sewout',
    assignedTo: 'Meena Das',
    subType: 'Senior',
    notes: '3D puff effect on "H". Sewout required.',
    placement: 'Front of Cap',
    width: 3.0,
    height: 2.5,
    fabric: 'Wool Blend',
    colors: 3,
    created: '2025-04-28 11:00',
    aiScore: null,
    negotiation: { status: 'approved', clientOffer: 4500, agencyOffer: 5000, finalPrice: 5000 },
  },
  {
    id: 'J-2025-0044',
    ref: '04-27-2025-C001-044',
    client: 'Ravi Textiles',
    clientId: 'C001',
    design: 'Summer Collection Flyer',
    summary: 'Flyer revision with warmer product image tones.',
    order: 'Artwork',
    project: 'Amend',
    complexity: 'Simple',
    process: 'Digital Printing',
    priority: 'Normal',
    etaHours: 4,
    status: 'In Production',
    stage: 'junior',
    assignedTo: 'Rahul Nair',
    subType: 'Junior',
    notes: 'Client requested color tone adjustment on product images.',
    colors: 2,
    created: '2025-04-27 10:20',
    aiScore: null,
  },
  {
    id: 'J-2025-0043',
    ref: '04-26-2025-C004-043',
    client: 'Blue Label Co.',
    clientId: 'C004',
    design: 'Polo Shirt Digitize',
    summary: 'Clean 2-color sleeve digitizing with delivery-ready files.',
    order: 'Digitizing',
    project: 'Live',
    complexity: 'Simple',
    process: null,
    priority: 'Rush',
    etaHours: 5,
    status: 'Dispatched',
    stage: 'delivered',
    assignedTo: 'Arjun Patel',
    subType: 'Senior',
    notes: 'Simple 2-color sleeve design.',
    placement: 'Sleeve',
    width: 2.0,
    height: 2.0,
    fabric: 'Pique Cotton',
    colors: 2,
    created: '2025-04-26 08:45',
    aiScore: { colour: 95, align: 97, res: 92, brief: 96 },
  },
  {
    id: 'J-2025-0042',
    ref: '04-25-2025-C005-042-A',
    client: 'Urban Threads',
    clientId: 'C005',
    design: 'Brand Identity Pack',
    summary: 'Full brand package covering stationery and packaging.',
    order: 'Artwork',
    project: 'Quote',
    complexity: 'Super Complex',
    process: 'Offset Printing',
    priority: 'Normal',
    etaHours: 16,
    status: 'Quote Submitted',
    stage: 'quote',
    assignedTo: null,
    subType: null,
    notes: 'Full brand package including stationery and packaging design.',
    colors: 5,
    created: '2025-04-25 16:00',
    aiScore: null,
    clientPrice: 150,
    adminPrice: null,
    agreedPrice: null,
  },
  {
    id: 'J-2025-0041',
    ref: '04-24-2025-C002-041',
    client: 'Star Garments',
    clientId: 'C002',
    design: 'School Uniform Badge',
    summary: 'Uniform badge digitizing with QC-approved stitch counts.',
    order: 'Digitizing + Sewout',
    project: 'Live',
    complexity: 'Medium',
    process: null,
    priority: 'Normal',
    etaHours: 10,
    status: 'Dispatched',
    stage: 'delivered',
    assignedTo: 'Meena Das',
    subType: 'Senior',
    notes: '450 pieces batch. Uniform quality required.',
    placement: 'Left Chest',
    width: 3.5,
    height: 3.5,
    fabric: 'Polyester',
    colors: 4,
    created: '2025-04-24 09:00',
    stitchCount: 12480,
    aiScore: { colour: 91, align: 93, res: 89, brief: 94 },
  },
  {
    id: 'J-2025-0040',
    ref: '04-23-2025-C003-040',
    client: 'Heritage Caps',
    clientId: 'C003',
    design: 'Winter Jacket Back Print',
    summary: 'Large back print artwork for winter jacket line with gradient treatment.',
    order: 'Artwork',
    project: 'Quote',
    complexity: 'Complex',
    process: 'Screen Printing',
    priority: 'Rush',
    etaHours: 10,
    status: 'Quote Submitted',
    stage: 'quote',
    assignedTo: null,
    subType: null,
    notes:
      'Client wants a dark gradient background with gold foil effect. Provide vector and print-ready files.',
    colors: 4,
    created: '2025-04-23 08:30',
    aiScore: null,
    clientPrice: 220,
    adminPrice: null,
    agreedPrice: null,
  },
  {
    id: 'J-2025-0039',
    ref: '04-22-2025-C004-039',
    client: 'Blue Label Co.',
    clientId: 'C004',
    design: 'Retail Swing Tag Set',
    summary: 'Swing tag artwork for 3 SKUs — price, care, and brand tags.',
    order: 'Artwork',
    project: 'Quote',
    complexity: 'Simple',
    process: 'Digital Printing',
    priority: 'Normal',
    etaHours: 6,
    status: 'Quote Submitted',
    stage: 'quote',
    assignedTo: null,
    subType: null,
    notes:
      'Three separate tag designs. Brand logo placement on all. Font must match existing brand guidelines PDF attached.',
    colors: 2,
    created: '2025-04-22 11:00',
    aiScore: null,
    clientPrice: 80,
  },
  {
    id: 'J-2025-0038',
    ref: '04-21-2025-C001-038',
    client: 'Ravi Textiles',
    clientId: 'C001',
    design: 'Hoodie Chest Embroidery',
    summary: 'Small chest embroidery logo for premium hoodie range.',
    order: 'Digitizing',
    project: 'Live',
    complexity: 'Simple',
    process: null,
    priority: 'Normal',
    etaHours: 5,
    status: 'In Production',
    stage: 'junior',
    assignedTo: 'Rahul Nair',
    subType: 'Junior',
    notes:
      'Keep stitch count below 5000. Use running stitch for fine details. Delivery for 200 units.',
    placement: 'Left Chest',
    width: 2.5,
    height: 2.5,
    fabric: 'Fleece',
    colors: 3,
    created: '2025-04-21 09:45',
    aiScore: null,
  },
  {
    id: 'J-2025-0037',
    ref: '04-20-2025-C002-037',
    client: 'Star Garments',
    clientId: 'C002',
    design: 'Marathon Event T-Shirt',
    summary: 'Event T-shirt with sponsor logos and runner number placement.',
    order: 'Artwork',
    project: 'Live',
    complexity: 'Medium',
    process: 'Screen Printing',
    priority: 'Super Rush',
    etaHours: 4,
    status: 'In Production',
    stage: 'junior',
    assignedTo: 'Rahul Nair',
    subType: 'Junior',
    notes:
      'Event date is next Friday. Sponsor logos must be white on navy. Use sponsor artwork from shared folder.',
    colors: 3,
    created: '2025-04-20 14:00',
    aiScore: null,
  },
  {
    id: 'J-2025-0036',
    ref: '04-19-2025-C005-036',
    client: 'Urban Threads',
    clientId: 'C005',
    design: 'Premium Polo Embroidery',
    summary: 'Front chest and sleeve placement for high-end polo shirt range.',
    order: 'Digitizing + Sewout',
    project: 'Live',
    complexity: 'Complex',
    process: null,
    priority: 'Rush',
    etaHours: 9,
    status: 'Senior Review',
    stage: 'senior',
    assignedTo: 'Kavya Reddy',
    subType: 'Senior',
    notes:
      'Client needs sewout sample before bulk production. Use satin stitch for lettering. 300 units expected.',
    placement: 'Left Chest + Sleeve',
    width: 3.5,
    height: 2.0,
    fabric: 'Pique Cotton',
    colors: 4,
    created: '2025-04-19 10:30',
    aiScore: null,
  },
  {
    id: 'J-2025-0035',
    ref: '04-18-2025-C003-035',
    client: 'Heritage Caps',
    clientId: 'C003',
    design: 'Sports Cap Front Panel',
    summary: 'Structured cap front panel with 3D puff digitizing.',
    order: 'Digitizing',
    project: 'Live',
    complexity: 'Complex',
    process: null,
    priority: 'Normal',
    etaHours: 8,
    status: 'In QC',
    stage: 'qc',
    assignedTo: 'Arjun Patel',
    subType: 'Senior',
    notes:
      '3D puff digitizing on main wordmark. Flat fill on icon element. 500-piece batch.',
    placement: 'Front Panel',
    width: 4.0,
    height: 2.8,
    fabric: 'Canvas',
    colors: 3,
    created: '2025-04-18 09:00',
    stitchCount: 18400,
    aiScore: { colour: 90, align: 88, res: 91, brief: 93 },
  },
  {
    id: 'J-2025-0034',
    ref: '04-17-2025-C004-034',
    client: 'Blue Label Co.',
    clientId: 'C004',
    design: 'Tote Bag Full Print',
    summary: 'All-over print design for canvas tote bag with lifestyle illustration.',
    order: 'Artwork',
    project: 'Live',
    complexity: 'Complex',
    process: 'Digital Printing',
    priority: 'Normal',
    etaHours: 12,
    status: 'Sewout',
    stage: 'sewout',
    assignedTo: 'Meena Das',
    subType: 'Senior',
    notes:
      'Illustration elements provided by client. Extend pattern to edges. Bleed required for all-over print.',
    colors: 6,
    created: '2025-04-17 13:15',
    aiScore: null,
  },
  {
    id: 'J-2025-0033',
    ref: '04-16-2025-C001-033',
    client: 'Ravi Textiles',
    clientId: 'C001',
    design: 'Workwear Logo Patch',
    summary: 'Iron-on patch digitizing for workwear uniform program.',
    order: 'Digitizing + Sewout',
    project: 'Live',
    complexity: 'Medium',
    process: null,
    priority: 'Normal',
    etaHours: 7,
    status: 'Dispatched',
    stage: 'delivered',
    assignedTo: 'Arjun Patel',
    subType: 'Senior',
    notes:
      '1000-unit order. Client approved sewout sample. Proceed to bulk.',
    placement: 'Left Chest',
    width: 3.0,
    height: 3.0,
    fabric: 'Twill',
    colors: 3,
    created: '2025-04-16 08:00',
    stitchCount: 9800,
    aiScore: { colour: 93, align: 95, res: 90, brief: 96 },
  },
  {
    id: 'J-2025-0032',
    ref: '04-15-2025-C002-032',
    client: 'Star Garments',
    clientId: 'C002',
    design: 'Kids Cartoon Character Patch',
    summary: 'Embroidered cartoon character for kids clothing line.',
    order: 'Digitizing',
    project: 'Live',
    complexity: 'Super Complex',
    process: null,
    priority: 'Rush',
    etaHours: 11,
    status: 'Dispatched',
    stage: 'delivered',
    assignedTo: 'Kavya Reddy',
    subType: 'Senior',
    notes:
      'Character has 12 colors. Tiny details require fine stitch work. QC pass needed before delivery.',
    placement: 'Back Yoke',
    width: 5.0,
    height: 5.0,
    fabric: 'Cotton Jersey',
    colors: 12,
    created: '2025-04-15 10:00',
    stitchCount: 32600,
    aiScore: { colour: 87, align: 90, res: 88, brief: 91 },
  },
  {
    id: 'J-2025-0031',
    ref: '04-14-2025-C005-031',
    client: 'Urban Threads',
    clientId: 'C005',
    design: 'Seasonal Lookbook Layout',
    summary: 'Multi-page A4 lookbook with lifestyle imagery and product specs.',
    order: 'Artwork',
    project: 'Quote',
    complexity: 'Complex',
    process: 'Offset Printing',
    priority: 'Normal',
    etaHours: 20,
    status: 'Quote Submitted',
    stage: 'quote',
    assignedTo: null,
    subType: null,
    notes:
      '12-page lookbook. Client will supply photography. Need layout, typography, and color grading.',
    colors: 4,
    created: '2025-04-14 15:30',
    aiScore: null,
    clientPrice: 350,
  },
  {
    id: 'J-2025-0030',
    ref: '04-13-2025-C001-030',
    client: 'Ravi Textiles',
    clientId: 'C001',
    design: 'Festival Banner Set',
    summary: 'Three festive banners for retail POS, all with Hindi & English text.',
    order: 'Artwork',
    project: 'Quote',
    complexity: 'Medium',
    process: 'Digital Printing',
    priority: 'Rush',
    etaHours: 8,
    status: 'Quote Submitted',
    stage: 'quote',
    assignedTo: null,
    subType: null,
    notes:
      'Size: 3ft x 6ft each. Keep margins. Use brand crimson and gold palette.',
    colors: 4,
    created: '2025-04-13 10:00',
    aiScore: null,
    clientPrice: 95,
  },
  {
    id: 'J-2025-0029',
    ref: '04-12-2025-C002-029',
    client: 'Star Garments',
    clientId: 'C002',
    design: 'Staff Apron Logo',
    summary: 'Embroidery for 60 aprons with small front chest logo.',
    order: 'Digitizing',
    project: 'Quote',
    complexity: 'Simple',
    process: null,
    priority: 'Normal',
    etaHours: 4,
    status: 'Quote Submitted',
    stage: 'quote',
    assignedTo: null,
    subType: null,
    notes: 'Single color logo on white cotton aprons. Client supply artwork.',
    colors: 1,
    created: '2025-04-12 14:00',
    aiScore: null,
    clientPrice: 45,
  },
  {
    id: 'J-2025-0028',
    ref: '04-11-2025-C003-028',
    client: 'Heritage Caps',
    clientId: 'C003',
    design: 'Trucker Cap Logo Pack',
    summary: 'Flat embroidery for trucker cap front panel — 5 colorways.',
    order: 'Digitizing',
    project: 'Live',
    complexity: 'Medium',
    process: null,
    priority: 'Normal',
    etaHours: 6,
    status: 'In Production',
    stage: 'junior',
    assignedTo: 'Rahul Nair',
    subType: 'Junior',
    notes:
      'Same file, 5 thread colorways. Provide DST for each. 100 units per colorway.',
    placement: 'Front Panel',
    width: 3.5,
    height: 2.5,
    fabric: 'Mesh',
    colors: 5,
    created: '2025-04-11 09:30',
    aiScore: null,
  },
  {
    id: 'J-2025-0027',
    ref: '04-10-2025-C004-027',
    client: 'Blue Label Co.',
    clientId: 'C004',
    design: 'Gym Bag Side Print',
    summary: 'Bold typography side panel artwork for nylon gym bag.',
    order: 'Artwork',
    project: 'Live',
    complexity: 'Simple',
    process: 'Screen Printing',
    priority: 'Normal',
    etaHours: 3,
    status: 'In Production',
    stage: 'junior',
    assignedTo: 'Rahul Nair',
    subType: 'Junior',
    notes:
      'Clean sans-serif layout. Brand colors. 2-color screen print process.',
    colors: 2,
    created: '2025-04-10 11:00',
    aiScore: null,
  },
  {
    id: 'J-2025-0026',
    ref: '04-09-2025-C005-026',
    client: 'Urban Threads',
    clientId: 'C005',
    design: 'Varsity Jacket Patches',
    summary: 'Chenille patch set for varsity jacket — letter, number, star.',
    order: 'Digitizing + Sewout',
    project: 'Live',
    complexity: 'Super Complex',
    process: null,
    priority: 'Super Rush',
    etaHours: 14,
    status: 'In Production',
    stage: 'junior',
    assignedTo: 'Rahul Nair',
    subType: 'Junior',
    notes:
      'Raised chenille effect. Sewout sample mandatory before bulk. 250 units.',
    placement: 'Chest + Sleeve',
    width: 5.0,
    height: 5.0,
    fabric: 'Wool',
    colors: 6,
    created: '2025-04-09 08:00',
    aiScore: null,
  },
  {
    id: 'J-2025-0025',
    ref: '04-08-2025-C001-025',
    client: 'Ravi Textiles',
    clientId: 'C001',
    design: 'Kurta Neckline Embroidery',
    summary: 'Traditional floral embroidery for premium kurta neckline.',
    order: 'Digitizing',
    project: 'Live',
    complexity: 'Super Complex',
    process: null,
    priority: 'Rush',
    etaHours: 10,
    status: 'Senior Review',
    stage: 'senior',
    assignedTo: 'Kavya Reddy',
    subType: 'Senior',
    notes:
      'Intricate floral motif. Use silk-feel thread. Must preserve delicate details. 1000 units.',
    placement: 'Neckline',
    width: 12.0,
    height: 3.0,
    fabric: 'Cotton Silk',
    colors: 7,
    created: '2025-04-08 10:00',
    aiScore: null,
  },
  {
    id: 'J-2025-0024',
    ref: '04-07-2025-C002-024',
    client: 'Star Garments',
    clientId: 'C002',
    design: 'Sports Jersey Number Set',
    summary: 'Back number digitizing for team sports jerseys — numbers 1-25.',
    order: 'Digitizing',
    project: 'Live',
    complexity: 'Medium',
    process: null,
    priority: 'Normal',
    etaHours: 8,
    status: 'Senior Review',
    stage: 'senior',
    assignedTo: 'Arjun Patel',
    subType: 'Senior',
    notes:
      'Numbers 1 through 25. Two-color satin stitch. Consistent sizing across all.',
    placement: 'Back',
    width: 8.0,
    height: 10.0,
    fabric: 'Polyester',
    colors: 2,
    created: '2025-04-07 09:00',
    stitchCount: 8200,
    aiScore: null,
  },
  {
    id: 'J-2025-0023',
    ref: '04-06-2025-C003-023',
    client: 'Heritage Caps',
    clientId: 'C003',
    design: 'Premium Watch Brand Logo',
    summary: 'Precision logo digitizing for leather watch strap stitching.',
    order: 'Digitizing + Sewout',
    project: 'Live',
    complexity: 'Complex',
    process: null,
    priority: 'Rush',
    etaHours: 9,
    status: 'In QC',
    stage: 'qc',
    assignedTo: 'Meena Das',
    subType: 'Senior',
    notes:
      'Micro-scale precision required. Minimum 0.8mm details. Sewout sample approved by client.',
    placement: 'Strap',
    width: 1.5,
    height: 0.8,
    fabric: 'Leather',
    colors: 2,
    created: '2025-04-06 14:30',
    stitchCount: 4200,
    aiScore: { colour: 94, align: 92, res: 96, brief: 95 },
  },
  {
    id: 'J-2025-0022',
    ref: '04-05-2025-C004-022',
    client: 'Blue Label Co.',
    clientId: 'C004',
    design: 'Denim Jacket Back Artwork',
    summary: 'Vintage style back patch graphic for custom denim jacket.',
    order: 'Artwork',
    project: 'Live',
    complexity: 'Complex',
    process: 'Screen Printing',
    priority: 'Normal',
    etaHours: 11,
    status: 'In QC',
    stage: 'qc',
    assignedTo: 'Kavya Reddy',
    subType: 'Senior',
    notes:
      'Distressed vintage texture effect. Must simulate worn-denim look. Screen print on patch fabric.',
    colors: 5,
    created: '2025-04-05 13:00',
    aiScore: { colour: 86, align: 89, res: 84, brief: 88 },
  },
  {
    id: 'J-2025-0021',
    ref: '04-04-2025-C005-021',
    client: 'Urban Threads',
    clientId: 'C005',
    design: 'Pop-Up Store Signage',
    summary: 'Set of 6 retail signage artworks for seasonal pop-up store.',
    order: 'Artwork',
    project: 'Live',
    complexity: 'Medium',
    process: 'Digital Printing',
    priority: 'Super Rush',
    etaHours: 5,
    status: 'Sewout',
    stage: 'sewout',
    assignedTo: 'Arjun Patel',
    subType: 'Senior',
    notes:
      '6 different sign sizes. Client supplied layout mockup. All fonts must be embedded. Print-ready PDF required.',
    colors: 3,
    created: '2025-04-04 09:00',
    aiScore: null,
  },
  {
    id: 'J-2025-0020',
    ref: '04-03-2025-C001-020',
    client: 'Ravi Textiles',
    clientId: 'C001',
    design: 'Trouser Brand Label',
    summary: 'Woven label digitizing for trouser brand tab and inner label.',
    order: 'Digitizing',
    project: 'Live',
    complexity: 'Simple',
    process: null,
    priority: 'Normal',
    etaHours: 4,
    status: 'Sewout',
    stage: 'sewout',
    assignedTo: 'Meena Das',
    subType: 'Senior',
    notes: 'Two label sizes: 25mm main + 15mm tab. Keep under 3000 stitches.',
    placement: 'Inner Waistband',
    width: 2.5,
    height: 1.0,
    fabric: 'Woven Cotton',
    colors: 2,
    created: '2025-04-03 11:30',
    stitchCount: 2800,
    aiScore: null,
  },
  {
    id: 'J-2025-0019',
    ref: '04-02-2025-C002-019',
    client: 'Star Garments',
    clientId: 'C002',
    design: 'Corporate Gift Box Artwork',
    summary: 'Luxury gift box sleeve design for corporate gifting campaign.',
    order: 'Artwork',
    project: 'Live',
    complexity: 'Medium',
    process: 'Offset Printing',
    priority: 'Normal',
    etaHours: 7,
    status: 'Dispatched',
    stage: 'delivered',
    assignedTo: 'Kavya Reddy',
    subType: 'Senior',
    notes:
      'Embossed gold foil on matte black box sleeve. 500 units. Client approved proof.',
    colors: 3,
    created: '2025-04-02 10:00',
    aiScore: { colour: 97, align: 96, res: 94, brief: 98 },
  },
  {
    id: 'J-2025-0018',
    ref: '04-01-2025-C003-018',
    client: 'Heritage Caps',
    clientId: 'C003',
    design: 'Snapback Full Embroidery',
    summary: 'Full front panel premium embroidery with bespoke colorwork.',
    order: 'Digitizing + Sewout',
    project: 'Live',
    complexity: 'Super Complex',
    process: null,
    priority: 'Rush',
    etaHours: 13,
    status: 'Dispatched',
    stage: 'delivered',
    assignedTo: 'Arjun Patel',
    subType: 'Senior',
    notes:
      'Premium finish. 5-color embroidery on structured cap. Sewout sample provided and approved.',
    placement: 'Full Front',
    width: 5.5,
    height: 3.5,
    fabric: 'Wool Blend',
    colors: 5,
    created: '2025-04-01 08:30',
    stitchCount: 24600,
    aiScore: { colour: 92, align: 94, res: 91, brief: 95 },
  },
  {
    id: 'J-2025-0017',
    ref: '03-31-2025-C004-017',
    client: 'Blue Label Co.',
    clientId: 'C004',
    design: 'Kids Range Cartoon Patch',
    summary: 'Fun character patch for kids clothing — 3 character options.',
    order: 'Digitizing',
    project: 'Live',
    complexity: 'Complex',
    process: null,
    priority: 'Normal',
    etaHours: 9,
    status: 'Dispatched',
    stage: 'delivered',
    assignedTo: 'Kavya Reddy',
    subType: 'Senior',
    notes:
      '3 characters, 3 colorways each. Max stitch density for fine details. 800 units total.',
    placement: 'Front Pocket',
    width: 4.0,
    height: 4.0,
    fabric: 'Denim',
    colors: 9,
    created: '2025-03-31 09:00',
    stitchCount: 28900,
    aiScore: { colour: 89, align: 91, res: 87, brief: 90 },
  },
  {
    id: 'J-2025-0016',
    ref: '03-30-2025-C005-016',
    client: 'Urban Threads',
    clientId: 'C005',
    design: 'Raincoat Reflective Strip',
    summary: 'Reflective tape artwork positioning for safety raincoat range.',
    order: 'Artwork',
    project: 'Live',
    complexity: 'Simple',
    process: null,
    priority: 'Normal',
    etaHours: 3,
    status: 'Dispatched',
    stage: 'delivered',
    assignedTo: 'Rahul Nair',
    subType: 'Junior',
    notes:
      'Dimensions must match ISO 20471 standard. Client supply measurements sheet.',
    colors: 1,
    created: '2025-03-30 14:00',
    aiScore: { colour: 99, align: 98, res: 99, brief: 97 },
  },
];

/**
 * Neutral "no preview" placeholder shown when a job carries no real image.
 * The backend job-card has no preview/thumbnail field yet, so rather than
 * inventing random stock photos we render a plain image-icon placeholder.
 */
const NO_IMAGE_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='400' height='300' fill='%23F1F5F9'/%3E%3Cg fill='none' stroke='%23CBD5E1' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='158' y='112' width='84' height='68' rx='7'/%3E%3Ccircle cx='180' cy='136' r='8'/%3E%3Cpath d='M162 176l24-22 16 14 20-18 18 16'/%3E%3C/g%3E%3C/svg%3E";

/**
 * Returns the job's real image at `index` when the backend provides one,
 * otherwise a neutral placeholder. (`width`/`height` are kept for call-site
 * compatibility; the placeholder scales to the element's CSS box.)
 */
export function jobImage(job: Job, index: number, _width?: number, _height?: number): string {
  return job.images?.[index] ?? NO_IMAGE_PLACEHOLDER;
}

export function jobImages(job: Job, count = 3): string[] {
  return Array.from({ length: count }, (_, i) => jobImage(job, i));
}

// ─── Stage-scoped selectors ───────────────────────────────────────

export const byStage = (stage: JobStage) => JOBS.filter((j) => j.stage === stage);
export const byStatus = (status: JobStatus) => JOBS.filter((j) => j.status === status);
export const byAssignee = (name: string) => JOBS.filter((j) => j.assignedTo === name);
export const byClientId = (clientId: string) => JOBS.filter((j) => j.clientId === clientId);
