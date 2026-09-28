import { notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { exigirTela, TODOS } from "@/lib/contexto";
import { dataHora, dinheiro } from "@/lib/formato";
import { FORMAS, STATUS, dataCurta, type Ordem } from "@/lib/os";
import BotaoImprimir from "./BotaoImprimir";

export const dynamic = "force-dynamic";

export default async function ImprimirOS({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, empresa } = await exigirTela(TODOS);
  const [{ data: o }, { data: itens }, { data: pagamentos }, { data: equipe }] = await Promise.all([
    supabase.from("ordens").select("*, cliente:clientes(id, nome, telefone, documento)").eq("id", id).maybeSingle(),
    supabase.from("os_itens").select("tipo, descricao, quantidade, preco_unit, total").eq("ordem_id", id).order("ordem"),
    supabase.from("os_pagamentos").select("forma, valor").eq("ordem_id", id),
    supabase.from("usuarios_empresa").select("user_id, nome"),
  ]);
  if (!o) notFound();
  const ordem = o as Ordem;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const link = `${proto}://${host}/o/${ordem.token}`;
  const qr = await QRCode.toDataURL(link, { margin: 1, width: 220 });

  const subtotal = (itens ?? []).reduce((s, i) => s + Number(i.total), 0);
  const total = subtotal - Number(ordem.desconto);
  const pago = (pagamentos ?? []).reduce((s, p) => s + Number(p.valor), 0);
  const tecnico = (equipe ?? []).find((m) => m.user_id === ordem.tecnico_id)?.nome;
  const ehOrcamento = ["orcamento", "aguardando", "recusada"].includes(ordem.status);

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-[13px] leading-snug text-black print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <BotaoImprimir />
      </div>

      <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-3">
        <div>
          <p className="text-lg font-bold">{empresa.nome}</p>
          {empresa.documento && <p>{empresa.documento}</p>}
          {empresa.endereco && <p>{empresa.endereco}</p>}
          {empresa.telefone && <p>WhatsApp: {empresa.telefone}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide">{ehOrcamento ? "Orçamento" : "Ordem de serviço"}</p>
          <p className="text-2xl font-bold">Nº {ordem.numero}</p>
          <p>Entrada: {dataHora(ordem.created_at)}</p>
          <p>Situação: {ordem.sem_servico ? "Devolvida sem serviço" : STATUS[ordem.status].nome}</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4 border-b border-black/30 py-3">
        <div>
          <p className="text-xs font-semibold uppercase">Cliente</p>
          <p className="font-medium">{ordem.cliente?.nome}</p>
          {ordem.cliente?.telefone && <p>Tel.: {ordem.cliente.telefone}</p>}
          {ordem.cliente?.documento && <p>CPF/CNPJ: {ordem.cliente.documento}</p>}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase">Veículo / equipamento</p>
          <p className="font-medium">{ordem.equipamento}</p>
          {ordem.identificacao && <p>Placa / série: {ordem.identificacao}</p>}
          {ordem.detalhes && <p>{ordem.detalhes}</p>}
        </div>
      </section>

      <section className="space-y-2 border-b border-black/30 py-3">
        {ordem.defeito && (
          <p>
            <b>Defeito relatado:</b> {ordem.defeito}
          </p>
        )}
        {ordem.diagnostico && (
          <p>
            <b>Diagnóstico:</b> {ordem.diagnostico}
          </p>
        )}
        <p className="flex flex-wrap gap-x-6">
          {ordem.previsao && (
            <span>
              <b>Previsão:</b> {dataCurta(ordem.previsao)}
            </span>
          )}
          {tecnico && (
            <span>
              <b>Responsável:</b> {tecnico}
            </span>
          )}
        </p>
      </section>

      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr className="border-b border-black text-left text-xs uppercase">
            <th className="py-1 pr-2">Tipo</th>
            <th className="py-1 pr-2">Descrição</th>
            <th className="py-1 pr-2 text-right">Qtd</th>
            <th className="py-1 pr-2 text-right">Unit.</th>
            <th className="py-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {(itens ?? []).map((i, k) => (
            <tr key={k} className="border-b border-black/15">
              <td className="py-1 pr-2">{i.tipo === "peca" ? "Peça" : "Serviço"}</td>
              <td className="py-1 pr-2">{i.descricao}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{String(Number(i.quantidade)).replace(".", ",")}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{dinheiro(i.preco_unit)}</td>
              <td className="py-1 text-right tabular-nums">{dinheiro(i.total)}</td>
            </tr>
          ))}
          {!(itens ?? []).length && (
            <tr>
              <td colSpan={5} className="py-3 text-center text-black/60">
                Orçamento ainda não preenchido.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-3 flex items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR do link" className="h-24 w-24" />
          <p className="max-w-[14rem] text-xs">Aponte a câmera do celular para acompanhar a OS{ehOrcamento ? " e aprovar o orçamento" : ""}.</p>
        </div>
        <div className="w-60 space-y-0.5">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="tabular-nums">{dinheiro(subtotal)}</span>
          </div>
          {Number(ordem.desconto) > 0 && (
            <div className="flex justify-between">
              <span>Desconto</span>
              <span className="tabular-nums">− {dinheiro(ordem.desconto)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-black pt-0.5 text-base font-bold">
            <span>Total</span>
            <span className="tabular-nums">{dinheiro(total)}</span>
          </div>
          {pago > 0 && (
            <>
              <div className="flex justify-between">
                <span>Pago ({(pagamentos ?? []).map((p) => FORMAS[p.forma] ?? p.forma).filter((v, i, a) => a.indexOf(v) === i).join(", ")})</span>
                <span className="tabular-nums">{dinheiro(pago)}</span>
              </div>
              {total - pago > 0.004 && (
                <div className="flex justify-between font-semibold">
                  <span>A pagar</span>
                  <span className="tabular-nums">{dinheiro(total - pago)}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <section className="mt-4 space-y-1 border-t border-black/30 pt-3 text-xs">
        {ordem.garantia_dias > 0 && <p>Garantia de {ordem.garantia_dias} dias sobre o serviço executado, contados da entrega.</p>}
        {empresa.termos && <p className="whitespace-pre-wrap">{empresa.termos}</p>}
        {ordem.aprovado_por && (
          <p>
            Orçamento aprovado por {ordem.aprovado_por} em {dataHora(ordem.aprovado_em!)}
            {ordem.aprovado_via === "link" ? " (pelo link)" : ""}.
          </p>
        )}
      </section>

      <div className="mt-12 grid grid-cols-2 gap-10 text-center text-xs">
        <div className="border-t border-black pt-1">Assinatura do cliente</div>
        <div className="border-t border-black pt-1">{empresa.nome}</div>
      </div>
    </div>
  );
}
