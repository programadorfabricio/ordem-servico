import { STATUS, type Status } from "@/lib/os";

// Peças visuais repetidas
export const campo =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-sky-500/70";
export const botao = "rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-black hover:bg-sky-400 disabled:opacity-50";
export const botaoSec = "rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/10 disabled:opacity-50";
export const rotulo = "text-xs text-zinc-400";

export function Titulo({ children, sub, acao }: { children: React.ReactNode; sub?: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold">{children}</h1>
        {sub && <p className="mt-0.5 text-sm text-zinc-400">{sub}</p>}
      </div>
      {acao}
    </div>
  );
}

export function Cartao({ titulo, valor, detalhe, destaque }: { titulo: string; valor: React.ReactNode; detalhe?: React.ReactNode; destaque?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${destaque ? "border-sky-500/40 bg-sky-500/10" : "border-white/10 bg-white/[0.03]"}`}>
      <p className="text-xs text-zinc-400">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
      {detalhe && <p className="mt-0.5 text-xs text-zinc-400">{detalhe}</p>}
    </div>
  );
}

export function Aviso({ tipo = "erro", children }: { tipo?: "erro" | "ok" | "info"; children: React.ReactNode }) {
  const cor =
    tipo === "erro" ? "bg-rose-500/10 text-rose-300" : tipo === "ok" ? "bg-emerald-500/10 text-emerald-300" : "bg-sky-500/10 text-sky-200";
  return <p className={`rounded-lg px-3 py-2 text-sm ${cor}`}>{children}</p>;
}

export function Selo({ status }: { status: Status }) {
  const s = STATUS[status] ?? { nome: status, cor: "bg-white/5 text-zinc-300" };
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cor}`}>{s.nome}</span>;
}

export function Bloco({ titulo, children, acao }: { titulo?: React.ReactNode; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      {(titulo || acao) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-semibold">{titulo}</h2>
          {acao}
        </div>
      )}
      {children}
    </section>
  );
}
