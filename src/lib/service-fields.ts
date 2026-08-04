/**
 * Collapses a job's fine-grained `specific_type` (falling back to its broad
 * `order_type`) into the same service "bucket" `ClientBriefForm` uses to
 * decide which Project Details fields apply for a given service — so
 * job-detail views can show only the fields that were actually relevant when
 * the job was created, instead of a fixed set (Placement/Size/Fabric, …)
 * that only makes sense for embroidery digitizing.
 *
 * This mirrors the `selectedService` mapping in ClientBriefForm.tsx — the two
 * must be kept in sync by hand since the form works off its own internal
 * order-type ids while this works off the persisted job-card fields.
 */
export type ServiceBucket =
  | 'Vector Artwork'
  | 'Logo Designing'
  | 'Virtual Proof'
  | 'Business Card'
  | 'Brouchers'
  | 'Carton Box Designing'
  | 'Digitizing'
  | 'Digitizing Sewout'
  | 'Others';

export function resolveServiceBucket(
  orderType: string | null | undefined,
  specificType?: string | null,
): ServiceBucket {
  switch (specificType) {
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
    case 'Embroidery Digitizing':
      return 'Digitizing';
    case 'Embroidery Digitizing - Sewout Swatches':
    case 'Digitizing Sewout':
      return 'Digitizing Sewout';
    case 'Custom Embroidery Patches':
    case 'Others':
      return 'Others';
    default:
      break;
  }

  // No (or unrecognised) specific_type — fall back to the broad order type.
  if (orderType === 'Digitizing + Sewout') return 'Digitizing Sewout';
  if (orderType === 'Digitizing') return 'Digitizing';
  if (orderType === 'Artwork') return 'Vector Artwork';
  return 'Others';
}

export interface ServiceFieldFlags {
  processType: boolean;
  fabric: boolean;
  placement: boolean;
  size: boolean;
  colors: boolean;
  outputFormat: boolean;
}

/** Which Project Details fields are relevant for a resolved service bucket. */
export function resolveServiceFieldFlags(
  bucket: ServiceBucket,
  specificType?: string | null,
): ServiceFieldFlags {
  const isDigitizing = bucket === 'Digitizing' || bucket === 'Digitizing Sewout';
  return {
    processType:
      bucket === 'Vector Artwork' ||
      bucket === 'Business Card' ||
      bucket === 'Brouchers' ||
      bucket === 'Logo Designing' ||
      bucket === 'Carton Box Designing',
    fabric: isDigitizing,
    placement: isDigitizing || (bucket === 'Virtual Proof' && specificType === 'Product / Virtual Mock Ups'),
    size: isDigitizing,
    colors: bucket !== 'Others',
    outputFormat: specificType !== 'Custom Embroidery Patches',
  };
}
