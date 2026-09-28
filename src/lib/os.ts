// Status da OS: nome, cor e para onde pode ir
export type Status = "orcamento" | "aguardando" | "aprovada" | "recusada" | "andamento" | "peca" | "pronta" | "entregue" | "cancelada";

export const STATUS: Record<Status, { nome: string; cor: string }> = {
  orcamento: { nome: "Orçamento", cor: "bg-zinc-500/15 text-zinc-300" },
  aguardando: { nome: "Aguardando cliente", cor: "bg-amber-500/15 text-amber-300" },
  aprovada: { nome: "Aprovada", cor: "bg-sky-500/15 text-sky-300" },
  recusada: { nome: "Recusada", cor: "bg-rose-500/15 text-rose-300" },
  andamento: { nome: "Em andamento", cor: "bg-violet-500/15 text-violet-300" },
  peca: { nome: "Aguardando peça", cor: "bg-orange-500/15 text-orange-300" },
  pronta: { nome: "Pronta", cor: "bg-emerald-500/15 text-emerald-300" },
  entregue: { nome: "Entregue", cor: "bg-white/5 text-zinc-400" },
  cancelada: { nome: "Cancelada", cor: "bg-white/5 text-zinc-500 line-through" },
};

export const ABERTAS: Status[] = ["orcamento", "aguardando", "aprovada", "recusada", "andamento", "peca", "pronta"];

export type Ordem = {
  id: string;
  numero: number;
  token: string;
  status: Status;
  equipamento: string;
  identificacao: string;
  detalhes: string;
  defeito: string;
  diagnostico: string;
  previsao: string | null;
  desconto: number;
  garantia_dias: number;
  tecnico_id: string | null;
  enviado_em: string | null;
  aprovado_em: string | null;
  aprovado_por: string | null;
  aprovado_via: string | null;
  recusado_em: string | null;
  recusa_motivo: string | null;
  pronto_em: string | null;
  entregue_em: string | null;
  sem_servico: boolean;
  created_at: string;
  atualizado_em: string;
  cliente: { id: string; nome: string; telefone: string; documento: string } | null;
};

export type Item = { id?: string; tipo: "servico" | "peca"; descricao: string; quantidade: number; preco_unit: number; total?: number };
export type Evento = { id: string; tipo: "status" | "nota" | "foto"; status: string | null; texto: string; foto: string | null; publico: boolean; autor: string; created_at: string };
export type Pagamento = { id: string; forma: string; valor: number; created_at: string };

export const FORMAS: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  debito: "Débito",
  credito: "Crédito",
  boleto: "Boleto",
  outro: "Outro",
};

// Telefone só com números, com 55 na frente, para o link do WhatsApp
export function telWhats(tel: string) {
  const n = (tel || "").replace(/\D/g, "");
  if (!n) return "";
  return n.length <= 11 ? `55${n}` : n;
}

export function linkWhats(tel: string, texto: string) {
  const n = telWhats(tel);
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

export const dataCurta = (d: string | null) => {
  if (!d) return "";
  const s = d.length === 10 ? `${d}T12:00:00-03:00` : d;
  return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
};

export const hojeSP = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
