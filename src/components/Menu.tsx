"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Papel } from "@/lib/papeis";

const LINKS: { href: string; nome: string; papeis: Papel[] }[] = [
  { href: "/painel", nome: "Painel", papeis: ["dono", "gerente"] },
  { href: "/ordens", nome: "Ordens de serviço", papeis: ["dono", "gerente", "atendente", "tecnico"] },
  { href: "/clientes", nome: "Clientes", papeis: ["dono", "gerente", "atendente"] },
  { href: "/catalogo", nome: "Serviços e peças", papeis: ["dono", "gerente"] },
  { href: "/equipe", nome: "Equipe", papeis: ["dono"] },
  { href: "/config", nome: "Configurações", papeis: ["dono"] },
];

// Menu em linha; no celular rola para o lado
export default function Menu({ papel }: { papel: Papel }) {
  const atual = usePathname() ?? "";
  return (
    <nav className="sem-barra -mx-4 flex gap-1 overflow-x-auto px-4 text-sm sm:mx-0 sm:px-0">
      {LINKS.filter((l) => l.papeis.includes(papel)).map((l) => {
        const ativo = atual.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 ${
              ativo ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            {l.nome}
          </Link>
        );
      })}
    </nav>
  );
}
