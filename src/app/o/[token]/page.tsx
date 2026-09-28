import type { Metadata } from "next";
import { criarClienteServidor } from "@/lib/supabase/server";
import OSCliente, { type OSPublica } from "./OSCliente";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sua ordem de serviço", robots: { index: false, follow: false } };

export default async function PaginaCliente({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await criarClienteServidor();
  const { data } = /^[0-9a-f]{24}$/.test(token) ? await supabase.rpc("os_publica", { p_token: token }) : { data: null };

  if (!data) {
    return (
      <main className="tema-cliente flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <p className="text-lg font-semibold">Link não encontrado</p>
          <p className="mt-1 text-sm text-gray-500">Confira o link com quem te enviou.</p>
        </div>
      </main>
    );
  }
  return <OSCliente token={token} os={data as OSPublica} />;
}
