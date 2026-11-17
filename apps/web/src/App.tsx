import { Disclaimer } from './Disclaimer.tsx';

export function App() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <h1 className="text-3xl font-bold">VeritasAI</h1>
        <p className="mt-2 text-slate-700">Verificação automatizada de notícias em português.</p>
      </main>
      <Disclaimer />
    </div>
  );
}
