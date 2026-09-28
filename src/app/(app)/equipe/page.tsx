import { exigirTela } from "@/lib/contexto";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { usuarioDoEmail } from "@/lib/papeis";
import { Aviso, Titulo } from "@/components/ui";
import GerenciarEquipe, { type Acesso } from "./GerenciarEquipe";

export const dynamic = "force-dynamic";

export default async function PaginaEquipe() {
  const { supabase, user } = await exigirTela(["dono"]);

  const admin = criarClienteAdmin();
  const { data } = await supabase.from("usuarios_empresa").select("user_id, papel, nome, created_at").order("created_at");
  const acessos: Acesso[] = await Promise.all(
    (data ?? []).map(async (v) => {
      let email = v.user_id === user.id ? user.email ?? "" : "";
      if (!email && admin) email = (await admin.auth.admin.getUserById(v.user_id)).data.user?.email ?? "";
      return { user_id: v.user_id, papel: v.papel, nome: v.nome, usuario: usuarioDoEmail(email), eu: v.user_id === user.id };
    })
  );

  return (
    <>
      <Titulo sub="Um login para cada pessoa. O nome aparece na OS e no histórico.">Equipe</Titulo>
      {!admin && <Aviso>Falta a SUPABASE_SECRET_KEY na Vercel: sem ela não dá para criar logins.</Aviso>}
      <GerenciarEquipe acessos={acessos} />
    </>
  );
}
