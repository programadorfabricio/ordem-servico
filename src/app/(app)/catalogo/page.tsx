import { exigirTela, GESTAO } from "@/lib/contexto";
import { Titulo } from "@/components/ui";
import GerenciarCatalogo, { type ItemCatalogo } from "./GerenciarCatalogo";

export const dynamic = "force-dynamic";

export default async function PaginaCatalogo() {
  const { supabase, empresa } = await exigirTela(GESTAO);
  const { data } = await supabase.from("catalogo").select("id, tipo, nome, preco, ativo").order("tipo").order("nome");
  return (
    <>
      <Titulo sub="Cadastre o que você mais faz e mais vende. No orçamento é só tocar para lançar.">Serviços e peças</Titulo>
      <GerenciarCatalogo empresaId={empresa.id} itens={(data ?? []) as ItemCatalogo[]} />
    </>
  );
}
