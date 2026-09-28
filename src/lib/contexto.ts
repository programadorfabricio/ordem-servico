import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { telaDoPapel, type Papel } from "@/lib/papeis";

export type Empresa = {
  id: string;
  nome: string;
  telefone: string;
  endereco: string;
  documento: string;
  garantia_dias: number;
  validade_dias: number;
  termos: string;
};

const CAMPOS_EMPRESA = "id, nome, telefone, endereco, documento, garantia_dias, validade_dias, termos";

// Usuário logado + empresa + papel. Sem login -> /login
export async function contexto() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("usuarios_empresa")
    .select(`papel, nome, empresa:empresas(${CAMPOS_EMPRESA})`)
    .eq("user_id", user.id)
    .maybeSingle();

  const empresa = (data?.empresa ?? null) as unknown as Empresa | null;
  return { supabase, user, empresa, papel: (data?.papel ?? null) as Papel | null, nome: data?.nome ?? "" };
}

// Garante que o login pode abrir a tela
export async function exigirTela(papeis: Papel[]) {
  const ctx = await contexto();
  if (!ctx.empresa || !ctx.papel) redirect("/sem-empresa");
  if (!papeis.includes(ctx.papel)) redirect(telaDoPapel(ctx.papel));
  return ctx as typeof ctx & { empresa: Empresa; papel: Papel };
}

export const TODOS: Papel[] = ["dono", "gerente", "atendente", "tecnico"];
export const BALCAO: Papel[] = ["dono", "gerente", "atendente"];
export const GESTAO: Papel[] = ["dono", "gerente"];
