export const STATUS_LABELS = {
  draft: 'مسودة',
  in_review: 'قيد المراجعة',
  needs_changes: 'يحتاج تعديلًا',
  approved: 'معتمد',
  published: 'منشور',
  suspended: 'موقوف',
} as const;

export type QuestionStatus = keyof typeof STATUS_LABELS;
export type Role = 'writer' | 'reviewer' | 'admin';

export const ACTION_LABELS: Record<QuestionStatus, string> = {
  draft: 'إعادة إلى مسودة',
  in_review: 'إرسال للمراجعة',
  needs_changes: 'إعادة للتعديل',
  approved: 'اعتماد',
  published: 'نشر',
  suspended: 'إيقاف',
};

const EDITABLE: QuestionStatus[] = ['draft', 'needs_changes', 'suspended'];

export function isQuestionStatus(value: string): value is QuestionStatus {
  return Object.hasOwn(STATUS_LABELS, value);
}

export function canEdit(status: QuestionStatus, role: Role, isAuthor: boolean): boolean {
  return EDITABLE.includes(status) && (isAuthor || role === 'admin');
}

export function availableTransitions(status: QuestionStatus, role: Role, isAuthor: boolean): QuestionStatus[] {
  const reviews = role === 'reviewer' || role === 'admin';
  switch (status) {
    case 'draft':
    case 'needs_changes':
      return isAuthor || role === 'admin' ? ['in_review'] : [];
    case 'in_review': {
      const targets: QuestionStatus[] = [];
      if (reviews && !isAuthor) targets.push('approved');
      if (reviews) targets.push('needs_changes');
      return targets;
    }
    case 'approved':
      return role === 'admin' ? ['published'] : [];
    case 'published':
      return role === 'admin' ? ['suspended'] : [];
    case 'suspended':
      return role === 'admin' ? ['in_review'] : [];
  }
}
