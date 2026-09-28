import { notFound } from "next/navigation";
import { exigirTela, TODOS } from "@/lib/contexto";
import type { Evento, Item, Ordem, Pagamento } from "@/lib/os";
import AtualizarAoVivo from "@/components/AtualizarAoVivo";
import DetalheOS from "./DetalheOS";

export const dynamic = "force-dynamic";

export default async function PaginaOS({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, empresa, papel } = await exigirTela(TODOS);

  const [{ data: ordem }, { data: itens }, { data: eventos }, { data: pagamentos }, { data: equipe }, { data: catalogo }] = await Promise.all([
    supabase.from("ordens").select("*, cliente:clientes(id, nome, telefone, documento)").eq("id", id).maybeSingle(),
    supabase.from("os_itens").select("id, tipo, descricao, quantidade, preco_unit, total").eq("ordem_id", id).order("ordem"),
    supabase.from("os_eventos").select("id, tipo, status, texto, foto, publico, autor, created_at").eq("ordem_id", id).order("created_at"),
    supabase.from("os_pagamentos").select("id, forma, valor, created_at").eq("ordem_id", id).order("created_at"),
    supabase.from("usuarios_empresa").select("user_id, nome").order("nome"),
    supabase.from("catalogo").select("id, tipo, nome, preco").eq("ativo", true).order("nome"),
  ]);
  if (!ordem) notFound();

  return (
    <>
      <AtualizarAoVivo empresaId={empresa.id} tabelas={["ordens", "os_eventos", "os_pagamentos"]} />
      <DetalheOS
        empresa={empresa}
        papel={papel}
        ordem={ordem as Ordem}
        itens={(itens ?? []).map((i) => ({ ...i, quantidade: Number(i.quantidade), preco_unit: Number(i.preco_unit), total: Number(i.total) })) as Item[]}
        eventos={(eventos ?? []) as Evento[]}
        pagamentos={(pagamentos ?? []).map((p) => ({ ...p, valor: Number(p.valor) })) as Pagamento[]}
        equipe={(equipe ?? []).filter((e) => e.nome)}
        catalogo={(catalogo ?? []).map((c) => ({ ...c, preco: Number(c.preco) }))}
      />
    </>
  );
}
