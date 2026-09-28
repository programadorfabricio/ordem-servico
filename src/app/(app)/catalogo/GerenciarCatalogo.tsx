"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { dinheiro, lerNumero, mensagemErro } from "@/lib/formato";
import { Aviso, botao, botaoSec, campo, rotulo } from "@/components/ui";

export type ItemCatalogo = { id: string; tipo: "servico" | "peca"; nome: string; preco: number; ativo: boolean };

const vazio = { id: "", tipo: "servico" as "servico" | "peca", nome: "", preco: "" };

export default function GerenciarCatalogo({ empresaId, itens }: { empresaId: string; itens: ItemCatalogo[] }) {
  const router = useRouter();
  const [f, setF] = useState(vazio);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const preco = lerNumero(f.preco);
    if (!f.nome.trim()) return setErro("Informe o nome.");
    if (preco == null || preco < 0) return setErro("Preço inválido.");
    setSalvando(true);
    const sb = criarClienteNavegador().from("catalogo");
    const dados = { tipo: f.tipo, nome: f.nome.trim(), preco };
    const { error } = f.id ? await sb.update(dados).eq("id", f.id) : await sb.insert({ ...dados, empresa_id: empresaId });
    setSalvando(false);
    if (error) return setErro(mensagemErro(error));
    setF({ ...vazio, tipo: f.tipo });
    router.refresh();
  }

  async function alternar(i: ItemCatalogo) {
    const { error } = await criarClienteNavegador().from("catalogo").update({ ativo: !i.ativo }).eq("id", i.id);
    if (error) return setErro(mensagemErro(error));
    router.refresh();
  }

  const t = busca.trim().toLowerCase();
  const lista = itens.filter((i) => !t || i.nome.toLowerCase().includes(t));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-4">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar..." className={campo} />
        {(["servico", "peca"] as const).map((tipo) => {
          const doTipo = lista.filter((i) => i.tipo === tipo);
          return (
            <div key={tipo}>
              <h2 className="mb-2 text-sm font-semibold text-zinc-300">{tipo === "servico" ? "Serviços (mão de obra)" : "Peças e materiais"}</h2>
              {doTipo.length === 0 && <p className="text-sm text-zinc-500">Nada cadastrado.</p>}
              <div className="divide-y divide-white/5 rounded-xl border border-white/10">
                {doTipo.map((i) => (
                  <div key={i.id} className={`flex items-center gap-3 px-3 py-2 ${i.ativo ? "" : "opacity-50"}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{i.nome}</p>
                      <p className="text-xs text-zinc-400 tabular-nums">{dinheiro(i.preco)}</p>
                    </div>
                    <button
                      onClick={() => setF({ id: i.id, tipo: i.tipo, nome: i.nome, preco: String(i.preco).replace(".", ",") })}
                      className={botaoSec}
                    >
                      Editar
                    </button>
                    <button onClick={() => alternar(i)} className="rounded-lg px-2 py-2 text-xs text-zinc-400 hover:bg-white/5">
                      {i.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={salvar} className="h-fit space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-semibold">{f.id ? "Editar" : "Novo item"}</h2>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-black/30 p-1 text-sm">
          {(["servico", "peca"] as const).map((tp) => (
            <button
              type="button"
              key={tp}
              onClick={() => setF({ ...f, tipo: tp })}
              className={`rounded-md py-1.5 ${f.tipo === tp ? "bg-sky-500 font-semibold text-black" : "text-zinc-300"}`}
            >
              {tp === "servico" ? "Serviço" : "Peça"}
            </button>
          ))}
        </div>
        <label className="block space-y-1">
          <span className={rotulo}>Nome</span>
          <input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} className={campo} maxLength={120} />
        </label>
        <label className="block space-y-1">
          <span className={rotulo}>Preço</span>
          <input value={f.preco} onChange={(e) => setF({ ...f, preco: e.target.value })} className={campo} inputMode="decimal" placeholder="0,00" />
        </label>
        {erro && <Aviso>{erro}</Aviso>}
        <div className="flex gap-2">
          <button disabled={salvando} className={`${botao} flex-1`}>
            {salvando ? "Salvando..." : f.id ? "Salvar" : "Adicionar"}
          </button>
          {f.id && (
            <button type="button" onClick={() => setF(vazio)} className={botaoSec}>
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
