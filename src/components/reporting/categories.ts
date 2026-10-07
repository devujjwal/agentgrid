import type { ReportInput } from '../../domain/reports';
export const reportCategoryLabels = {
  spam: 'Spam or misleading promotion',
  'unsafe-instructions': 'Unsafe instructions',
  privacy: 'Privacy concern',
  copyright: 'Copyright or reuse rights',
  'broken-package': 'Broken package or setup',
  other: 'Another concern',
} as const satisfies Record<ReportInput['category'], string>;
