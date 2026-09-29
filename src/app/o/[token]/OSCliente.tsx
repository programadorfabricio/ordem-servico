"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { dataHora, dinheiro, mensagemErro } from "@/lib/formato";
import { urlFoto } from "@/lib/fotos";
import { dataCurta, linkWhats } from "@/lib/os";

export type OSPublica = {
  numero: number;
  status: string;
  status_nome: string;
  equipamento: string;
  identificacao: string;
  defeito: string;
  diagnostico: string;
  previsao: string | null;
  garantia_dias: number;
  criado_em: string;
  validade: string | null;
  aprovado_em: string | null;
  aprovado_por: string | null;
  pronto_em: string | null;
  entregue_em: string | null;
  cliente: string;
  empresa: { nome: string; telefone: string; endereco: string; termos: string };
  mostrar_valores: boolean;
  sem_servico: boolean;
  itens: { tipo: string; descricao: string; quantidade: number; preco: number; total: number }[];
  subtotal: number;
  desconto: number;
  total: number;
  pago: number;
  eventos: { tipo: string; status: string | null; texto: string; foto: string | null; quando: string }[];
};

const PASSOS = [
  { id: "orcamento", nome: "Recebido" },
  { id: "aguardando", nome: "Orçamento" },
  { id: "andamento", nome: "Em serviço" },
  { id: "pronta", nome: "Pronto" },
  { id: "entregue", nome: "Entregue" },
];
const ORDEM_PASSO: Record<string, number> = { orcamento: 0, aguardando: 1, recusada: 1, aprovada: 2, andamento: 2, peca: 2, pronta: 3, entregue: 4, cancelada: -1 };

const COR: Record<string, string> = {
  aguardando: "bg-amber-100 text-amber-800",
  aprovada: "bg-sky-100 text-sky-800",
  andamento: "bg-violet-100 text-violet-800",
  peca: "bg-orange-100 text-orange-800",
  pronta: "bg-emerald-100 text-emerald-800",
  recusada: "bg-rose-100 text-rose-800",
  cancelada: "bg-gray-200 text-gray-600",
};

