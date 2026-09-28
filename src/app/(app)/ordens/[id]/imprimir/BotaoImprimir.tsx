"use client";

export default function BotaoImprimir() {
  return (
    <button onClick={() => window.print()} className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-black hover:bg-sky-400">
      Imprimir ou salvar PDF
    </button>
  );
}
