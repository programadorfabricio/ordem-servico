"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { mensagemErro } from "@/lib/formato";
import { linkWhats } from "@/lib/os";
import { Aviso, botao, botaoSec, campo, rotulo } from "@/components/ui";

export type Cliente = {
  id: string;
  nome: string;
  telefone: string;
  documento: string;
  email: string;
  endereco: string;
  observacao: string;
  qtd: number;
};

const vazio = { id: "", nome: "", telefone: "", documento: "", email: "", endereco: "", observacao: "" };

export default function GerenciarClientes({ empresaId, clientes }: { empresaId: string; clientes: Cliente[] }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [f, setF] = useState<typeof vazio | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const t = busca.trim().toLowerCase();
  const num = t.replace(/\D/g, "");
  const lista = clientes.filter(
    (c) => !t || c.nome.toLowerCase().includes(t) || (num.length >= 3 && (c.telefone.replace(/\D/g, "").includes(num) || c.documento.replace(/\D/g, "").includes(num)))
  );

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!f) return;
    setErro(null);
    if (f.nome.trim().length < 2) return setErro("Informe o nome.");
    setSalvando(true);
    const dados = {
      nome: f.nome.trim(),
      telefone: f.telefone.trim(),
      documento: f.documento.trim(),
      email: f.email.trim(),
      endereco: f.endereco.trim(),
      observacao: f.observacao.trim(),
    };
    const sb = criarClienteNavegador().from("clientes");
    const { error } = f.id ? await sb.update(dados).eq("id", f.id) : await sb.insert({ ...dados, empresa_id: empresaId });
    setSalvando(false);
    if (error) return setErro(mensagemErro(error));
    setF(null);
    router.refresh();
  }

  const mudar = (k: keyof typeof vazio) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => f && setF({ ...f, [k]: e.target.value });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, telefone ou CPF..." className={`${campo} max-w-md flex-1`} />
        <button onClick={() => setF(vazio)} className={botao}>
          + Novo cliente
        </button>
      </div>

      {f && (
        <form onSubmit={salvar} className="grid gap-3 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 sm:grid-cols-2">
          <label className="block space-y-1 sm:col-span-2">
            <span className={rotulo}>Nome</span>
            <input value={f.nome} onChange={mudar("nome")} className={campo} maxLength={120} autoFocus />
          </label>
          <label className="block space-y-1">
            <span className={rotulo}>WhatsApp</span>
            <input value={f.telefone} onChange={mudar("telefone")} className={campo} inputMode="tel" />
          </label>
          <label className="block space-y-1">
            <span className={rotulo}>CPF ou CNPJ</span>
            <input value={f.documento} onChange={mudar("documento")} className={campo} />
          </label>
          <label className="block space-y-1">
            <span className={rotulo}>E-mail</span>
            <input value={f.email} onChange={mudar("email")} className={campo} type="email" />
          </label>
          <label className="block space-y-1">
            <span className={rotulo}>Endereço</span>
            <input value={f.endereco} onChange={mudar("endereco")} className={campo} />
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className={rotulo}>Observação</span>
            <textarea value={f.observacao} onChange={mudar("observacao")} className={campo} rows={2} />
          </label>
          {erro && (
            <div className="sm:col-span-2">
              <Aviso>{erro}</Aviso>
            </div>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <button disabled={salvando} className={botao}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
            <button type="button" onClick={() => setF(null)} className={botaoSec}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="divide-y divide-white/5 rounded-xl border border-white/10">
        {lista.length === 0 && <p className="p-4 text-sm text-zinc-500">Nenhum cliente encontrado.</p>}
        {lista.slice(0, 300).map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{c.nome}</p>
              <p className="truncate text-sm text-zinc-400">
                {[c.telefone, c.documento].filter(Boolean).join(" · ") || "Sem telefone"}
              </p>
            </div>
            <Link href={`/ordens?cliente=${c.id}`} className="text-sm text-sky-300 hover:underline">
              {c.qtd} OS
            </Link>
            {c.telefone && (
              <a href={linkWhats(c.telefone, `Olá, ${c.nome.split(" ")[0]}!`)} target="_blank" rel="noopener" className={botaoSec}>
                WhatsApp
              </a>
            )}
            <button onClick={() => setF({ ...c })} className={botaoSec}>
              Editar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
