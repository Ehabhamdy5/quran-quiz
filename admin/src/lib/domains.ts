const HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

// يقبل اسم الموقع أو رابطًا كاملًا، ويُرجع النطاق بحروف صغيرة دون www، أو null.
export function normalizeDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  if (s.includes('://')) {
    try {
      s = new URL(s).hostname;
    } catch {
      return null;
    }
  }
  s = s.replace(/\/.*$/, '').replace(/\.$/, '').replace(/^www\./, '');
  return HOST.test(s) ? s : null;
}
