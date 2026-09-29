"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { dataHora, dinheiro, lerNumero, mensagemErro } from "@/lib/formato";
import { enviarFoto, urlFoto } from "@/lib/fotos";
import { ehBalcao, type Papel } from "@/lib/papeis";
import type { Empresa } from "@/lib/contexto";
import { FORMAS, STATUS, dataCurta, hojeSP, linkWhats, type Evento, type Item, type Ordem, type Pagamento, type Status } from "@/lib/os";
import { Aviso, Bloco, Selo, botao, botaoSec, campo, rotulo } from "@/components/ui";

type Membro = { user_id: string; nome: string };
type ItemCat = { id: string; tipo: string; nome: string; preco: number };
type Linha = { tipo: "servico" | "peca"; descricao: string; qtd: string; preco: string };
type Modal = null | "aprovar" | "recusar" | "cancelar" | "entregar" | "receber" | "enviar";

const txtNum = (n: number) => String(n).replace(".", ",");
const EDITA_ITENS: Status[] = ["orcamento", "aguardando", "recusada"];
const FINAL: Status[] = ["entregue", "cancelada"];

function linhasDe(itens: Item[]): Linha[] {
  return itens.map((i) => ({ tipo: i.tipo, descricao: i.descricao, qtd: txtNum(i.quantidade), preco: txtNum(i.preco_unit) }));
}
function dadosDe(o: Ordem) {
  return {
    equipamento: o.equipamento,
    identificacao: o.identificacao,
    detalhes: o.detalhes,
    defeito: o.defeito,
    diagnostico: o.diagnostico,
    previsao: o.previsao ?? "",
    tecnico: o.tecnico_id ?? "",
    desconto: Number(o.desconto) ? txtNum(Number(o.desconto)) : "",
  };
}

