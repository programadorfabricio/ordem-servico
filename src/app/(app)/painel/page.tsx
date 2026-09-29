import Link from "next/link";
import { exigirTela, GESTAO } from "@/lib/contexto";
import { dinheiro } from "@/lib/formato";
import { FORMAS, STATUS, dataCurta, hojeSP, type Status } from "@/lib/os";
import { Aviso, Bloco, Cartao, Selo, Titulo } from "@/components/ui";
import AtualizarAoVivo from "@/components/AtualizarAoVivo";

export const dynamic = "force-dynamic";

type Painel = {
  por_status: Partial<Record<Status, number>>;
  atrasadas: number;
  a_receber: number;
  recebido: number;
  por_forma: Record<string, number>;
  entregues: number;
  faturado: number;
  abertas_periodo: number;
  enviados: number;
  aprovados: number;
  recusados: number;
};

function periodos(hoje: string) {
  const [a, m] = hoje.split("-").map(Number);
  const ini = (y: number, mm: number) => `${y}-${String(mm).padStart(2, "0")}-01`;
  const fimMes = (y: number, mm: number) => new Date(Date.UTC(y, mm, 0)).toISOString().slice(0, 10);
  const pa = m === 1 ? a - 1 : a;
  const pm = m === 1 ? 12 : m - 1;
  const sete = new Date(Date.parse(`${hoje}T12:00:00Z`) - 6 * 86400_000).toISOString().slice(0, 10);
  return [
    { id: "hoje", nome: "Hoje", de: hoje, ate: hoje },
    { id: "7d", nome: "7 dias", de: sete, ate: hoje },
    { id: "mes", nome: "Este mês", de: ini(a, m), ate: fimMes(a, m) },
    { id: "passado", nome: "Mês passado", de: ini(pa, pm), ate: fimMes(pa, pm) },
  ];
}

