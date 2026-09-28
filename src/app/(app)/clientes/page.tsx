import { exigirTela, BALCAO } from "@/lib/contexto";
import { Titulo } from "@/components/ui";
import GerenciarClientes, { type Cliente } from "./GerenciarClientes";

export const dynamic = "force-dynamic";

export default async function PaginaClientes() {
  const { supabase, empresa } = await exigirTela(BALCAO);
  const { data } = await supabase
    .from("clientes")
    .select("id, nome, telefone, documento, email, endereco, observacao, ordens(count)")
    .order("nome")
    .limit(2000);
  const clientes = (data ?? []).map((c) => ({ ...c, qtd: (c.ordens as unknown as { count: number }[])?.[0]?.count ?? 0 })) as Cliente[];
  return (
    <>
      <Titulo sub={`${clientes.length} cliente${clientes.length === 1 ? "" : "s"}. O cadastro também é feito ao abrir uma OS.`}>Clientes</Titulo>
      <GerenciarClientes empresaId={empresa.id} clientes={clientes} />
    </>
  );
}