export default function DetalheOS({
  empresa,
  papel,
  ordem,
  itens,
  eventos,
  pagamentos,
  equipe,
  catalogo,
}: {
  empresa: Empresa;
  papel: Papel;
  ordem: Ordem;
  itens: Item[];
  eventos: Evento[];
  pagamentos: Pagamento[];
  equipe: Membro[];
  catalogo: ItemCat[];
}) {
  const router = useRouter();
  const balcao = ehBalcao(papel);
  const tecnico = papel === "tecnico";
  const status = ordem.status;
  const final = FINAL.includes(status);
  const podeItens = EDITA_ITENS.includes(status) && !final;

  // Estado editável (volta ao que está no banco quando não há nada por salvar)
  const baseDados = useMemo(() => dadosDe(ordem), [ordem]);
  const baseLinhas = useMemo(() => linhasDe(itens), [itens]);
  const [dados, setDados] = useState(baseDados);
  const [linhas, setLinhas] = useState<Linha[]>(baseLinhas);
  const sujoDados = JSON.stringify(dados) !== JSON.stringify(baseDados);
  const sujoItens = JSON.stringify(linhas) !== JSON.stringify(baseLinhas);
  const sujo = sujoDados || sujoItens;
  useEffect(() => {
    if (!sujo) {
      setDados(baseDados);
      setLinhas(baseLinhas);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseDados, baseLinhas]);

  const [msg, setMsg] = useState<{ erro?: string; ok?: string }>({});
  const [ocupado, setOcupado] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [origem, setOrigem] = useState("");
  useEffect(() => setOrigem(window.location.origin), []);

  // Contas
  const subtotal = linhas.reduce((s, l) => s + Math.round((lerNumero(l.qtd) ?? 0) * (lerNumero(l.preco) ?? 0) * 100) / 100, 0);
  const desconto = lerNumero(dados.desconto) ?? 0;
  const total = Math.max(0, subtotal - desconto);
  const pago = pagamentos.reduce((s, p) => s + p.valor, 0);
  const falta = ordem.sem_servico ? 0 : Math.max(0, Math.round((total - pago) * 100) / 100);

  const link = `${origem}/o/${ordem.token}`;
  const primeiroNome = (ordem.cliente?.nome ?? "").split(" ")[0];
  const tel = ordem.cliente?.telefone ?? "";
  const msgOrcamento = `Olá, ${primeiroNome}! Aqui é da ${empresa.nome}. O orçamento da ordem de serviço nº ${ordem.numero} (${ordem.equipamento}) ficou em ${dinheiro(total)}. Veja os detalhes e aprove pelo link: ${link}`;
  const msgPronta = `Olá, ${primeiroNome}! Seu ${ordem.equipamento} está pronto para retirar na ${empresa.nome}.${falta > 0 ? ` Valor a pagar: ${dinheiro(falta)}.` : ""} Detalhes da ordem de serviço nº ${ordem.numero}: ${link}`;
  const msgAcompanhar = `Olá, ${primeiroNome}! Acompanhe a ordem de serviço nº ${ordem.numero} (${ordem.equipamento}) da ${empresa.nome} por aqui: ${link}`;

  const sb = () => criarClienteNavegador();

  async function salvar(silencioso = false): Promise<boolean> {
    if (!sujo) return true;
    setMsg({});
    if (sujoItens && podeItens) {
      const lista = [];
      for (const [i, l] of linhas.entries()) {
        const q = lerNumero(l.qtd);
        const p = lerNumero(l.preco);
        if (!l.descricao.trim()) return setMsg({ erro: `O item ${i + 1} está sem descrição.` }), false;
        if (q == null || q <= 0) return setMsg({ erro: `Quantidade inválida no item ${i + 1}.` }), false;
        if (p == null || p < 0) return setMsg({ erro: `Preço inválido no item ${i + 1}.` }), false;
        lista.push({ tipo: l.tipo, descricao: l.descricao.trim(), quantidade: q, preco: p });
      }
      const { error } = await sb().rpc("salvar_itens", { p_os: ordem.id, p_itens: lista });
      if (error) return setMsg({ erro: mensagemErro(error) }), false;
    }
    if (sujoDados || (sujoItens && desconto)) {
      if (desconto < 0) return setMsg({ erro: "Desconto inválido." }), false;
      const { error } = await sb().rpc("salvar_os", {
        p_os: ordem.id,
        p_equipamento: dados.equipamento,
        p_identificacao: dados.identificacao,
        p_detalhes: dados.detalhes,
        p_defeito: dados.defeito,
        p_diagnostico: dados.diagnostico,
        p_previsao: dados.previsao || null,
        p_tecnico: dados.tecnico || null,
        p_desconto: podeItens ? desconto : Number(ordem.desconto),
      });
      if (error) return setMsg({ erro: mensagemErro(error) }), false;
    }
    if (!silencioso) setMsg({ ok: "Salvo." });
    router.refresh();
    return true;
  }

  async function executar(fn: () => PromiseLike<{ error: unknown }>, ok?: string, depois?: () => void) {
    setOcupado(true);
    setMsg({});
    if (!(await salvar(true))) return setOcupado(false);
    const { error } = await fn();
    setOcupado(false);
    if (error) return setMsg({ erro: mensagemErro(error) });
    setModal(null);
    if (ok) setMsg({ ok });
    depois?.();
    router.refresh();
  }

  const mudar = (s: Status, texto = "", aprovadoPor?: string, ok?: string, depois?: () => void) =>
    executar(() => sb().rpc("mudar_status", { p_os: ordem.id, p_status: s, p_texto: texto, p_aprovado_por: aprovadoPor ?? null }), ok, depois);

  function abrirWhats(texto: string) {
    if (!tel) {
      navigator.clipboard?.writeText(texto).catch(() => {});
      setMsg({ ok: "O cliente está sem WhatsApp cadastrado. Copiei a mensagem para você colar." });
      return;
    }
    window.open(linkWhats(tel, texto), "_blank", "noopener");
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(link);
      setMsg({ ok: "Link copiado." });
    } catch {
      window.prompt("Copie o link:", link);
    }
  }

  // ---------- Ações por status ----------
  const acoes: { nome: string; fazer: () => void; principal?: boolean; perigo?: boolean }[] = [];
  if (balcao) {
    if (status === "orcamento") {
      acoes.push({ nome: "Enviar orçamento ao cliente", principal: true, fazer: () => mudar("aguardando", "", undefined, undefined, () => setModal("enviar")) });
      acoes.push({ nome: "Cliente aprovou no balcão", fazer: () => setModal("aprovar") });
    }
    if (status === "aguardando") {
      acoes.push({ nome: "Reenviar no WhatsApp", principal: true, fazer: () => abrirWhats(msgOrcamento) });
      acoes.push({ nome: "Cliente aprovou", fazer: () => setModal("aprovar") });
      acoes.push({ nome: "Cliente recusou", fazer: () => setModal("recusar") });
    }
    if (status === "recusada") {
      acoes.push({ nome: "Devolver ao cliente", principal: true, fazer: () => setModal("entregar") });
    }
    if (["aguardando", "recusada", "aprovada", "andamento", "peca"].includes(status)) {
      acoes.push({ nome: "Reabrir orçamento", fazer: () => window.confirm("Reabrir o orçamento para mudar itens ou valores? Depois é preciso enviar e aprovar de novo.") && mudar("orcamento") });
    }
  }
  if (balcao || tecnico) {
    if (status === "aprovada") acoes.push({ nome: "Iniciar serviço", principal: true, fazer: () => mudar("andamento") });
    if (status === "peca") acoes.push({ nome: "Peça chegou, retomar", principal: true, fazer: () => mudar("andamento") });
    if (["aprovada", "andamento"].includes(status))
      acoes.push({ nome: "Aguardando peça", fazer: () => { const t = window.prompt("Qual peça? (aparece para o cliente)", ""); if (t !== null) mudar("peca", t); } });
    if (["aprovada", "andamento", "peca"].includes(status)) acoes.push({ nome: "Marcar como pronta", principal: status === "andamento", fazer: () => mudar("pronta") });
    if (status === "pronta") acoes.push({ nome: "Voltou para o serviço", fazer: () => { const t = window.prompt("Por que voltou?", ""); if (t !== null) mudar("andamento", t); } });
  }
  if (balcao && status === "pronta") {
    acoes.unshift({ nome: "Entregar e receber", principal: true, fazer: () => setModal("entregar") });
    acoes.splice(1, 0, { nome: "Avisar cliente no WhatsApp", fazer: () => abrirWhats(msgPronta) });
  }
  if (balcao && !final && !pagamentos.length) acoes.push({ nome: "Cancelar ordem", perigo: true, fazer: () => setModal("cancelar") });

  const atrasada = ordem.previsao && ordem.previsao < hojeSP() && ["aprovada", "andamento", "peca"].includes(status);
  const podeReceber = balcao && ["aprovada", "andamento", "peca", "pronta", "entregue"].includes(status) && falta > 0;

  return (
    <div className="space-y-4 pb-24">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/ordens" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Ordens
          </Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-semibold">
            Ordem de serviço nº {ordem.numero} <Selo status={status} />
            {atrasada && <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs text-rose-300">Atrasada</span>}
          </h1>
          <p className="text-sm text-zinc-400">
            Aberta em {dataHora(ordem.created_at)}
            {ordem.aprovado_por && ` · aprovada por ${ordem.aprovado_por}${ordem.aprovado_via === "link" ? " (pelo link)" : ""}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/ordens/${ordem.id}/imprimir`} target="_blank" className={botaoSec}>
            Imprimir
          </a>
          <button onClick={copiarLink} className={botaoSec}>
            Copiar link do cliente
          </button>
          {balcao && (
            <button onClick={() => abrirWhats(status === "pronta" ? msgPronta : status === "aguardando" ? msgOrcamento : msgAcompanhar)} className={botaoSec}>
              WhatsApp
            </button>
          )}
        </div>
      </div>

      {/* Ações */}
      {acoes.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          {acoes.map((a) => (
            <button
              key={a.nome}
              disabled={ocupado}
              onClick={a.fazer}
              className={a.principal ? botao : a.perigo ? "rounded-lg px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10 disabled:opacity-50" : botaoSec}
            >
              {a.nome}
            </button>
          ))}
        </div>
      )}

      {msg.erro && <Aviso>{msg.erro}</Aviso>}
      {msg.ok && <Aviso tipo="ok">{msg.ok}</Aviso>}
      {ordem.recusa_motivo && ["recusada", "entregue"].includes(status) && ordem.recusado_em && (
        <Aviso tipo="info">Motivo da recusa: {ordem.recusa_motivo}</Aviso>
      )}
      {ordem.sem_servico && <Aviso tipo="info">Devolvida ao cliente sem o serviço (orçamento recusado). Não entra no faturamento.</Aviso>}

      {/* Janelas */}
      {modal && (
        <Janela
          modal={modal}
          fechar={() => setModal(null)}
          ocupado={ocupado}
          ordem={ordem}
          total={status === "recusada" ? 0 : total}
          pago={pago}
          link={link}
          temTel={!!tel}
          onWhats={() => abrirWhats(msgOrcamento)}
          onCopiar={copiarLink}
          onAprovar={(nome) => mudar("aprovada", "", nome, "Orçamento aprovado.")}
          onRecusar={(motivo) => mudar("recusada", motivo)}
          onCancelar={(motivo) => mudar("cancelada", motivo)}
          onEntregar={(pags, texto) =>
            executar(() => sb().rpc("entregar_os", { p_os: ordem.id, p_pagamentos: pags, p_texto: texto }), status === "recusada" ? "Devolvido ao cliente." : "Serviço entregue.")
          }
          onReceber={(forma, valor) => executar(() => sb().rpc("registrar_pagamento", { p_os: ordem.id, p_forma: forma, p_valor: valor }), "Pagamento registrado.")}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          {/* Cliente e equipamento */}
          <Bloco titulo="Cliente e equipamento">
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-black/20 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{ordem.cliente?.nome}</p>
                <p className="truncate text-sm text-zinc-400">{[tel, ordem.cliente?.documento].filter(Boolean).join(" · ") || "Sem telefone"}</p>
              </div>
              {balcao && (
                <Link href={`/ordens?cliente=${ordem.cliente?.id}`} className="text-sm text-sky-300 hover:underline">
                  Outras ordens
                </Link>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Veículo / equipamento" valor={dados.equipamento} mudar={(v) => setDados({ ...dados, equipamento: v })} ativo={balcao && !final} span />
              <Campo rotulo="Placa / nº de série" valor={dados.identificacao} mudar={(v) => setDados({ ...dados, identificacao: v })} ativo={balcao && !final} mono />
              <Campo rotulo="Km, cor, acessórios" valor={dados.detalhes} mudar={(v) => setDados({ ...dados, detalhes: v })} ativo={balcao && !final} />
              <Campo rotulo="Defeito relatado" valor={dados.defeito} mudar={(v) => setDados({ ...dados, defeito: v })} ativo={balcao && !final} span area />
              <Campo
                rotulo="Diagnóstico (o que foi encontrado)"
                valor={dados.diagnostico}
                mudar={(v) => setDados({ ...dados, diagnostico: v })}
                ativo={!final}
                span
                area
                dica="Aparece no orçamento do cliente."
              />
              <label className="block space-y-1">
                <span className={rotulo}>Previsão de entrega</span>
                {balcao && !final ? (
                  <input type="date" value={dados.previsao} onChange={(e) => setDados({ ...dados, previsao: e.target.value })} className={campo} />
                ) : (
                  <p className="text-sm">{dataCurta(ordem.previsao) || "—"}</p>
                )}
              </label>
              <label className="block space-y-1">
                <span className={rotulo}>Responsável</span>
                {balcao && !final ? (
                  <select value={dados.tecnico} onChange={(e) => setDados({ ...dados, tecnico: e.target.value })} className={campo}>
                    <option value="">— ninguém —</option>
                    {equipe.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm">{equipe.find((m) => m.user_id === ordem.tecnico_id)?.nome ?? "—"}</p>
                )}
              </label>
            </div>
          </Bloco>

          {/* Orçamento */}
          <Bloco
            titulo="Orçamento"
            acao={!podeItens && !final && balcao ? <span className="text-xs text-zinc-500">Para mudar, use “Reabrir orçamento”</span> : null}
          >
            <Itens linhas={linhas} setLinhas={setLinhas} podeEditar={podeItens && (balcao || tecnico)} catalogo={catalogo} />
            <div className="mt-4 space-y-1 border-t border-white/10 pt-3 text-sm">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal</span>
                <span className="tabular-nums">{dinheiro(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-zinc-400">
                <span>Desconto</span>
                {podeItens && balcao ? (
                  <input
                    value={dados.desconto}
                    onChange={(e) => setDados({ ...dados, desconto: e.target.value })}
                    inputMode="decimal"
                    placeholder="0,00"
                    className="w-28 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-right text-sm outline-none focus:border-sky-500/70"
                  />
                ) : (
                  <span className="tabular-nums">{desconto ? `− ${dinheiro(desconto)}` : "—"}</span>
                )}
              </div>
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{dinheiro(total)}</span>
              </div>
            </div>
          </Bloco>
        </div>

        <div className="min-w-0 space-y-4">
          {/* Pagamentos */}
          {balcao && !["orcamento", "aguardando", "recusada", "cancelada"].includes(status) && (
            <Bloco
              titulo="Pagamento"
              acao={
                podeReceber && (
                  <button onClick={() => setModal("receber")} className="text-sm text-sky-300 hover:underline">
                    {status === "entregue" ? "Receber saldo" : "Receber sinal"}
                  </button>
                )
              }
            >
              <div className="space-y-1 text-sm">
                {pagamentos.map((p) => (
                  <div key={p.id} className="flex justify-between text-zinc-300">
                    <span>
                      {FORMAS[p.forma] ?? p.forma} <span className="text-xs text-zinc-500">{dataHora(p.created_at)}</span>
                    </span>
                    <span className="tabular-nums">{dinheiro(p.valor)}</span>
                  </div>
                ))}
                {pagamentos.length === 0 && <p className="text-zinc-500">Nada recebido ainda.</p>}
                <div className="mt-2 flex justify-between border-t border-white/10 pt-2 font-medium">
                  <span>{falta > 0 ? "Falta receber" : "Pago"}</span>
                  <span className={`tabular-nums ${falta > 0 && status === "entregue" ? "text-amber-300" : ""}`}>{dinheiro(falta > 0 ? falta : pago)}</span>
                </div>
              </div>
            </Bloco>
          )}

          <Historico empresaId={empresa.id} ordemId={ordem.id} eventos={eventos} final={final} />
        </div>
      </div>

      {/* Barra de salvar */}
      {sujo && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-sky-500/30 bg-[#0a0c0f]/95 px-4 py-3 backdrop-blur print:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <p className="text-sm text-sky-200">Alterações não salvas</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDados(baseDados);
                  setLinhas(baseLinhas);
                }}
                className={botaoSec}
              >
                Desfazer
              </button>
              <button disabled={ocupado} onClick={() => { setOcupado(true); salvar().finally(() => setOcupado(false)); }} className={botao}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Campo({
  rotulo: r,
  valor,
  mudar,
  ativo,
  span,
  area,
  mono,
  dica,
}: {
  rotulo: string;
  valor: string;
  mudar: (v: string) => void;
  ativo: boolean;
  span?: boolean;
  area?: boolean;
  mono?: boolean;
  dica?: string;
}) {
  return (
    <label className={`block space-y-1 ${span ? "sm:col-span-2" : ""}`}>
      <span className={rotulo}>{r}</span>
      {ativo ? (
        area ? (
          <textarea value={valor} onChange={(e) => mudar(e.target.value)} rows={2} className={campo} />
        ) : (
          <input value={valor} onChange={(e) => mudar(e.target.value)} className={`${campo} ${mono ? "font-mono uppercase" : ""}`} />
        )
      ) : (
        <p className={`whitespace-pre-wrap text-sm ${mono ? "font-mono" : ""}`}>{valor || "—"}</p>
      )}
      {dica && ativo && <span className="block text-xs text-zinc-500">{dica}</span>}
    </label>
  );
}

function Itens({ linhas, setLinhas, podeEditar, catalogo }: { linhas: Linha[]; setLinhas: (l: Linha[]) => void; podeEditar: boolean; catalogo: ItemCat[] }) {
  const [busca, setBusca] = useState("");
  const t = busca.trim().toLowerCase();
  const achados = t ? catalogo.filter((c) => c.nome.toLowerCase().includes(t)).slice(0, 8) : [];
  const alterar = (i: number, k: keyof Linha, v: string) => setLinhas(linhas.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  if (!podeEditar) {
    if (!linhas.length) return <p className="text-sm text-zinc-500">Nenhum item.</p>;
    return (
      <div className="divide-y divide-white/5 text-sm">
        {linhas.map((l, i) => {
          const q = lerNumero(l.qtd) ?? 0;
          const p = lerNumero(l.preco) ?? 0;
          return (
            <div key={i} className="flex items-baseline gap-3 py-1.5">
              <span className={`w-12 shrink-0 text-xs ${l.tipo === "peca" ? "text-amber-300" : "text-sky-300"}`}>{l.tipo === "peca" ? "Peça" : "Serviço"}</span>
              <span className="min-w-0 flex-1">
                {l.descricao}
                {q !== 1 && <span className="text-zinc-500"> · {txtNum(q)} × {dinheiro(p)}</span>}
              </span>
              <span className="tabular-nums">{dinheiro(q * p)}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {linhas.length > 0 && (
        <div className="space-y-2">
          {linhas.map((l, i) => (
            <div key={i} className="grid grid-cols-[6.75rem_minmax(0,1fr)_auto] gap-2 rounded-lg bg-black/20 p-2 sm:grid-cols-[6rem_minmax(0,1fr)_4.5rem_6.5rem_auto]">
              <select value={l.tipo} onChange={(e) => alterar(i, "tipo", e.target.value)} className={`${campo} px-2`}>
                <option value="servico">Serviço</option>
                <option value="peca">Peça</option>
              </select>
              <input value={l.descricao} onChange={(e) => alterar(i, "descricao", e.target.value)} placeholder="Descrição" className={campo} />
              <button onClick={() => setLinhas(linhas.filter((_, j) => j !== i))} aria-label="Remover item" className="rounded-lg px-2 text-rose-300 hover:bg-rose-500/10 sm:order-last">
                ✕
              </button>
              <div className="col-span-3 grid grid-cols-2 gap-2 sm:col-span-2 sm:contents">
                <input value={l.qtd} onChange={(e) => alterar(i, "qtd", e.target.value)} inputMode="decimal" aria-label="Quantidade" placeholder="Qtd" className={`${campo} text-center`} />
                <input value={l.preco} onChange={(e) => alterar(i, "preco", e.target.value)} inputMode="decimal" aria-label="Preço unitário" placeholder="Preço" className={`${campo} text-right`} />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="relative">
        <div className="flex gap-2">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={catalogo.length ? "Procure no catálogo..." : "Cadastre serviços e peças no catálogo"} className={campo} />
          <button
            onClick={() => {
              setLinhas([...linhas, { tipo: "servico", descricao: busca.trim(), qtd: "1", preco: "" }]);
              setBusca("");
            }}
            className={`${botaoSec} shrink-0`}
          >
            + Item livre
          </button>
        </div>
        {achados.length > 0 && (
          <div className="absolute inset-x-0 top-full z-10 mt-1 divide-y divide-white/5 rounded-lg border border-white/10 bg-[#11151b] shadow-xl">
            {achados.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setLinhas([...linhas, { tipo: c.tipo === "peca" ? "peca" : "servico", descricao: c.nome, qtd: "1", preco: txtNum(c.preco) }]);
                  setBusca("");
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-white/5"
              >
                <span>
                  <span className={`mr-2 text-xs ${c.tipo === "peca" ? "text-amber-300" : "text-sky-300"}`}>{c.tipo === "peca" ? "Peça" : "Serviço"}</span>
                  {c.nome}
                </span>
                <span className="tabular-nums text-zinc-400">{dinheiro(c.preco)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Historico({ empresaId, ordemId, eventos, final }: { empresaId: string; ordemId: string; eventos: Evento[]; final: boolean }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [publico, setPublico] = useState(true);
  const [foto, setFoto] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!texto.trim() && !foto) return setErro("Escreva algo ou escolha uma foto.");
    setEnviando(true);
    try {
      const caminho = foto ? await enviarFoto(empresaId, foto) : null;
      const { error } = await criarClienteNavegador().rpc("adicionar_nota", { p_os: ordemId, p_texto: texto, p_publico: publico, p_foto: caminho });
      if (error) throw error;
      setTexto("");
      setFoto(null);
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch (err) {
      setErro(mensagemErro(err));
    }
    setEnviando(false);
  }

  return (
    <Bloco titulo="Histórico">
      <ol className="space-y-3">
        {eventos.map((ev) => (
          <li key={ev.id} className="relative border-l border-white/10 pl-3">
            <span className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ${ev.tipo === "status" ? "bg-sky-400" : ev.tipo === "foto" ? "bg-amber-400" : "bg-zinc-500"}`} />
            {ev.status && <p className="text-xs text-zinc-500">{STATUS[ev.status as Status]?.nome}</p>}
            {ev.texto && <p className="whitespace-pre-wrap text-sm">{ev.texto}</p>}
            {ev.foto && (
              <a href={urlFoto(ev.foto)} target="_blank" className="mt-1 block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urlFoto(ev.foto)} alt="Foto do serviço" className="max-h-48 rounded-lg border border-white/10 object-cover" loading="lazy" />
              </a>
            )}
            <p className="text-xs text-zinc-500">
              {dataHora(ev.created_at)}
              {ev.autor && ` · ${ev.autor}`}
              {!ev.publico && <span className="ml-1 rounded bg-white/5 px-1.5 text-zinc-400">só equipe</span>}
            </p>
          </li>
        ))}
      </ol>
      {!final && (
        <form onSubmit={enviar} className="mt-4 space-y-2 border-t border-white/10 pt-3">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} placeholder="Anotação (ex.: peça pedida, cliente ligou...)" className={campo} maxLength={1000} />
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-zinc-400 file:mr-2 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-zinc-200"
          />
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={publico} onChange={(e) => setPublico(e.target.checked)} className="h-4 w-4 accent-sky-500" />
            Mostrar para o cliente no link
          </label>
          {erro && <Aviso>{erro}</Aviso>}
          <button disabled={enviando} className={`${botaoSec} w-full`}>
            {enviando ? "Enviando..." : foto ? "Enviar foto" : "Adicionar anotação"}
          </button>
        </form>
      )}
    </Bloco>
  );
}

function Janela(props: {
  modal: Exclude<Modal, null>;
  fechar: () => void;
  ocupado: boolean;
  ordem: Ordem;
  total: number;
  pago: number;
  link: string;
  temTel: boolean;
  onWhats: () => void;
  onCopiar: () => void;
  onAprovar: (nome: string) => void;
  onRecusar: (motivo: string) => void;
  onCancelar: (motivo: string) => void;
  onEntregar: (pags: { forma: string; valor: number }[], texto: string) => void;
  onReceber: (forma: string, valor: number) => void;
}) {
  const { modal, fechar, ocupado, ordem, total, pago } = props;
  const falta = Math.max(0, Math.round((total - pago) * 100) / 100);
  const [texto, setTexto] = useState(modal === "aprovar" ? ordem.cliente?.nome ?? "" : "");
  const [pags, setPags] = useState([{ forma: "pix", valor: falta ? txtNum(falta) : "" }]);
  const [recebido, setRecebido] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const soma = pags.reduce((s, p) => s + (lerNumero(p.valor) ?? 0), 0);
  const dinheiroPag = pags.filter((p) => p.forma === "dinheiro").reduce((s, p) => s + (lerNumero(p.valor) ?? 0), 0);
  const troco = dinheiroPag > 0 && lerNumero(recebido) != null ? (lerNumero(recebido) ?? 0) - dinheiroPag : null;

  function confirmarEntrega() {
    setErro(null);
    const lista = pags.map((p) => ({ forma: p.forma, valor: lerNumero(p.valor) ?? 0 })).filter((p) => p.valor > 0);
    const s = Math.round(lista.reduce((a, p) => a + p.valor, 0) * 100) / 100;
    if (s > falta + 0.001) return setErro(`O valor passa do que falta (${dinheiro(falta)}).`);
    if (s < falta - 0.001 && !window.confirm(`Vai ficar ${dinheiro(falta - s)} a receber (fiado). Confirmar a entrega assim?`)) return;
    props.onEntregar(lista, texto);
  }

  const titulo = {
    aprovar: "Cliente aprovou o orçamento",
    recusar: "Cliente recusou o orçamento",
    cancelar: "Cancelar esta ordem de serviço",
    entregar: ordem.status === "recusada" ? "Devolver ao cliente" : "Entregar e receber",
    receber: "Receber pagamento",
    enviar: "Orçamento pronto para o cliente",
  }[modal];

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={fechar}>
      <div className="w-full max-w-md space-y-4 rounded-t-2xl border border-white/10 bg-[#11151b] p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button onClick={fechar} aria-label="Fechar" className="text-zinc-400 hover:text-white">
            ✕
          </button>
        </div>

        {modal === "enviar" && (
          <>
            <p className="text-sm text-zinc-300">Mande o link para o cliente. Ele vê os itens, o valor e aprova pelo celular.</p>
            <p className="break-all rounded-lg bg-black/40 px-3 py-2 font-mono text-xs text-zinc-300">{props.link}</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={props.onWhats} className={botao}>
                {props.temTel ? "Enviar no WhatsApp" : "Copiar mensagem"}
              </button>
              <button onClick={props.onCopiar} className={botaoSec}>
                Copiar link
              </button>
            </div>
          </>
        )}

        {modal === "aprovar" && (
          <label className="block space-y-1">
            <span className={rotulo}>Quem aprovou</span>
            <input value={texto} onChange={(e) => setTexto(e.target.value)} className={campo} autoFocus />
          </label>
        )}
        {(modal === "recusar" || modal === "cancelar") && (
          <label className="block space-y-1">
            <span className={rotulo}>Motivo (opcional)</span>
            <input value={texto} onChange={(e) => setTexto(e.target.value)} className={campo} autoFocus placeholder={modal === "recusar" ? "ex.: achou caro, vai pensar" : ""} />
          </label>
        )}

        {modal === "receber" && (
          <Receber falta={falta} onReceber={props.onReceber} ocupado={ocupado} />
        )}

        {modal === "entregar" && (
          <>
            {total > 0 ? (
              <>
                <div className="space-y-1 rounded-lg bg-black/30 p-3 text-sm">
                  <div className="flex justify-between"><span>Total</span><span className="tabular-nums">{dinheiro(total)}</span></div>
                  {pago > 0 && <div className="flex justify-between text-zinc-400"><span>Já recebido</span><span className="tabular-nums">− {dinheiro(pago)}</span></div>}
                  <div className="flex justify-between font-semibold"><span>Falta</span><span className="tabular-nums">{dinheiro(falta)}</span></div>
                </div>
                {falta > 0 && (
                  <div className="space-y-2">
                    {pags.map((p, i) => (
                      <div key={i} className="flex gap-2">
                        <select value={p.forma} onChange={(e) => setPags(pags.map((x, j) => (j === i ? { ...x, forma: e.target.value } : x)))} className={`${campo} w-36`}>
                          {Object.entries(FORMAS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                        <input value={p.valor} onChange={(e) => setPags(pags.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))} inputMode="decimal" className={`${campo} text-right`} />
                        {pags.length > 1 && (
                          <button onClick={() => setPags(pags.filter((_, j) => j !== i))} className="px-2 text-rose-300">✕</button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => setPags([...pags, { forma: "dinheiro", valor: soma < falta ? txtNum(Math.round((falta - soma) * 100) / 100) : "" }])}
                      className="text-sm text-sky-300 hover:underline"
                    >
                      + Dividir em outra forma
                    </button>
                    {dinheiroPag > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-zinc-400">Cliente deu em dinheiro</span>
                        <input value={recebido} onChange={(e) => setRecebido(e.target.value)} inputMode="decimal" placeholder="0,00" className={`${campo} w-28 text-right`} />
                        {troco != null && troco >= 0 && <span className="font-semibold text-emerald-300">Troco {dinheiro(troco)}</span>}
                      </div>
                    )}
                    {soma < falta - 0.001 && <p className="text-xs text-amber-300">Fica {dinheiro(falta - soma)} a receber.</p>}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-zinc-300">O cliente leva de volta sem o serviço. Nada a cobrar.</p>
            )}
            <label className="block space-y-1">
              <span className={rotulo}>Observação (opcional)</span>
              <input value={texto} onChange={(e) => setTexto(e.target.value)} className={campo} placeholder="ex.: retirado pelo irmão" />
            </label>
          </>
        )}

        {erro && <Aviso>{erro}</Aviso>}

        {modal !== "enviar" && modal !== "receber" && (
          <div className="flex gap-2">
            <button
              disabled={ocupado}
              onClick={() => {
                if (modal === "aprovar") return texto.trim().length < 2 ? setErro("Informe quem aprovou.") : props.onAprovar(texto.trim());
                if (modal === "recusar") return props.onRecusar(texto);
                if (modal === "cancelar") return props.onCancelar(texto);
                if (modal === "entregar") return confirmarEntrega();
              }}
              className={modal === "cancelar" ? "rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50" : botao}
            >
              {ocupado ? "Salvando..." : modal === "cancelar" ? "Cancelar ordem" : "Confirmar"}
            </button>
            <button onClick={fechar} className={botaoSec}>
              Voltar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Receber({ falta, onReceber, ocupado }: { falta: number; onReceber: (forma: string, valor: number) => void; ocupado: boolean }) {
  const [forma, setForma] = useState("pix");
  const [valor, setValor] = useState(txtNum(falta));
  const [erro, setErro] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400">Falta receber {dinheiro(falta)}.</p>
      <div className="flex gap-2">
        <select value={forma} onChange={(e) => setForma(e.target.value)} className={`${campo} w-36`}>
          {Object.entries(FORMAS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" className={`${campo} text-right`} />
      </div>
      {erro && <Aviso>{erro}</Aviso>}
      <button
        disabled={ocupado}
        onClick={() => {
          const v = lerNumero(valor);
          if (v == null || v <= 0) return setErro("Informe o valor.");
          if (v > falta + 0.001) return setErro(`O valor passa do que falta (${dinheiro(falta)}).`);
          onReceber(forma, v);
        }}
        className={botao}
      >
        {ocupado ? "Salvando..." : "Registrar"}
      </button>
    </div>
  );
}
