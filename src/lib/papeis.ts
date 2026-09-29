export type Papel = "dono" | "gerente" | "atendente" | "tecnico";

export const PAPEIS: { papel: Papel; nome: string; tela: string; explica: string }[] = [
  { papel: "dono", nome: "Dono", tela: "/painel", explica: "Vê tudo, cadastra a equipe e as configurações" },
  { papel: "gerente", nome: "Gerente", tela: "/painel", explica: "Vê tudo, menos equipe e configurações" },
  { papel: "atendente", nome: "Atendente / Balcão", tela: "/ordens", explica: "Abre a ordem de serviço, faz orçamento, entrega e recebe" },
  { papel: "tecnico", nome: "Técnico / Mecânico", tela: "/ordens", explica: "Vê as ordens, anota o diagnóstico, marca andamento e pronto" },
];

export const nomePapel = (p: string | null | undefined) => PAPEIS.find((x) => x.papel === p)?.nome ?? "—";
export const telaDoPapel = (p: string | null | undefined) => PAPEIS.find((x) => x.papel === p)?.tela ?? "/login";
export const ehGestao = (p: string | null | undefined) => p === "dono" || p === "gerente";
export const ehBalcao = (p: string | null | undefined) => p === "dono" || p === "gerente" || p === "atendente";

// Logins da equipe viram e-mail interno (ninguém recebe e-mail nenhum)
export const DOMINIO_EQUIPE = "acesso.fhdigitalmarketing.com";
export function emailDoUsuario(login: string) {
  const v = login.trim().toLowerCase();
  return v.includes("@") ? v : `${v}@${DOMINIO_EQUIPE}`;
}
export function usuarioDoEmail(email: string | null | undefined) {
  if (!email) return "";
  return email.endsWith(`@${DOMINIO_EQUIPE}`) ? email.slice(0, -DOMINIO_EQUIPE.length - 1) : email;
}
