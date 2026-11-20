import { z } from 'zod';
import type { Role } from './status';

export const ROLE_LABELS: Record<Role, string> = {
  writer: 'كاتب',
  reviewer: 'مراجع علمي',
  admin: 'مدير',
};

export function isRole(value: string): value is Role {
  return Object.hasOwn(ROLE_LABELS, value);
}

export const newMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('بريد إلكتروني غير صالح'),
  displayName: z.string().trim().min(1, 'الاسم مطلوب'),
  password: z.string().min(10, 'كلمة المرور 10 أحرف على الأقل'),
  role: z.enum(['writer', 'reviewer', 'admin'], { errorMap: () => ({ message: 'اختر الدور' }) }),
});

export function parseNewMember(fd: FormData) {
  const text = (key: string) => String(fd.get(key) ?? '');
  return newMemberSchema.safeParse({
    email: text('email'),
    displayName: text('displayName'),
    password: text('password'),
    role: text('role'),
  });
}
