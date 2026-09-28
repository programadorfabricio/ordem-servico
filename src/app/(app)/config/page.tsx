import { exigirTela } from "@/lib/contexto";
import { Titulo } from "@/components/ui";
import FormConfig from "./FormConfig";

export const dynamic = "force-dynamic";

export default async function PaginaConfig() {
  const { empresa } = await exigirTela(["dono"]);
  return (
    <>
      <Titulo sub="Esses dados aparecem no orçamento, na impressão e no link do cliente.">Configurações</Titulo>
      <FormConfig empresa={empresa} />
    </>
  );
}
