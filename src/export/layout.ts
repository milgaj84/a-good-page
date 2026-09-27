export const EXPORT_LAYOUTS = ['manuscript', 'reading'] as const;
export type ExportLayout = typeof EXPORT_LAYOUTS[number];

export interface LayoutSpec {
  label: string;
  pageSize: 'A4';
  margins: [number, number, number, number];
  fontSize: number;
  lineHeight: number;
  heading: number;
  title: number;
  color: string;
  footer: boolean;
}

/** Both presets use the very same PDF generator for preview and final export. */
export function layoutSpec(layout: ExportLayout): LayoutSpec {
  if (layout === 'manuscript') return {
    label: 'Manuscript', pageSize: 'A4', margins: [76, 82, 76, 76],
    fontSize: 12, lineHeight: 1.8, heading: 16, title: 22, color: '#222222', footer: false,
  };
  if (layout === 'reading') return {
    label: 'Reading copy', pageSize: 'A4', margins: [68, 72, 68, 68],
    fontSize: 11.5, lineHeight: 1.5, heading: 17, title: 25, color: '#28241f', footer: true,
  };
  throw new RangeError('Unknown export layout');
}
