"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { mensagemErro } from "@/lib/formato";
import { Aviso, botao, botaoSec, campo, rotulo } from "@/components/ui";

type Cli = { id: string; nome: string; telefone: string; documento: string };
type Membro = { user_id: string; nome: string; papel: string };

export default function NovaOS({ clientes, equipe, clienteInicial }: { clientes: Cli[]; equipe: Membro[]; clienteInicial?: string }) {
  const router = useRouter();
  const [escolhido, setEscolhido] = useState<Cli | null>(clientes.find((c) => c.id === clienteInicial) ?? null);
  const [busca, setBusca] = useState("");
  const [novo, setNovo] = useState({ nome: "", telefone: "", documento: "" });
  const [f, setF] = useState({ equipamento: "", identificacao: "", detalhes: "", defeito: "", previsao: "", tecnico: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const sugestoes = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (t.length < 2) return [];
    const n = t.replace(/\D/g, "");
    return clientes
      .filter((c) => c.nome.toLowerCase().includes(t) || (n.length >= 3 && (c.telefone.replace(/\D/g, "").includes(n) || c.documento.replace(/\D/g, "").includes(n))))
      .slice(0, 8);
  }, [busca, clientes]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const cliente = escolhido ? { id: escolhido.id } : { nome: novo.nome || busca, telefone: novo.telefone, documento: novo.documento };
    if (!escolhido && (cliente as { nome: string }).nome.trim().length < 2) return setErro("Escolha um cliente ou digite o nome de um novo.");
    if (!f.equipamento.trim()) return setErro("Informe o veículo ou equipamento.");
    setSalvando(true);
    const { data, error } = await criarClienteNavegador().rpc("nova_os", {
      p_cliente: cliente,
      p_equipamento: f.equipamento,
      p_identificacao: f.identificacao,
      p_detalhes: f.detalhes,
      p_defeito: f.defeito,
      p_previsao: f.previsao || null,
      p_tecnico: f.tecnico || null,
    });
    if (error) {
      setSalvando(false);
      return setErro(mensagemErro(error));
    }
    router.replace(`/ordens/${data}`);
  }

  const mudar = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <form onSubmit={criar} className="grid max-w-4xl gap-5 lg:grid-cols-2">
      <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-semibold">Cliente</h2>
        {escolhido ? (
          <div className="flex items-center gap-3 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{escolhido.nome}</p>
              <p className="truncate text-sm text-zinc-400">{escolhido.telefone || "Sem telefone"}</p>
            </div>
            <button type="button" onClick={() => setEscolhido(null)} className={botaoSec}>
              Trocar
            </button>
          </div>
        ) : (
          <>
            <label className="block space-y-1">
              <span className={rotulo}>Procure pelo nome ou telefone (ou digite o nome de um cliente novo)</span>
              <input
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setNovo({ ...novo, nome: e.target.value });
                }}
                className={campo}
                autoFocus
              />
            </label>
            {sugestoes.length > 0 && (
              <div className="divide-y divide-white/5 rounded-lg border border-white/10">
                {sugestoes.map((c) => (
                  <button type="button" key={c.id} onClick={() => setEscolhido(c)} className="block w-full px-3 py-2 text-left hover:bg-white/5">
                    <span className="block text-sm">{c.nome}</span>
                    <span className="block text-xs text-zinc-400">{c.telefone || "Sem telefone"}</span>
                  </button>
                ))}
              </div>
            )}
            {busca.trim().length >= 2 && (
              <div className="space-y-2 rounded-lg border border-dashed border-white/15 p-3">
                <p className="text-xs text-zinc-400">
                  Cliente novo: <span className="text-zinc-200">{busca.trim()}</span>
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={novo.telefone} onChange={(e) => setNovo({ ...novo, telefone: e.target.value })} placeholder="WhatsApp" inputMode="tel" className={campo} />
                  <input value={novo.documento} onChange={(e) => setNovo({ ...novo, documento: e.target.value })} placeholder="CPF (opcional)" className={campo} />
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="font-semibold">Veículo ou equipamento</h2>
        <label className="block space-y-1">
          <span className={rotulo}>O que é (marca, modelo, ano)</span>
          <input value={f.equipamento} onChange={mudar("equipamento")} placeholder="ex.: Honda CG 160 2019 · Split LG 12.000 BTUs" className={campo} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className={rotulo}>Placa / nº de série</span>
            <input value={f.identificacao} onChange={mudar("identificacao")} className={`${campo} font-mono uppercase`} />
          </label>
          <label className="block space-y-1">
            <span className={rotulo}>Km, cor, acessórios...</span>
            <input value={f.detalhes} onChange={mudar("detalhes")} className={campo} />
          </label>
        </div>
        <label className="block space-y-1">
          <span className={rotulo}>Defeito relatado pelo cliente</span>
          <textarea value={f.defeito} onChange={mudar("defeito")} rows={3} className={campo} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className={rotulo}>Previsão de entrega</span>
            <input type="date" value={f.previsao} onChange={mudar("previsao")} className={campo} />
          </label>
          <label className="block space-y-1">
            <span className={rotulo}>Responsável</span>
            <select value={f.tecnico} onChange={mudar("tecnico")} className={campo}>
              <option value="">— ninguém ainda —</option>
              {equipe.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="space-y-3 lg:col-span-2">
        {erro && <Aviso>{erro}</Aviso>}
        <button disabled={salvando} className={`${botao} w-full sm:w-auto`}>
          {salvando ? "Abrindo..." : "Abrir ordem de serviço"}
        </button>
      </div>
    </form>
  );
}
