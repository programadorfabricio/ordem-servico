import { exigirTela, TODOS } from "@/lib/contexto";
import BotaoSair from "@/components/BotaoSair";
import LinkSenha from "@/components/LinkSenha";
import Menu from "@/components/Menu";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const { empresa, papel, nome } = await exigirTela(TODOS);

  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="border-b border-white/10 bg-black/30 print:hidden">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex items-center justify-between gap-3 sm:contents">
            <div className="min-w-0">
              <p className="text-xs text-sky-400">OS FH{nome ? ` · ${nome}` : ""}</p>
              <p className="truncate font-semibold leading-tight">{empresa.nome}</p>
            </div>
            <div className="flex items-center gap-2 sm:order-last sm:ml-auto">
              <LinkSenha />
              <BotaoSair />
            </div>
          </div>
          <Menu papel={papel} />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