export default async function PaginaPainel({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { supabase, empresa } = await exigirTela(GESTAO);
  const sp = await searchParams;
  const hoje = hojeSP();
  const lista = periodos(hoje);
  const per = lista.find((x) => x.id === sp.p) ?? lista[2];

  const [{ data, error }, { data: prontas }, { data: atrasadas }, { data: fiado }] = await Promise.all([
    supabase.rpc("painel_os", { p_inicio: per.de, p_fim: per.ate }),
    supabase.from("ordens").select("id, numero, equipamento, pronto_em, cliente:clientes(nome)").eq("status", "pronta").order("pronto_em").limit(20),
    supabase
      .from("ordens")
      .select("id, numero, equipamento, previsao, status, cliente:clientes(nome)")
      .in("status", ["aprovada", "andamento", "peca"])
      .lt("previsao", hoje)
      .order("previsao")
      .limit(20),
    supabase.from("ordens").select("id, numero, desconto, cliente:clientes(nome), os_itens(total), os_pagamentos(valor)").eq("status", "entregue").eq("sem_servico", false).order("entregue_em", { ascending: false }).limit(300),
  ]);
  const p = data as Painel | null;
  const comSaldo = (fiado ?? [])
    .map((o) => {
      const total = o.os_itens.reduce((s: number, i: { total: number }) => s + Number(i.total), 0) - Number(o.desconto);
      const pago = o.os_pagamentos.reduce((s: number, x: { valor: number }) => s + Number(x.valor), 0);
      return { ...o, falta: Math.round((total - pago) * 100) / 100 };
    })
    .filter((o) => o.falta > 0);
  const nome = (c: unknown) => (c as { nome: string } | null)?.nome ?? "—";

  const aprovacao = p && p.enviados ? Math.round((p.aprovados / p.enviados) * 100) : null;
  const abertas = p ? Object.values(p.por_status).reduce((s, n) => s + (n ?? 0), 0) : 0;

  return (
    <>
      <AtualizarAoVivo empresaId={empresa.id} tabelas={["ordens", "os_pagamentos"]} />
      <Titulo sub={per.de === per.ate ? dataCurta(per.de) : `${dataCurta(per.de)} a ${dataCurta(per.ate)}`}>Painel</Titulo>
      <nav className="mb-4 flex flex-wrap gap-1 text-sm">
        {lista.map((x) => (
          <Link
            key={x.id}
            href={`/painel?p=${x.id}`}
            className={`rounded-full border px-3 py-1 ${x.id === per.id ? "border-sky-500/60 bg-sky-500/15 text-sky-200" : "border-white/10 text-zinc-400 hover:text-white"}`}
          >
            {x.nome}
          </Link>
        ))}
      </nav>
      {error && <Aviso>{error.message}</Aviso>}
      {p && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Cartao titulo="Recebido no período" valor={dinheiro(p.recebido)} destaque detalhe={Object.entries(p.por_forma).map(([f, v]) => `${FORMAS[f] ?? f} ${dinheiro(v)}`).join(" · ") || "—"} />
            <Cartao titulo="Serviços entregues" valor={p.entregues} detalhe={`${dinheiro(p.faturado)} em serviços entregues`} />
            <Cartao titulo="Aprovação de orçamentos" valor={aprovacao == null ? "—" : `${aprovacao}%`} detalhe={`${p.aprovados} de ${p.enviados} enviados · ${p.recusados} recusados`} />
            <Cartao titulo="A receber (fiado)" valor={dinheiro(p.a_receber)} detalhe={`${comSaldo.length} ${comSaldo.length === 1 ? "serviço entregue" : "serviços entregues"} com saldo`} />
          </div>

          <Bloco titulo={`Abertas agora: ${abertas}`}>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS) as Status[])
                .filter((s) => p.por_status[s])
                .map((s) => (
                  <span key={s} className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-sm">
                    <Selo status={s} /> <b className="tabular-nums">{p.por_status[s]}</b>
                  </span>
                ))}
              {abertas === 0 && <p className="text-sm text-zinc-500">Nenhuma ordem aberta.</p>}
            </div>
            <p className="mt-2 text-xs text-zinc-500">{p.abertas_periodo} ordens abertas no período.</p>
          </Bloco>

          <div className="grid gap-4 lg:grid-cols-3">
            <Bloco titulo={`Prontas para retirar (${prontas?.length ?? 0})`}>
              <Lista itens={(prontas ?? []).map((o) => ({ id: o.id, numero: o.numero, a: nome(o.cliente), b: o.equipamento }))} vazio="Nenhuma esperando retirada." />
            </Bloco>
            <Bloco titulo={`Atrasadas (${p.atrasadas})`}>
              <Lista itens={(atrasadas ?? []).map((o) => ({ id: o.id, numero: o.numero, a: nome(o.cliente), b: `Previsão ${dataCurta(o.previsao)}`, alerta: true }))} vazio="Nada atrasado." />
            </Bloco>
            <Bloco titulo="A receber">
              <Lista itens={comSaldo.slice(0, 20).map((o) => ({ id: o.id, numero: o.numero, a: nome(o.cliente), b: `Falta ${dinheiro(o.falta)}`, alerta: true }))} vazio="Ninguém devendo." />
            </Bloco>
          </div>
        </div>
      )}
    </>
  );
}

function Lista({ itens, vazio }: { itens: { id: string; numero: number; a: string; b: string; alerta?: boolean }[]; vazio: string }) {
  if (!itens.length) return <p className="text-sm text-zinc-500">{vazio}</p>;
  return (
    <div className="divide-y divide-white/5">
      {itens.map((i) => (
        <Link key={i.id} href={`/ordens/${i.id}`} className="flex items-center gap-3 py-2 text-sm hover:text-sky-200">
          <span className="w-10 font-mono text-zinc-500">#{i.numero}</span>
          <span className="min-w-0 flex-1 truncate">{i.a}</span>
          <span className={`shrink-0 text-xs ${i.alerta ? "text-amber-300" : "text-zinc-400"}`}>{i.b}</span>
        </Link>
      ))}
    </div>
  );
}