export default function OSCliente({ token, os }: { token: string; os: OSPublica }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const passo = ORDEM_PASSO[os.status] ?? 0;
  const falta = os.sem_servico ? 0 : Math.max(0, os.total - os.pago);
  const fotos = os.eventos.filter((e) => e.foto);

  async function responder(aprovar: boolean) {
    setErro(null);
    if (nome.trim().length < 2) return setErro("Escreva seu nome para confirmar.");
    setEnviando(true);
    const { error } = await criarClienteNavegador().rpc("responder_orcamento", { p_token: token, p_aprovar: aprovar, p_nome: nome, p_motivo: motivo });
    setEnviando(false);
    if (error) return setErro(mensagemErro(error));
    router.refresh();
  }

  return (
    <main className="tema-cliente min-h-screen px-4 py-6">
      <div className="mx-auto max-w-lg space-y-4">
        <header className="text-center">
          <p className="text-sm text-gray-500">{os.empresa.nome}</p>
          <h1 className="mt-1 text-2xl font-bold">
            {os.status === "aguardando" ? "Orçamento" : "Ordem de serviço"} nº {os.numero}
          </h1>
          <p className="text-sm text-gray-500">Olá, {os.cliente}!</p>
          <span className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-medium ${COR[os.status] ?? "bg-gray-100 text-gray-700"}`}>{os.status_nome}</span>
        </header>

        {passo >= 0 && (
          <ol className="flex items-center justify-between rounded-2xl bg-white p-3 shadow-sm">
            {PASSOS.map((p, i) => (
              <li key={p.id} className="flex flex-1 flex-col items-center gap-1 text-center">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i <= passo ? "bg-sky-500 text-white" : "bg-gray-200 text-gray-500"}`}>
                  {i < passo || os.status === "entregue" ? "✓" : i + 1}
                </span>
                <span className={`text-[11px] ${i <= passo ? "text-gray-900" : "text-gray-400"}`}>{p.nome}</span>
              </li>
            ))}
          </ol>
        )}

        <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
          <p className="font-semibold">{os.equipamento}</p>
          {os.identificacao && <p className="font-mono text-sm text-gray-600">{os.identificacao}</p>}
          {os.defeito && (
            <p className="text-sm">
              <span className="text-gray-500">Você relatou:</span> {os.defeito}
            </p>
          )}
          {os.diagnostico && os.mostrar_valores && (
            <p className="text-sm">
              <span className="text-gray-500">O que encontramos:</span> {os.diagnostico}
            </p>
          )}
          {os.previsao && !["pronta", "entregue", "cancelada"].includes(os.status) && (
            <p className="text-sm">
              <span className="text-gray-500">Previsão:</span> {dataCurta(os.previsao)}
            </p>
          )}
        </section>

        {os.mostrar_valores && os.itens.length > 0 && (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-semibold">Serviços e peças</h2>
            <div className="divide-y divide-gray-100 text-sm">
              {os.itens.map((i, k) => (
                <div key={k} className="flex items-baseline justify-between gap-3 py-1.5">
                  <span>
                    {i.descricao}
                    {Number(i.quantidade) !== 1 && <span className="text-gray-500"> · {String(Number(i.quantidade)).replace(".", ",")} × {dinheiro(i.preco)}</span>}
                  </span>
                  <span className="shrink-0 tabular-nums">{dinheiro(i.total)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 space-y-0.5 border-t border-gray-200 pt-2 text-sm">
              {Number(os.desconto) > 0 && (
                <>
                  <div className="flex justify-between text-gray-500"><span>Subtotal</span><span className="tabular-nums">{dinheiro(os.subtotal)}</span></div>
                  <div className="flex justify-between text-emerald-700"><span>Desconto</span><span className="tabular-nums">− {dinheiro(os.desconto)}</span></div>
                </>
              )}
              <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="tabular-nums">{dinheiro(os.total)}</span></div>
              {os.pago > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>{falta > 0 ? "Já pago" : "Pago"}</span>
                  <span className="tabular-nums">{dinheiro(os.pago)}</span>
                </div>
              )}
              {os.pago > 0 && falta > 0 && (
                <div className="flex justify-between font-semibold"><span>Falta pagar</span><span className="tabular-nums">{dinheiro(falta)}</span></div>
              )}
            </div>
          </section>
        )}

        {os.status === "aguardando" && (
          <section className="space-y-3 rounded-2xl border-2 border-sky-500 bg-white p-4 shadow-sm">
            <h2 className="font-semibold">Aprovar o orçamento?</h2>
            {os.validade && <p className="text-sm text-gray-500">Válido até {dataCurta(os.validade)}.</p>}
            <label className="block space-y-1">
              <span className="text-sm text-gray-600">Seu nome</span>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-sky-500"
                autoComplete="name"
              />
            </label>
            {recusando && (
              <label className="block space-y-1">
                <span className="text-sm text-gray-600">Quer dizer o motivo? (opcional)</span>
                <input value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-sky-500" />
              </label>
            )}
            {erro && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</p>}
            {!recusando ? (
              <div className="flex flex-col gap-2">
                <button disabled={enviando} onClick={() => responder(true)} className="rounded-xl bg-sky-500 py-3 font-semibold text-white disabled:opacity-50">
                  {enviando ? "Enviando..." : `Aprovar ${dinheiro(os.total)}`}
                </button>
                <button onClick={() => setRecusando(true)} className="py-2 text-sm text-gray-500 underline">
                  Não quero fazer agora
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button disabled={enviando} onClick={() => responder(false)} className="flex-1 rounded-xl bg-gray-800 py-3 font-semibold text-white disabled:opacity-50">
                  Recusar orçamento
                </button>
                <button onClick={() => setRecusando(false)} className="rounded-xl border border-gray-300 px-4 text-sm">
                  Voltar
                </button>
              </div>
            )}
          </section>
        )}

        {os.status === "aprovada" && os.aprovado_por && (
          <p className="rounded-2xl bg-sky-50 p-4 text-center text-sm text-sky-800">
            Aprovado por {os.aprovado_por} em {dataHora(os.aprovado_em!)}. Obrigado! Avisamos quando ficar pronto.
          </p>
        )}
        {os.status === "pronta" && (
          <p className="rounded-2xl bg-emerald-50 p-4 text-center text-sm text-emerald-800">
            Pronto para retirar{falta > 0 ? `. Valor a pagar: ${dinheiro(falta)}` : ""}.
          </p>
        )}

        {fotos.length > 0 && (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-semibold">Fotos</h2>
            <div className="grid grid-cols-3 gap-2">
              {fotos.map((f, k) => (
                <a key={k} href={urlFoto(f.foto)} target="_blank">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urlFoto(f.foto)} alt={f.texto || "Foto"} className="aspect-square w-full rounded-lg object-cover" loading="lazy" />
                </a>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold">Andamento</h2>
          <ol className="space-y-2">
            {os.eventos.filter((e) => e.texto).map((e, k) => (
              <li key={k} className="border-l-2 border-sky-200 pl-3 text-sm">
                <p>{e.texto}</p>
                <p className="text-xs text-gray-400">{dataHora(e.quando)}</p>
              </li>
            ))}
          </ol>
        </section>

        <footer className="space-y-2 pb-6 text-center text-xs text-gray-500">
          {os.garantia_dias > 0 && <p>Garantia de {os.garantia_dias} dias sobre o serviço, a partir da entrega.</p>}
          {os.empresa.termos && <p className="whitespace-pre-wrap">{os.empresa.termos}</p>}
          {os.empresa.endereco && <p>{os.empresa.endereco}</p>}
          {os.empresa.telefone && (
            <a href={linkWhats(os.empresa.telefone, `Olá! Sobre a ordem de serviço nº ${os.numero} (${os.equipamento}):`)} target="_blank" className="inline-block rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white">
              Falar com a {os.empresa.nome}
            </a>
          )}
          <p className="pt-2 text-gray-400">Ordem de Serviço FH · FH Digital</p>
        </footer>
      </div>
    </main>
  );
}
