import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Send, Save, Upload, Check, ArrowRight, ArrowLeft, X, Loader2, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  FinalFileFormat,
  OrderType,
  Placement,
  Priority,
  ProcessType,
  ProjectType,
} from '@contracts';
import { cn } from '@lib/utils';
import { CLIENTS } from '../mocks';

export interface ClientBriefData {
  client_id?: string;
  order_type: OrderType;
  project_type: ProjectType;
  design_name: string;
  eta_hours: number;
  priority?: Priority;
  process_type?: ProcessType;
  num_colors?: number;
  placement?: Placement;
  width_inches?: number;
  height_inches?: number;
  fabric?: string;
  sewout_required?: boolean;
  description: string;
  final_files: FinalFileFormat[];
  billing_address?: string;
  shipping_address?: string;
  cloud_link?: string;
  files: File[];
}

interface CreateJobFormProps {
  mode: 'quote' | 'order';
  onSubmit?: (id: string) => void | Promise<void>;
  onSaveDraft?: (data: Partial<ClientBriefData>) => void | Promise<void>;
  submitting?: boolean;
  savingDraft?: boolean;
}

const ORDER_TYPES = [
  { id: 'artwork', label: 'Artwork', sub: 'Logo, Vector, Illustration', icon: '🎨' },
  { id: 'digitizing', label: 'Digitizing Services', sub: 'Embroidery conversion', icon: '🧵' },
  { id: 'swatches', label: 'Embroidery Digitizing Swatches Only', sub: 'Physical sample review', icon: '🪡' },
  { id: 'extras', label: 'Patches & Extras', sub: 'Custom patches, Name drops', icon: '📦' },
  { id: 'others', label: 'Others', sub: 'Custom request', icon: '✨' },
];

const SPECIFIC_SERVICES: Record<string, string[]> = {
  artwork: [
    'Vector Artwork',
    'Product / Virtual Mock Ups',
    'Cut Contour',
    'Color Separation',
    'Creative Designs',
    'Line Art Conversions',
    'Image Rendering',
    'Color Correction',
    'Brochure Designing',
    'Clipping Path',
    'Channel Mask',
    'Business Card Designs',
    'Packaging Designs',
    'Product Branding',
    'Image Manipulation',
    'Black & White To Color',
  ],
  digitizing: ['Embroidery Digitizing', 'Embroidery Digitizing - Sewout Swatches'],
  swatches: [],
  extras: ['Custom Embroidery Patches', 'Name Drops'],
  others: [],
};

const PRIORITY_ENUM: Record<string, Priority> = {
  Normal: Priority.NORMAL,
  Rush: Priority.RUSH,
  'Super Rush': Priority.SUPER_RUSH,
};

const PROCESS_TYPE_MAP: Record<string, ProcessType> = {
  'Screen Printing': ProcessType.SCREEN_PRINTING,
  'OffSet Printing': ProcessType.OFFSET_PRINTING,
  'Digital Printing': ProcessType.DIGITAL_PRINTING,
  'Engraving': ProcessType.OTHERS,
  'Others': ProcessType.OTHERS,
};

const PLACEMENT_MAP: Record<string, Placement> = {
  'Front Of Cap': Placement.FRONT_OF_CAP,
  'Back Of Cap': Placement.BACK_OF_CAP,
  'Side Of Cap': Placement.SIDE_OF_CAP,
  'Visor': Placement.VISOR,
  'Beenie Cap': Placement.BEANIE_CAP,
  'Towel': Placement.TOWEL,
  'Bags': Placement.BAGS,
  'Left Chest': Placement.LEFT_CHEST,
  'Polo-Sleeve': Placement.SLEEVE,
  'Polo-Pocket': Placement.POCKET,
  'Full Back': Placement.FULL_BACK,
  'Full Front': Placement.FULL_FRONT,
  'Back Yoke': Placement.BACK_YOKE,
  'Others': Placement.OTHER,
};

