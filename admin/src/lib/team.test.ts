import { describe, it, expect } from 'vitest';
import { parseNewMember, isRole } from './team';

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const valid = { email: ' New@Tafsir.net ', displayName: 'أحمد', password: 'a-long-password', role: 'reviewer' };

describe('parseNewMember', () => {
  it('accepts a complete member and normalises the email', () => {
    const r = parseNewMember(form(valid));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ ...valid, email: 'new@tafsir.net' });
  });

  it('reports each missing or weak field', () => {
    const r = parseNewMember(form({ email: 'no', displayName: ' ', password: 'short', role: 'owner' }));
    const messages = r.success ? [] : r.error.issues.map((i) => i.message);
    expect(messages).toEqual(
      expect.arrayContaining(['بريد إلكتروني غير صالح', 'الاسم مطلوب', 'كلمة المرور 10 أحرف على الأقل', 'اختر الدور']),
    );
  });
});

describe('isRole', () => {
  it('recognises the three roles only', () => {
    expect(isRole('admin')).toBe(true);
    expect(isRole('owner')).toBe(false);
  });
});
