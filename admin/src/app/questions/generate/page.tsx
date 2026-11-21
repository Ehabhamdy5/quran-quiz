import { GenerateForm } from './GenerateForm';

// طلب Claude قد يطول؛ هذا يرفع مهلة الإجراء عند النشر على منصات تحدّها.
export const maxDuration = 300;

export default function GeneratePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">توليد مساعَد</h1>
      <p className="max-w-3xl text-sm text-gray-600">
        يجلب النظام نص الآيات وتفسيرها من «المختصر في تفسير القرآن الكريم» و«تفسير السعدي»، ثم يقترح Claude أسئلة لكل منها
        اقتباس حرفي من التفسير. يُرفض آليًا كل مقترح لا يوجد اقتباسه في التفسير، وما يجتاز الفحص يُحفظ مسودةً بعلامة
        «مولَّد آليًا» ولا يُنشر إلا بعد مراجعة علمية.
      </p>
      <GenerateForm />
    </div>
  );
}
