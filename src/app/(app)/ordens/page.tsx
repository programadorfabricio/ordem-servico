import Link from "next/link";
import { exigirTela, TODOS } from "@/lib/contexto";
import { ehBalcao } from "@/lib/papeis";
import { dinheiro } from "@/lib/formato";
import { ABERTAS, dataCurta, hojeSP, type Status } from "@/lib/os";
import { Selo, Titulo, botao, campo } from "@/components/ui";
import AtualizarAoVivo from "@/components/AtualizarAoVivo";

export const dynamic = "force-dynamic";

const ABAS: { id: string; nome: string; status: Status[] | null }[] = [
  { id: "abertas", nome: "Abertas", status: ABERTAS },
  { id: "aguardando", nome: "Aguardando cliente", status: ["orcamento", "aguardando"] },
  { id: "execucao", nome: "Em execução", status: ["aprovada", "andamento", "peca"] },
  { id: "prontas", nome: "Prontas", status: ["pronta"] },
  { id: "entregues", nome: "Entregues", status: ["entregue"] },
  { id: "todas", nome: "Todas", status: null },
];

type Linha = {
  id: string;
  numero: number;
  status: Status;
  sem_servico: boolean;
  equipamento: string;
  identificacao: string;
  previsao: string | null;
  desconto: number;
  tecnico_id: string | null;
  created_at: string;
  cliente: { nome: string; telefone: string } | null;
  os_itens: { total: number }[];
  os_pagamentos: { valor: number }[];
};

export default async function PaginaOrdens({ searchParams }: { searchParams: Promise<{ aba?: string; q?: string; cliente?: string; minhas?: string }> }) {
  const { supabase, empresa, papel, user } = await exigirTela(TODOS);
  const sp = await searchParams;
  const aba = ABAS.find((a) => a.id === sp.aba) ?? ABAS[0];
  const q = (sp.q ?? "").trim();
  const minhas = sp.minhas === "1";

  let consulta = supabase
    .from("ordens")
    .select("id, numero, status, sem_servico, equipamento, identificacao, previsao, desconto, tecnico_id, created_at, cliente:clientes(nome, telefone), os_itens(total), os_pagamentos(valor)")
    .order("numero", { ascending: false })
    .limit(300);
  if (aba.status && !sp.cliente && !q) consulta = consulta.in("status", aba.status);
  if (sp.cliente) consulta = consulta.eq("cliente_id", sp.cliente);
  if (minhas) consulta = consulta.eq("tecnico_id", user.id);
  const { data } = await consulta;
  let linhas = (data ?? []) as unknown as Linha[];

  if (q) {
    const t = q.toLowerCase();
    const n = t.replace(/\D/g, "");
    linhas = linhas.filter(
      (l) =>
        String(l.numero) === t.replace(/^#/, "") ||
        l.cliente?.nome.toLowerCase().includes(t) ||
        l.equipamento.toLowerCase().includes(t) ||
        l.identificacao.toLowerCase().replace(/[^a-z0-9]/g, "").includes(t.replace(/[^a-z0-9]/g, "")) ||
        (n.length >= 4 && (l.cliente?.telefone ?? "").replace(/\D/g, "").includes(n))
    );
  }

  const hoje = hojeSP();

  return (
    <>
      <AtualizarAoVivo empresaId={empresa.id} tabelas={["ordens", "os_pagamentos"]} />
      <Titulo
        sub={sp.cliente ? "Ordens deste cliente" : "Toque numa ordem para abrir."}
        acao={
          ehBalcao(papel) && (
            <Link href="/ordens/nova" className={botao}>
              + Nova ordem de serviço
            </Link>
          )
        }
      >
        Ordens de serviço
      </Titulo>

      <form className="mb-3 flex flex-wrap gap-2" action="/ordens">
        {sp.aba && <input type="hidden" name="aba" value={sp.aba} />}
        {minhas && <input type="hidden" name="minhas" value="1" />}
        <input name="q" defaultValue={q} placeholder="Nº, cliente, placa, modelo ou telefone..." className={`${campo} max-w-md flex-1`} />
        <button className="rounded-lg border border-white/10 px-3 text-sm text-zinc-200 hover:bg-white/10">Buscar</button>
      </form>

      {!sp.cliente && (
        <nav className="sem-barra -mx-4 mb-4 flex gap-1 overflow-x-auto px-4 text-sm sm:mx-0 sm:px-0">
          {ABAS.map((a) => (
            <Link
              key={a.id}
              href={`/ordens?aba=${a.id}${minhas ? "&minhas=1" : ""}`}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 ${
                a.id === aba.id ? "border-sky-500/60 bg-sky-500/15 text-sky-200" : "border-white/10 text-zinc-400 hover:text-white"
              }`}
            >
              {a.nome}
            </Link>
          ))}
          <Link
            href={`/ordens?aba=${aba.id}${minhas ? "" : "&minhas=1"}`}
            className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 ${
              minhas ? "border-violet-500/60 bg-violet-500/15 text-violet-200" : "border-white/10 text-zinc-400 hover:text-white"
            }`}
          >
            Só as minhas
          </Link>
        </nav>
      )}

      {linhas.length === 0 && <p className="rounded-xl border border-white/10 p-6 text-center text-sm text-zinc-500">Nenhuma ordem aqui.</p>}

      <div className="space-y-2">
        {linhas.map((l) => {
          const total = l.os_itens.reduce((s, i) => s + Number(i.total), 0) - Number(l.desconto);
          const pago = l.os_pagamentos.reduce((s, p) => s + Number(p.valor), 0);
          const atrasada = l.previsao && l.previsao < hoje && ["aprovada", "andamento", "peca"].includes(l.status);
          return (
            <Link
              key={l.id}
              href={`/ordens/${l.id}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 hover:border-sky-500/40 hover:bg-white/[0.04]"
            >
              <span className="w-14 font-mono text-sm text-zinc-400">#{l.numero}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{l.cliente?.nome ?? "—"}</p>
                <p className="truncate text-sm text-zinc-400">
                  {l.equipamento}
                  {l.identificacao && <span className="font-mono"> · {l.identificacao}</span>}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                {l.previsao && !["entregue", "cancelada", "pronta"].includes(l.status) && (
                  <span className={atrasada ? "text-rose-300" : "text-zinc-400"}>{atrasada ? "Atrasada · " : "Prev. "}{dataCurta(l.previsao)}</span>
                )}
                {l.sem_servico && <span className="text-zinc-500">Devolvida sem serviço</span>}
                {total > 0 && !l.sem_servico && (
                  <span className="tabular-nums text-zinc-300">
                    {dinheiro(total)}
                    {l.status === "entregue" && pago < total && <span className="ml-1 text-amber-300">(falta {dinheiro(total - pago)})</span>}
                  </span>
                )}
                <Selo status={l.status} />
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
