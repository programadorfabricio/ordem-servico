import { exigirTela, BALCAO } from "@/lib/contexto";
import { Titulo } from "@/components/ui";
import NovaOS from "./NovaOS";

export const dynamic = "force-dynamic";

export default async function PaginaNovaOS({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const { supabase } = await exigirTela(BALCAO);
  const sp = await searchParams;
  const [{ data: clientes }, { data: equipe }] = await Promise.all([
    supabase.from("clientes").select("id, nome, telefone, documento").order("nome").limit(3000),
    supabase.from("usuarios_empresa").select("user_id, nome, papel").order("nome"),
  ]);
  return (
    <>
      <Titulo sub="Anote o que o cliente trouxe e o que ele relatou. O orçamento você monta depois.">Nova ordem de serviço</Titulo>
      <NovaOS clientes={clientes ?? []} equipe={(equipe ?? []).filter((e) => e.nome)} clienteInicial={sp.cliente} />
    </>
  );
}
