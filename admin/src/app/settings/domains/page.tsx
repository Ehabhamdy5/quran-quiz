import { createClient } from '@/lib/supabase/server';
import { DomainForm } from './DomainForm';
import { removeDomain } from './actions';

export default async function DomainsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('allowed_media_domains').select('domain').order('domain');

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-bold">المواقع المسموح بها للوسائط</h1>
      <p className="text-sm text-gray-600">
        لا يُقبل رابط وسيط إلا من هذه المواقع أو نطاقاتها الفرعية، وبـ https. حذف موقع لا يمسّ الوسائط المحفوظة، لكنه
        يمنع حفظ روابط جديدة منه.
      </p>
      <ul className="divide-y rounded border bg-white">
        {(data ?? []).map(({ domain }) => (
          <li key={domain} className="flex items-center justify-between p-2">
            <span dir="ltr">{domain}</span>
            <form action={removeDomain.bind(null, domain)}>
              <button className="text-sm text-red-700 hover:underline">حذف</button>
            </form>
          </li>
        ))}
      </ul>
      <DomainForm />
    </div>
  );
}
