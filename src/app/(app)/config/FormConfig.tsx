"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { mensagemErro } from "@/lib/formato";
import type { Empresa } from "@/lib/contexto";
import { Aviso, botao, campo, rotulo } from "@/components/ui";

export default function FormConfig({ empresa }: { empresa: Empresa }) {
  const router = useRouter();
  const [f, setF] = useState({
    nome: empresa.nome,
    telefone: empresa.telefone,
    endereco: empresa.endereco,
    documento: empresa.documento,
    garantia: String(empresa.garantia_dias),
    validade: String(empresa.validade_dias),
    termos: empresa.termos,
  });
  const [msg, setMsg] = useState<{ erro?: string; ok?: string }>({});
  const [salvando, setSalvando] = useState(false);
  const mudar = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const g = Number(f.garantia);
    const v = Number(f.validade);
    if (!Number.isInteger(g) || g < 0) return setMsg({ erro: "Garantia: número de dias (0 = sem garantia)." });
    if (!Number.isInteger(v) || v < 1) return setMsg({ erro: "Validade do orçamento: número de dias." });
    setSalvando(true);
    const { error } = await criarClienteNavegador().rpc("salvar_config", {
      p_nome: f.nome,
      p_telefone: f.telefone,
      p_endereco: f.endereco,
      p_documento: f.documento,
      p_garantia: g,
      p_validade: v,
      p_termos: f.termos,
    });
    setSalvando(false);
    if (error) return setMsg({ erro: mensagemErro(error) });
    setMsg({ ok: "Salvo." });
    router.refresh();
  }

  return (
    <form onSubmit={salvar} className="max-w-2xl space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 sm:col-span-2">
          <span className={rotulo}>Nome da empresa</span>
          <input value={f.nome} onChange={mudar("nome")} className={campo} maxLength={80} required />
        </label>
        <label className="block space-y-1">
          <span className={rotulo}>WhatsApp da empresa</span>
          <input value={f.telefone} onChange={mudar("telefone")} className={campo} placeholder="(19) 99999-9999" inputMode="tel" />
        </label>
        <label className="block space-y-1">
          <span className={rotulo}>CNPJ ou CPF (sai na impressão)</span>
          <input value={f.documento} onChange={mudar("documento")} className={campo} />
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className={rotulo}>Endereço</span>
          <input value={f.endereco} onChange={mudar("endereco")} className={campo} maxLength={200} />
        </label>
        <label className="block space-y-1">
          <span className={rotulo}>Garantia padrão (dias)</span>
          <input value={f.garantia} onChange={mudar("garantia")} className={campo} inputMode="numeric" />
        </label>
        <label className="block space-y-1">
          <span className={rotulo}>Validade do orçamento (dias)</span>
          <input value={f.validade} onChange={mudar("validade")} className={campo} inputMode="numeric" />
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className={rotulo}>Observações do orçamento (rodapé)</span>
          <textarea value={f.termos} onChange={mudar("termos")} rows={4} className={campo} maxLength={2000} />
        </label>
      </div>
      {msg.erro && <Aviso>{msg.erro}</Aviso>}
      {msg.ok && <Aviso tipo="ok">{msg.ok}</Aviso>}
      <button disabled={salvando} className={botao}>
        {salvando ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}