function toNum(v: FormDataEntryValue | null): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function CreateJobForm({ mode, onSubmit, onSaveDraft, submitting = false, savingDraft = false }: CreateJobFormProps) {
  const isOrder = mode === 'order';
  const [phase, setPhase] = useState<1 | 2>(1);
  const [clientId, setClientId] = useState('');
  const [orderType, setOrderType] = useState('');
  const [specificService, setSpecificService] = useState('');
  const [serviceError, setServiceError] = useState(false);
  const [selectedFormatOption, setSelectedFormatOption] = useState<string>('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmOrderOpen, setConfirmOrderOpen] = useState(false);
  const [confirmOrderText, setConfirmOrderText] = useState('');
  const [pendingOrderData, setPendingOrderData] = useState<ClientBriefData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const placementSectionRef = useRef<HTMLDivElement>(null);
  const [fieldErrors, setFieldErrors] = useState<Set<string>>(new Set());

  function markFieldError(id: string, message: string) {
    setFieldErrors(prev => new Set(prev).add(id));
    toast.error(message, { duration: 7000 });
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }

  function clearFieldError(id: string) {
    setFieldErrors(prev => { const n = new Set(prev); n.delete(id); return n; });
  }

  const hasSelection = orderType !== '';
  const specificServices = orderType ? SPECIFIC_SERVICES[orderType] : [];
  const needsService = specificServices.length > 0;

  const selectedService = useMemo(() => {
    if (orderType === 'others') return 'Others';
    if (orderType === 'swatches') return 'Digitizing Sewout';

    if (orderType === 'extras') {
      return 'Others';
    }

    if (orderType === 'digitizing') {
      if (specificService === 'Embroidery Digitizing - Sewout Swatches' || specificService === 'Digitizing Sewout') {
        return 'Digitizing Sewout';
      }
      return 'Digitizing';
    }

    if (orderType === 'artwork') {
      switch (specificService) {
        case 'Vector Artwork':
        case 'Color Separation':
        case 'Cut Contour':
        case 'Line Art Conversions':
          return 'Vector Artwork';

        case 'Creative Designs':
        case 'Product Branding':
        case 'Illustration':
        case 'Logo Designing':
          return 'Logo Designing';

        case 'Product / Virtual Mock Ups':
        case 'Image Rendering':
        case 'Color Correction':
        case 'Clipping Path':
        case 'Channel Mask':
        case 'Image Manipulation':
        case 'Black & White To Color':
        case 'Virtual Proof':
          return 'Virtual Proof';

        case 'Business Card Designs':
        case 'Business Card':
          return 'Business Card';

        case 'Brochure Designing':
        case 'Brouchers':
          return 'Brouchers';

        case 'Packaging Designs':
        case 'Carton Box Designing':
          return 'Carton Box Designing';

        default:
          return 'Vector Artwork';
      }
    }

    return '';
  }, [orderType, specificService]);

  useEffect(() => {
    setSelectedFormatOption('');
  }, [selectedService]);

  const formatOptions = useMemo(() => {
    if (specificService === 'Custom Embroidery Patches') return [];
    switch (selectedService) {
      case 'Vector Artwork':
      case 'Business Card':
      case 'Brouchers':
      case 'Logo Designing':
      case 'Carton Box Designing':
      case 'Others':
        return [
          'PDF, EPS',
          'PDF, AI',
          'PDF, EPS, AI',
          'PDF, CDR',
          'PDF, EPS, CDR',
          'PDF, EPS, AI, CDR',
          'OTHERS',
        ];
      case 'Digitizing':
      case 'Digitizing Sewout':
        return [
          'PDF, DST',
          'DST, PDF, EMB',
          'DST, PDF, PXF',
          'DST, PDF, CND, EXP',
          'DST, PDF, CND, EXP, EMB',
          'OTHERS',
        ];
      case 'Virtual Proof':
        return ['JPEG', 'SVG', 'PDF', 'TIFF', 'OTHERS'];
      default:
        return [];
    }
  }, [selectedService, specificService]);

  function selectOrder(id: string) {
    setOrderType(id);
    setSpecificService('');
    setServiceError(false);
    setSelectedFormatOption('');
    const services = SPECIFIC_SERVICES[id] ?? [];
    if (services.length === 0) {
      if (id === 'swatches') {
        setSpecificService('Digitizing Sewout');
      } else if (id === 'others' || id === 'extras') {
        setSpecificService('Others');
      }
    }
  }

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const picked = Array.from(list);
    setFiles((prev) => [...prev, ...picked]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const previews = useMemo(
    () => files.map((f) => (f.type.startsWith('image/') ? URL.createObjectURL(f) : null)),
    [files],
  );
  useEffect(
    () => () => previews.forEach((url) => url && URL.revokeObjectURL(url)),
    [previews],
  );

  function goToPhase2() {
    if (!clientId) {
      toast.error('Please select or enter a client.');
      return;
    }
    if (!hasSelection) {
      toast.error('Please select a service type to continue.');
      return;
    }
    if (needsService && !specificService) {
      toast.error('Please select a specific service to continue.');
      setServiceError(true);
      setTimeout(() => setServiceError(false), 2000);
      return;
    }
    setPhase(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goToPhase1() {
    setPhase(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resolveOrderType(service: string): OrderType {
    if (service === 'Digitizing Sewout') return OrderType.DIGITIZING_SEWOUT;
    if (service === 'Digitizing') return OrderType.DIGITIZING;
    if (service === 'Others') return OrderType.OTHERS;
    return OrderType.ARTWORK;
  }

  function resetForm(form: HTMLFormElement) {
    form.reset();
    setPhase(1);
    setClientId('');
    setOrderType('');
    setSpecificService('');
    setSelectedFormatOption('');
    setFiles([]);
    setError(null);
    setFieldErrors(new Set());
  }

  async function handleSaveDraft() {
    if (!onSaveDraft || !formRef.current) return;
    const fd = new FormData(formRef.current);

    const designName = String(fd.get('design') ?? '').trim() || 'Draft';
    const brief = String(fd.get('brief') ?? '').trim();
    const priorityLabel = String(fd.get('priority') ?? '');
    const cloudLink = String(fd.get('cloud_link') ?? '').trim();

    const order_type = resolveOrderType(selectedService);

    const finalFiles = (() => {
      if (!selectedFormatOption || selectedFormatOption === 'OTHERS') return [FinalFileFormat.OTHERS];
      const mapped: FinalFileFormat[] = [];
      selectedFormatOption.split(',').map(s => s.trim()).forEach(part => {
        if (part === 'PDF') mapped.push(FinalFileFormat.PDF);
        else if (part === 'EPS') mapped.push(FinalFileFormat.EPS);
        else if (part === 'AI') mapped.push(FinalFileFormat.AI);
        else if (part === 'CDR') mapped.push(FinalFileFormat.CDR);
        else mapped.push(FinalFileFormat.OTHERS);
      });
      return mapped.length > 0 ? mapped : [FinalFileFormat.OTHERS];
    })();

    const data: Partial<ClientBriefData> = {
      client_id: clientId !== 'new' ? clientId : undefined,
      order_type,
      project_type: isOrder ? ProjectType.LIVE : ProjectType.QUOTE,
      design_name: designName,
      eta_hours: 24,
      ...(brief ? { description: brief } : {}),
      final_files: finalFiles,
      ...(PRIORITY_ENUM[priorityLabel] ? { priority: PRIORITY_ENUM[priorityLabel] } : {}),
      ...(cloudLink ? { cloud_link: cloudLink } : {}),
      files,
    };

    const processVal = String(fd.get('process_type') ?? '');
    if (processVal && PROCESS_TYPE_MAP[processVal]) data.process_type = PROCESS_TYPE_MAP[processVal];

    const placementLabel = String(fd.get('placement') ?? '');
    if (PLACEMENT_MAP[placementLabel]) data.placement = PLACEMENT_MAP[placementLabel];

    const numColors = Number(fd.get('colors'));
    if (!Number.isNaN(numColors) && numColors > 0) data.num_colors = numColors;

    if (order_type === OrderType.DIGITIZING || order_type === OrderType.DIGITIZING_SEWOUT) {
      data.sewout_required = order_type === OrderType.DIGITIZING_SEWOUT;
      const w = toNum(fd.get('width'));
      const h = toNum(fd.get('height'));
      if (w != null) data.width_inches = w;
      if (h != null) data.height_inches = h;
    }

    const fabric = String(fd.get('fabric') ?? '').trim();
    if (fabric && order_type !== OrderType.OTHERS) data.fabric = fabric;

    await onSaveDraft(data);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const fd = new FormData(e.currentTarget);

    if (!clientId) { toast.error('Client selection is missing.'); return; }

    const designName = String(fd.get('design') ?? '').trim();
    const brief = String(fd.get('brief') ?? '').trim();
    const turnaround = toNum(fd.get('eta')) ?? 24;
    const priorityLabel = String(fd.get('priority') ?? '');

    const isColorSeparation = specificService === 'Color Separation';
    const isEmbroideryPatches = specificService === 'Custom Embroidery Patches';

    if (!designName) { markFieldError('design', 'Please enter a design name to continue.'); return; }
    if (!priorityLabel) { markFieldError('priority', 'Please select a priority to continue.'); return; }
    if (!brief) { markFieldError('brief', 'Please add a description for your request.'); return; }
    if (isColorSeparation) {
      const colorsVal = Number(fd.get('colors'));
      if (!colorsVal || colorsVal < 1) { markFieldError('colors', 'Number of Colors is required for Color Separation.'); return; }
    } else if (!isEmbroideryPatches && !selectedFormatOption) {
      markFieldError('format-group', 'Please select an expected output file format.');
      return;
    }

    if (selectedFormatOption === 'OTHERS') {
      const otherFormatVal = String(fd.get('format_other') ?? '').trim();
      if (!otherFormatVal) { markFieldError('format_other', 'Please specify your custom output format.'); return; }
    }

    if (selectedService === 'Logo Designing') {
      const fontStyle = String(fd.get('preferable_font_style') ?? '').trim();
      if (!fontStyle) { markFieldError('preferable_font_style', 'Please enter a preferable font style.'); return; }
      const ageGroup = String(fd.get('age_group_audience') ?? '').trim();
      if (!ageGroup) { markFieldError('age_group_audience', 'Please enter the age group / audience.'); return; }
    }

    if (selectedService === 'Carton Box Designing') {
      const flips = toNum(fd.get('num_flips'));
      if (flips == null || flips < 1) { markFieldError('num_flips', 'Please enter the number of flips.'); return; }
    }

    const order_type = resolveOrderType(selectedService);
    const cloudLink = String(fd.get('cloud_link') ?? '').trim();

    setError(null);
    setFieldErrors(new Set());

    const data: ClientBriefData = {
      client_id: clientId !== 'new' ? clientId : undefined,
      order_type,
      project_type: isOrder ? ProjectType.LIVE : ProjectType.QUOTE,
      design_name: designName,
      eta_hours: turnaround,
      description: (() => {
        let desc = brief;

        if (clientId === 'new') {
          const newClientName = String(fd.get('newClientName') ?? '').trim();
          const newClientCompany = String(fd.get('newClientCompany') ?? '').trim();
          const newClientContact = String(fd.get('newClientContact') ?? '').trim();
          const newClientEmail = String(fd.get('newClientEmail') ?? '').trim();
          desc += `\n\n[New Client: ${newClientName} | ${newClientCompany} | ${newClientContact} | ${newClientEmail}]`;
        }

        desc += `\n\n[Service Type: ${selectedService}]`;
        if (specificService && specificService !== selectedService) {
          desc += `\n[Specific Service: ${specificService}]`;
        }

        if (selectedFormatOption) {
          let formatText = selectedFormatOption;
          if (selectedFormatOption === 'OTHERS') {
            const otherFormatVal = String(fd.get('format_other') ?? '').trim();
            if (otherFormatVal) {
              formatText = `Others: ${otherFormatVal}`;
            }
          }
          desc += `\n[Expected Output Format: ${formatText}]`;
        }

        const processVal = fd.get('process_type');
        if (processVal) {
          desc += `\n[Process Type: ${processVal}]`;
        }

        const madeiraVal = fd.get('madeira_threads');
        if (madeiraVal) {
          desc += `\n[Do you wish Madeira threads: ${madeiraVal === 'yes' ? 'Yes' : 'No'}]`;
        }

        const colorModeVal = fd.get('color_mode');
        if (colorModeVal) {
          desc += `\n[Color Mode: ${colorModeVal}]`;
        }

        const layoutVal = fd.get('preferable_layout');
        if (layoutVal) {
          desc += `\n[Preferable Layout: ${layoutVal}]`;
        }

        const sidesVal = fd.get('num_sides');
        if (sidesVal) {
          desc += `\n[Number of Sides: ${sidesVal}]`;
        }

        const pagesVal = fd.get('num_pages');
        if (pagesVal) {
          desc += `\n[Number of Pages: ${pagesVal}]`;
        }

        const fontStyleVal = fd.get('preferable_font_style');
        if (fontStyleVal) {
          desc += `\n[Preferable Font Style: ${fontStyleVal}]`;
        }

        const ageGroupVal = fd.get('age_group_audience');
        if (ageGroupVal) {
          desc += `\n[Age Group / Audience: ${ageGroupVal}]`;
        }

        const prefColorsVal = fd.get('preferable_colors');
        if (prefColorsVal) {
          desc += `\n[Preferable Colors: ${prefColorsVal}]`;
        }

        const shapesVal = fd.get('preferable_shapes');
        if (shapesVal) {
          desc += `\n[Preferable Shapes: ${shapesVal}]`;
        }

        const flipsVal = fd.get('num_flips');
        if (flipsVal) {
          desc += `\n[Number of Flips: ${flipsVal}]`;
        }

        return desc;
      })(),
      final_files: (() => {
        const option = selectedFormatOption;
        if (!option || option === 'OTHERS') {
          return [FinalFileFormat.OTHERS];
        }

        const mapped: FinalFileFormat[] = [];
        const parts = option.split(',').map(s => s.trim());
        parts.forEach(part => {
          if (part === 'PDF') mapped.push(FinalFileFormat.PDF);
          else if (part === 'EPS') mapped.push(FinalFileFormat.EPS);
          else if (part === 'AI') mapped.push(FinalFileFormat.AI);
          else if (part === 'CDR') mapped.push(FinalFileFormat.CDR);
          else mapped.push(FinalFileFormat.OTHERS);
        });

        return mapped.length > 0 ? mapped : [FinalFileFormat.OTHERS];
      })(),
      ...(PRIORITY_ENUM[priorityLabel] ? { priority: PRIORITY_ENUM[priorityLabel] } : {}),
      ...(toNum(fd.get('colors')) != null ? { num_colors: toNum(fd.get('colors')) } : {}),
      ...(cloudLink ? { cloud_link: cloudLink } : {}),
      ...(String(fd.get('billing_address') ?? '').trim() ? { billing_address: String(fd.get('billing_address')).trim() } : {}),
      ...(String(fd.get('shipping_address') ?? '').trim() ? { shipping_address: String(fd.get('shipping_address')).trim() } : {}),
      files,
    };

    const processVal = String(fd.get('process_type') ?? '');
    if (processVal && PROCESS_TYPE_MAP[processVal]) {
      data.process_type = PROCESS_TYPE_MAP[processVal];
    }

    const placementLabel = String(fd.get('placement') ?? '');
    const isEmbDigitizingService = specificService === 'Embroidery Digitizing' || specificService === 'Embroidery Digitizing - Sewout Swatches';
    if (isEmbDigitizingService) {
      const wVal = toNum(fd.get('width'));
      const hVal = toNum(fd.get('height'));
      const hasPlacement = !!PLACEMENT_MAP[placementLabel];
      const hasWidth = wVal != null;
      const hasHeight = hVal != null;

      const scrollToSection = () => {
        placementSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };

      if (hasWidth && !hasHeight) {
        setFieldErrors(prev => new Set(prev).add('height'));
        toast.error('You entered a width — please also fill in the height to complete the dimensions.', { duration: 7000 });
        scrollToSection();
        return;
      }
      if (hasHeight && !hasWidth) {
        setFieldErrors(prev => new Set(prev).add('width'));
        toast.error('You entered a height — please also fill in the width to complete the dimensions.', { duration: 7000 });
        scrollToSection();
        return;
      }
      if (!hasPlacement && !(hasWidth && hasHeight)) {
        setFieldErrors(prev => { const n = new Set(prev); n.add('placement'); n.add('width'); n.add('height'); return n; });
        toast.error('Please choose one: select a Placement, or enter both Width & Height.', { duration: 7000 });
        scrollToSection();
        return;
      }
    }

    if (specificService === 'Custom Embroidery Patches') {
      const billing = String(fd.get('billing_address') ?? '').trim();
      const shipping = String(fd.get('shipping_address') ?? '').trim();
      if (!billing) { markFieldError('billing_address', 'Please enter a billing address.'); return; }
      if (!shipping) { markFieldError('shipping_address', 'Please enter a shipping address.'); return; }
    }

    if (PLACEMENT_MAP[placementLabel]) {
      data.placement = PLACEMENT_MAP[placementLabel];
    }

    if (order_type === OrderType.DIGITIZING || order_type === OrderType.DIGITIZING_SEWOUT) {
      data.sewout_required = order_type === OrderType.DIGITIZING_SEWOUT;

      const width = toNum(fd.get('width'));
      const height = toNum(fd.get('height'));
      if (width != null) data.width_inches = width;
      if (height != null) data.height_inches = height;
    }

    if (order_type !== OrderType.OTHERS) {
      const fabric = String(fd.get('fabric') ?? '').trim();
      if (fabric) data.fabric = fabric;
    }

    if (isOrder) {
      setPendingOrderData(data);
      setConfirmOrderOpen(true);
    } else {
      toast.success('Quote request submitted');
      const newId = `Q-2025-${String(80 + Math.floor(Math.random() * 50)).padStart(4, '0')}`;
      if (onSubmit) {
        await onSubmit(newId);
      }
      resetForm(e.currentTarget);
    }
  }

  async function handleConfirmedOrder() {
    if (!pendingOrderData) return;
    setConfirmOrderOpen(false);
    setConfirmOrderText('');
    toast.success('Order submitted');
    const newId = `J-2025-${String(50 + Math.floor(Math.random() * 50)).padStart(4, '0')}`;
    if (onSubmit) {
      await onSubmit(newId);
    }
    if (formRef.current) {
      resetForm(formRef.current);
    }
    setPendingOrderData(null);
  }

  return (
    <>
    <form ref={formRef} onSubmit={handleSubmit} className="max-w-[920px] mx-auto">
      <div className="qf-card">
        {/* ── Phase stepper ─────────────────────────────────────── */}
        <div className="form-phase-stepper">
          <div className="fps-title-block">
            {phase === 2 && (specificService || selectedService) ? (
              <>
                <span className="fps-mode-label">{specificService || selectedService}</span>
                <span className="fps-service-label">
                  {ORDER_TYPES.find((t) => t.id === orderType)?.label ?? ''}
                </span>
              </>
            ) : (
              <span className="fps-mode-label">
                {isOrder ? 'Place New Order' : 'Request Quote'}
              </span>
            )}
            </div>

            <div className="fps-right-col">
              <div className="fps-tracker">
                <div className={cn('fps-step', phase === 1 && 'active', phase === 2 && 'done')}>
                  <div className="fps-num">
                    {phase === 2 ? <Check className="w-3 h-3" strokeWidth={3} aria-hidden /> : '1'}
                  </div>
                  <span>Client &amp; Service</span>
                </div>
                <div className={cn('fps-connector', phase === 2 && 'done')} />
                <div className={cn('fps-step', phase === 2 && 'active')}>
                  <div className="fps-num">2</div>
                  <span>Job Details</span>
                </div>
              </div>
              <div className="fps-required-note">
                All fields marked <span style={{ color: 'var(--color-crimson)', margin: '0 2px' }}>*</span> are required
              </div>
            </div>
          </div>

          <div className="qf-body">
            {/* ── PHASE 1 — Client & Service Type ──────────────────────────── */}
            {phase === 1 && (
              <div className="qf-section" style={{ borderBottom: 'none', marginBottom: 0 }}>
                {/* Client Details Section */}
                <div className="qf-section-header" style={{ marginBottom: '20px' }}>
                  <div className="qf-step-num">A</div>
                  <span className="qf-section-title">Client Details</span>
                </div>
                
                <div style={{ marginBottom: '30px' }}>
                  <label className="fl">Select Existing Client <span style={{ color: '#c41e3a' }}>*</span></label>
                  <select
                    className="fi mb-2.5"
                    value={clientId}
                    onChange={(e) => {
                      setClientId(e.target.value);
                      setError(null);
                    }}
                    style={!clientId && fieldErrors.has('client') ? { borderColor: 'var(--color-crimson)' } : undefined}
                  >
                    <option value="">— Search or select an existing client —</option>
                    {CLIENTS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company} — {c.name} ({c.id})
                      </option>
                    ))}
                    <option value="new">+ Enter New Client</option>
                  </select>

                  {clientId === 'new' ? (
                    <div
                      style={{
                        background: 'rgba(196,30,58,0.04)',
                        border: '1px dashed rgba(196,30,58,0.25)',
                        borderRadius: 10,
                        padding: 16,
                      }}
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-crimson mb-3">
                        New Client Information
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Field name="newClientName" label="Client Name *" placeholder="e.g. Ravi Kumar" />
                        <Field name="newClientCompany" label="Company Name *" placeholder="e.g. Ravi Textiles" />
                        <Field name="newClientContact" label="Contact Number" placeholder="+91 98765 43210" />
                        <Field name="newClientEmail" label="Email Address" type="email" placeholder="client@company.com" />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="qf-section-header">
                  <div className="qf-step-num">B</div>
                  <span className="qf-section-title">
                    {isOrder ? 'Place New Order' : 'New Quote Request'} — Select Service Type
                  </span>
                </div>

                <div className="qf-order-grid">
                  {ORDER_TYPES.map(({ id, label, sub, icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => selectOrder(id)}
                      className={cn('qf-order-card', orderType === id && 'active')}
                      aria-pressed={orderType === id}
                    >
                      <span className="qf-order-icon">{icon}</span>
                      <div className="qf-order-label">{label}</div>
                      <div className="qf-order-sub">{sub}</div>
                    </button>
                  ))}
                </div>

                {hasSelection && needsService && (
                  <div style={{ marginTop: 20 }}>
                    <label className="fl" htmlFor="service">
                      SPECIFIC SERVICE <span style={{ color: '#c41e3a' }}>*</span>
                    </label>
                    <select
                      id="service"
                      name="service"
                      className="fi"
                      value={specificService}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSpecificService(value);
                      }}
                      style={serviceError ? { borderColor: 'var(--color-crimson)' } : undefined}
                    >
                      <option value="" disabled>
                        Select specific service...
                      </option>
                      {specificServices.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="phase-nav" style={{ marginTop: 28 }}>
                  <button type="button" className="btn btn-navy" onClick={goToPhase2}>
                    Continue to Job Details
                    <ArrowRight aria-hidden className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* ── PHASE 2 — Job Details ───────────────────────────── */}
            {phase === 2 && (
              <>
                <div className="qf-section">
                  <div className="qf-section-header">
                    <div className="qf-step-num">2</div>
                    <span className="qf-section-title">Job Details</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <Field name="design" label="DESIGN NAME" required placeholder=" " fieldError={fieldErrors.has('design')} onChange={() => clearFieldError('design')} />

                    <Field
                      name="client_po"
                      label="CLIENT PO / REFERENCE NO."
                      placeholder=" "
                    />

                    <Field
                      name="eta"
                      label="ESTIMATED TURNAROUND (HOURS) *"
                      type="number"
                      min={2}
                      defaultValue={24}
                      placeholder="e.g. 24"
                    />

                    {(selectedService === 'Vector Artwork' ||
                      selectedService === 'Business Card' ||
                      selectedService === 'Brouchers' ||
                      selectedService === 'Logo Designing' ||
                      selectedService === 'Carton Box Designing') && (
                        <div>
                          <label className="fl" htmlFor="process_type">
                            PROCESS TYPE <span style={{ color: '#c41e3a' }}>*</span>
                          </label>
                          <select id="process_type" name="process_type" className="fi" defaultValue="" required>
                            <option value="" disabled>Select process type</option>
                            <option value="Screen Printing">Screen Printing</option>
                            <option value="OffSet Printing">OffSet Printing</option>
                            <option value="Digital Printing">Digital Printing</option>
                            <option value="Engraving">Engraving</option>
                            <option value="Others">Others</option>
                          </select>
                        </div>
                      )}

                    {selectedService === 'Digitizing Sewout' && (
                      <div>
                        <label className="fl" htmlFor="madeira_threads">
                          DO YOU WISH MADEIRA THREADS <span style={{ color: '#c41e3a' }}>*</span>
                        </label>
                        <select id="madeira_threads" name="madeira_threads" className="fi" defaultValue="" required>
                          <option value="" disabled>Select option</option>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      </div>
                    )}

                    {(selectedService === 'Digitizing' || selectedService === 'Digitizing Sewout') && (
                      <Field
                        name="fabric"
                        label="FABRIC"
                        required={specificService !== 'Embroidery Digitizing' && specificService !== 'Embroidery Digitizing - Sewout Swatches'}
                        placeholder="e.g. Cotton, Polyester, Denim"
                      />
                    )}

                    {(selectedService === 'Digitizing' ||
                      selectedService === 'Digitizing Sewout' ||
                      (selectedService === 'Virtual Proof' && specificService === 'Product / Virtual Mock Ups')) && (
                        <div ref={placementSectionRef}>
                          <label className="fl" htmlFor="placement">
                            SELECT PLACEMENT
                            {(specificService === 'Embroidery Digitizing' || specificService === 'Embroidery Digitizing - Sewout Swatches') && (
                              <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4, fontSize: '11px' }}>(or fill width &amp; height)</span>
                            )}
                          </label>
                          <select
                            id="placement"
                            name="placement"
                            className="fi"
                            defaultValue=""
                            onChange={() => clearFieldError('placement')}
                            style={fieldErrors.has('placement') ? { borderColor: 'var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.25)' } : undefined}
                          >
                            <option value="" disabled>Select placement</option>
                            <optgroup label="CAP">
                              <option value="Front Of Cap">Front Of Cap</option>
                              <option value="Back Of Cap">Back Of Cap</option>
                              <option value="Side Of Cap">Side Of Cap</option>
                              <option value="Visor">Visor</option>
                              <option value="Beenie Cap">Beenie Cap</option>
                            </optgroup>
                            <optgroup label="TOWEL">
                              <option value="Towel">Towel</option>
                            </optgroup>
                            <optgroup label="BAGS">
                              <option value="Bags">Bags</option>
                            </optgroup>
                            <optgroup label="POLO">
                              <option value="Left Chest">Left Chest</option>
                              <option value="Polo-Sleeve">Polo-Sleeve</option>
                              <option value="Polo-Pocket">Polo-Pocket</option>
                              <option value="Full Back">Full Back</option>
                              <option value="Full Front">Full Front</option>
                              <option value="Back Yoke">Back Yoke</option>
                            </optgroup>
                            <optgroup label="OTHERS">
                              <option value="Others">Others</option>
                            </optgroup>
                          </select>
                        </div>
                      )}

                    {(selectedService === 'Digitizing' || selectedService === 'Digitizing Sewout') && (
                      <>
                        <Field
                          name="width"
                          label="WIDTH (INCHES)"
                          type="number"
                          step="0.1"
                          min={0.1}
                          placeholder="e.g. 3.5"
                          fieldError={fieldErrors.has('width')}
                          onChange={() => clearFieldError('width')}
                        />
                        <Field
                          name="height"
                          label="HEIGHT (INCHES)"
                          type="number"
                          step="0.1"
                          min={0.1}
                          placeholder="e.g. 2.5"
                          fieldError={fieldErrors.has('height')}
                          onChange={() => clearFieldError('height')}
                        />
                      </>
                    )}

                    {selectedService === 'Business Card' && (
                      <>
                        <div>
                          <label className="fl" htmlFor="color_mode">
                            COLOR MODE
                          </label>
                          <select id="color_mode" name="color_mode" className="fi" defaultValue="">
                            <option value="" disabled>Select color mode</option>
                            <option value="CMYK">CMYK</option>
                            <option value="RGB">RGB</option>
                            <option value="PANTONE">PANTONE</option>
                          </select>
                        </div>
                        <Field
                          name="preferable_layout"
                          label="PREFERABLE LAYOUT"
                          placeholder="e.g. Horizontal, Vertical"
                        />
                        <Field
                          name="num_sides"
                          label="NUMBER OF SIDES"
                          type="number"
                          min={1}
                          placeholder="e.g. 2"
                        />
                      </>
                    )}

                    {selectedService === 'Brouchers' && (
                      <Field
                        name="num_pages"
                        label="NUMBER OF PAGES"
                        type="number"
                        min={1}
                        placeholder="e.g. 4"
                      />
                    )}

                    {selectedService === 'Logo Designing' && (
                      <>
                        <Field
                          name="preferable_font_style"
                          label="PREFERABLE FONT STYLE"
                          required
                          placeholder="e.g. Modern, Serif, Script"
                          fieldError={fieldErrors.has('preferable_font_style')}
                          onChange={() => clearFieldError('preferable_font_style')}
                        />
                        <Field
                          name="age_group_audience"
                          label="AGE GROUP / AUDIENCE"
                          required
                          placeholder="e.g. Teens, Professionals, General"
                          fieldError={fieldErrors.has('age_group_audience')}
                          onChange={() => clearFieldError('age_group_audience')}
                        />
                        <Field
                          name="preferable_colors"
                          label="PREFERABLE COLORS"
                          placeholder="e.g. Blue and Silver"
                        />
                        <div>
                          <label className="fl" htmlFor="preferable_shapes">
                            PREFERABLE SHAPES
                          </label>
                          <select
                            id="preferable_shapes"
                            name="preferable_shapes"
                            className="fi"
                            defaultValue=""
                          >
                            <option value="" disabled>Select shape</option>
                            {[
                              'Square', 'Rectangle', 'Circle', 'Ellipse', 'Rhombus',
                              'Parallelogram', 'Trapezoid', 'Kite', 'Equilateral Triangle',
                              'Isosceles Triangle', 'Scalene Triangle', 'Right Triangle',
                              'Regular Pentagon', 'Regular Hexagon', 'Regular Octagon',
                              'Regular Decagon'
                            ].map((shape) => (
                              <option key={shape} value={shape}>{shape}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    {selectedService === 'Carton Box Designing' && (
                      <Field
                        name="num_flips"
                        label="NUMBER OF FLIPS"
                        required
                        type="number"
                        min={1}
                        placeholder="e.g. 4"
                        fieldError={fieldErrors.has('num_flips')}
                        onChange={() => clearFieldError('num_flips')}
                      />
                    )}

                    {selectedService !== 'Others' && (
                      <Field
                        name="colors"
                        label="NUMBER OF COLORS"
                        required={specificService === 'Color Separation'}
                        type="number"
                        min={1}
                        max={20}
                        placeholder=" "
                        fieldError={fieldErrors.has('colors')}
                        onChange={() => clearFieldError('colors')}
                      />
                    )}

                    <div>
                      <label className="fl" htmlFor="priority">
                        PRIORITY <span style={{ color: '#c41e3a' }}>*</span>
                      </label>
                      <select id="priority" name="priority" className="fi" defaultValue="" onChange={() => clearFieldError('priority')} style={fieldErrors.has('priority') ? { borderColor: 'var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.25)' } : undefined}>
                        <option value="" disabled>Select priority</option>
                        {['Normal', 'Rush', 'Super Rush'].map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="fl" htmlFor="brief">
                      Description <span style={{ color: '#c41e3a' }}>*</span>
                    </label>
                    <textarea
                      id="brief"
                      name="brief"
                      className="fi fi-ta"
                      style={{ minHeight: 220, ...(fieldErrors.has('brief') ? { borderColor: 'var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.25)' } : {}) }}
                      placeholder=" "
                      onChange={() => clearFieldError('brief')}
                    />
                  </div>

                  {specificService === 'Custom Embroidery Patches' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="fl" htmlFor="billing_address">
                          BILLING ADDRESS <span style={{ color: '#c41e3a' }}>*</span>
                        </label>
                        <textarea
                          id="billing_address"
                          name="billing_address"
                          className="fi fi-ta"
                          style={{ minHeight: 100, ...(fieldErrors.has('billing_address') ? { borderColor: 'var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.25)' } : {}) }}
                          placeholder="Name, Street, City, State, ZIP, Country"
                          onChange={() => clearFieldError('billing_address')}
                        />
                      </div>
                      <div>
                        <label className="fl" htmlFor="shipping_address">
                          SHIPPING ADDRESS <span style={{ color: '#c41e3a' }}>*</span>
                        </label>
                        <textarea
                          id="shipping_address"
                          name="shipping_address"
                          className="fi fi-ta"
                          style={{ minHeight: 100, ...(fieldErrors.has('shipping_address') ? { borderColor: 'var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.25)' } : {}) }}
                          placeholder="Name, Street, City, State, ZIP, Country"
                          onChange={() => clearFieldError('shipping_address')}
                        />
                      </div>
                    </div>
                  )}

                  {formatOptions.length > 0 && (
                    <div id="format-group" style={fieldErrors.has('format-group') ? { padding: '8px', borderRadius: '8px', border: '1px solid var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.25)' } : undefined}>
                      <label className="fl">
                        EXPECTED OUTPUT FILE FORMATS {specificService !== 'Color Separation' && <span style={{ color: '#c41e3a' }}>*</span>}
                      </label>
                      <div
                        className="flex flex-wrap gap-2 mt-2"
                        role="radiogroup"
                        aria-label="Expected output file formats"
                      >
                        {formatOptions.map((opt) => {
                          const active = selectedFormatOption === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              onClick={() => { setSelectedFormatOption(opt); clearFieldError('format-group'); }}
                              className={cn(
                                'flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold tracking-wide transition select-none cursor-pointer',
                                active ? 'text-white' : 'text-text-muted hover:text-text',
                              )}
                              style={{
                                border: `1px solid ${active ? 'var(--color-crimson)' : 'var(--glass-border)'}`,
                                background: active ? 'rgba(196,30,58,0.18)' : 'rgba(255,255,255,0.04)',
                              }}
                            >
                              <span
                                className="flex-shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                                style={{ border: `2px solid ${active ? 'var(--color-crimson)' : 'var(--glass-border)'}` }}
                                aria-hidden
                              >
                                {active && <span className="w-1.5 h-1.5 rounded-full block" style={{ background: 'var(--color-crimson)' }} />}
                              </span>
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                      {selectedFormatOption === 'OTHERS' && (
                        <input
                          id="format_other"
                          className="fi mt-3"
                          name="format_other"
                          placeholder="Please specify format (e.g. DST, PXF, AI, CDR)"
                          autoFocus
                          style={fieldErrors.has('format_other') ? { borderColor: 'var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.25)' } : undefined}
                          onChange={() => clearFieldError('format_other')}
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* ── Section 3 — Upload Reference Files ─────────────── */}
                <div className="qf-section" style={{ borderBottom: 'none', marginBottom: 0 }}>
                  <div className="qf-section-header">
                    <div className="qf-step-num">3</div>
                    <span className="qf-section-title">Upload Reference Files</span>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  <div
                    className="qf-upload-zone cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      addFiles(e.dataTransfer.files);
                    }}
                  >
                    <div className="qf-upload-icon-wrap">
                      <Upload className="w-5 h-5" aria-hidden style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <p className="qf-upload-label">
                      Drop files here or <span className="qf-upload-browse">browse</span>
                    </p>
                    <p className="qf-upload-hint">
                      PDF, AI, PSD, PNG, SVG, JPG, DST, EMB — max 500 MB per file
                    </p>
                  </div>

                  {files.length > 0 && (
                    <ul className="flex flex-col gap-1.5 mt-3">
                      {files.map((f, i) => (
                        <li
                          key={`${f.name}-${i}`}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 text-[12.5px]"
                          style={{ background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)' }}
                        >
                          {previews[i] ? (
                            <img
                              src={previews[i] as string}
                              alt={f.name}
                              className="w-10 h-10 rounded-md object-cover shrink-0"
                              style={{ border: '1px solid var(--glass-border)' }}
                            />
                          ) : (
                            <span
                              className="w-10 h-10 rounded-md shrink-0 flex items-center justify-center"
                              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}
                              aria-hidden
                            >
                              <FileText className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                            </span>
                          )}
                          <span className="flex-1 min-w-0 truncate text-text-main">{f.name}</span>
                          <button
                            type="button"
                            className="text-text-faint hover:text-crimson transition shrink-0"
                            aria-label={`Remove ${f.name}`}
                            onClick={() => removeFile(i)}
                          >
                            <X className="w-3.5 h-3.5" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-3">
                    <label className="fl">
                      OR LINK TO CLOUD STORAGE (GOOGLE DRIVE, WETRANSFER, DROPBOX)
                    </label>
                    <input type="url" name="cloud_link" className="fi" placeholder="https://drive.google.com/..." />
                    <p className="qf-cloud-hint">
                      Use this if your files are too large to upload directly or you prefer sharing from cloud storage.
                    </p>
                  </div>
                </div>

                {error && (
                  <div
                    className="text-[12px] mt-4 px-3 py-2 rounded-md"
                    style={{ background: 'rgba(196,30,58,0.08)', color: '#c41e3a' }}
                    role="alert"
                  >
                    {error}
                  </div>
                )}

                {/* ── Footer nav: Back · Save Draft · Submit ─────────── */}
                <div className="flex items-center justify-between gap-2.5 flex-wrap pt-1 mt-4">
                  <button type="button" className="btn btn-outline" onClick={goToPhase1}>
                    <ArrowLeft aria-hidden className="w-3.5 h-3.5" />
                    Back
                  </button>
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      className="btn btn-outline disabled:opacity-60"
                      onClick={handleSaveDraft}
                      disabled={savingDraft || !onSaveDraft}
                    >
                      {savingDraft ? (
                        <Loader2 aria-hidden className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save aria-hidden className="w-4 h-4" />
                      )}
                      {savingDraft ? 'Saving...' : 'Save Draft'}
                    </button>
                    <button type="submit" className="btn btn-navy disabled:opacity-60" disabled={submitting}>
                      {submitting ? (
                        <Loader2 aria-hidden className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send aria-hidden className="w-4 h-4" />
                      )}
                      {isOrder ? 'Submit Order' : 'Submit Quote Request'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </form>

    {/* Confirm Order dialog — order mode only, requires typing "confirm" */}
    {confirmOrderOpen && pendingOrderData && (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center px-4"
        style={{
          background: 'rgba(3, 6, 15, 0.78)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
        onClick={(e) => { if (e.target === e.currentTarget && !submitting) { setConfirmOrderOpen(false); setConfirmOrderText(''); } }}
        role="presentation"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm place order"
          className="w-full max-w-[420px] rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(8, 14, 30, 0.96)',
            border: '1px solid var(--glass-border-bright)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-5 py-4"
            style={{ borderBottom: '1px solid var(--glass-border)' }}
          >
            <div
              className="flex items-center justify-center w-8 h-8 rounded-full shrink-0"
              style={{ background: 'rgba(196,30,58,0.18)', border: '1px solid rgba(196,30,58,0.4)' }}
            >
              <Send className="w-4 h-4" style={{ color: '#c41e3a' }} strokeWidth={2.5} aria-hidden />
            </div>
            <span className="text-white font-semibold text-[15px]">Place Order</span>
          </div>

          {/* Body */}
          <div className="px-5 py-4 flex flex-col gap-4">
            <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              You are about to submit&nbsp;
              <span className="font-bold text-white">{pendingOrderData.design_name}</span>&nbsp;
              as a live order. Our CS team will be notified and production will begin shortly.
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="confirm-order-input"
                className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color: 'var(--text-muted)' }}
              >
                Type&nbsp;<span style={{ color: '#c41e3a' }}>confirm</span>&nbsp;to proceed
              </label>
              <input
                id="confirm-order-input"
                type="text"
                autoFocus
                autoComplete="off"
                value={confirmOrderText}
                onChange={(e) => setConfirmOrderText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && !submitting) { setConfirmOrderOpen(false); setConfirmOrderText(''); }
                  if (e.key === 'Enter' && confirmOrderText.trim().toLowerCase() === 'confirm' && !submitting) handleConfirmedOrder();
                }}
                placeholder="confirm"
                className="w-full rounded-xl px-4 py-2.5 text-[13px] outline-none transition"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: confirmOrderText.trim().toLowerCase() === 'confirm' ? '1.5px solid #c41e3a' : '1.5px solid var(--glass-border-bright)',
                  color: '#ffffff',
                  caretColor: '#c41e3a',
                }}
              />
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex justify-end gap-2 px-5 py-3.5"
            style={{ borderTop: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)' }}
          >
            <button
              type="button"
              className="btn btn-outline"
              disabled={submitting}
              onClick={() => { setConfirmOrderOpen(false); setConfirmOrderText(''); }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={confirmOrderText.trim().toLowerCase() !== 'confirm' || submitting}
              className="btn btn-crimson disabled:opacity-50"
              onClick={handleConfirmedOrder}
            >
              {submitting ? (
                <Loader2 aria-hidden className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send aria-hidden className="w-3.5 h-3.5" />
              )}
              {submitting ? 'Placing…' : 'Place Order'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function Field({
  name,
  label,
  required,
  labelSuffix,
  fieldError,
  ...rest
}: {
  name: string;
  label: string;
  required?: boolean;
  labelSuffix?: string;
  fieldError?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="fl" htmlFor={name}>
        {label}
        {required && <span style={{ color: '#c41e3a', marginLeft: 2 }}>*</span>}
        {labelSuffix && <span className="qf-label-suffix">{labelSuffix}</span>}
      </label>
      <input
        id={name}
        name={name}
        className="fi"
        style={fieldError ? { borderColor: 'var(--color-crimson)', boxShadow: '0 0 0 2px rgba(196,30,58,0.25)' } : undefined}
        {...rest}
      />
    </div>
  );
}
