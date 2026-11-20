import { AppHeader } from '@/components/AppHeader';

export default function QuestionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <AppHeader />
      {children}
    </div>
  );
}
