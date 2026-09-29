# Ordem de Serviço FH — ordem de serviço e orçamento com aprovação pelo link

Next.js 16 + Supabase + Vercel. Um produto da FH Digital.
Para oficinas (motos, carros), assistência técnica, ar-condicionado e qualquer prestador que faz orçamento.

## Como funciona

1. **Balcão** abre a OS: cliente (novo ou já cadastrado), veículo/equipamento, placa ou série, defeito relatado, previsão e responsável.
2. **Orçamento**: lança serviços e peças (pelo catálogo ou item livre), desconto e diagnóstico.
3. **Enviar ao cliente**: o sistema gera um link. O botão abre o WhatsApp do cliente com a mensagem pronta.
4. **O cliente abre o link no celular**, vê os itens, o total e aprova (ou recusa) digitando o nome. Também dá para marcar "aprovou no balcão".
5. **Técnico** vê as OS no celular, anota o diagnóstico, põe fotos, marca "em andamento", "aguardando peça" e "pronta".
6. **Pronta**: o balcão avisa o cliente pelo WhatsApp, entrega e recebe (Pix, cartão, dinheiro com troco, pode dividir). Pode receber sinal antes e deixar saldo a receber (fiado).
7. **Dono**: painel com recebido no período, taxa de aprovação de orçamentos, a receber, prontas para retirar e atrasadas.

O cliente acompanha tudo pelo mesmo link (andamento, fotos, valores e garantia). A OS também sai impressa (A4, com QR do link e assinatura).

## Telas

| Rota | Quem usa | O que faz |
|---|---|---|
| `/painel` | dono, gerente | Números do período, prontas, atrasadas, a receber |
| `/ordens` | todos | Lista com abas, busca por nº, cliente, placa, modelo ou telefone |
| `/ordens/nova` | dono, gerente, atendente | Abre a OS |
| `/ordens/[id]` | todos | OS completa: dados, orçamento, ações, pagamento, histórico e fotos |
| `/ordens/[id]/imprimir` | todos | Impressão / PDF |
| `/o/[token]` | cliente (sem login) | Acompanhar e aprovar o orçamento |
| `/clientes` | dono, gerente, atendente | Cadastro e histórico por cliente |
| `/catalogo` | dono, gerente | Serviços e peças com preço |
| `/equipe` | dono | Logins (atendente, técnico, gerente) |
| `/config` | dono | Dados da empresa, garantia, validade e rodapé do orçamento |

## Colocar no ar (primeira vez)

1. **Supabase**: projeto novo (`os-fh`). No SQL Editor, rode `supabase/os_schema.sql` (pode rodar de novo sem erro).
2. Em **Authentication > Sign In / Providers**, desligue **"Allow new users to sign up"**.
3. **GitHub**: suba esta pasta num repositório novo (`os-fh`). O `.env.local` **não** vai (está no `.gitignore`).
4. **Vercel**: importe o repositório e cadastre:
   - `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` como **Config** (não Secret)
   - `SUPABASE_SECRET_KEY` como **Secret** (só na Vercel; nunca no chat nem no GitHub)

## Cadastrar um cliente (empresa)

1. Supabase > Authentication > Users > **Add user** (e-mail do dono + senha, marque *Auto Confirm User*).
2. Rode `supabase/nova_empresa.sql` preenchendo e-mail, nome e WhatsApp.
3. O dono entra, confere **Configurações**, cadastra **Serviços e peças** e cria os logins em **Equipe**.

Conta de demonstração: depois do passo 2 com `demo@fhdigitalmarketing.com`, rode `supabase/demo.sql`
(catálogo de oficina de motos). Rodar de novo apaga as OS da demo.

## Segurança

- OS, itens, status, pagamentos e histórico só são gravados pelas funções do banco (conferem papel e empresa).
- O técnico não mexe em valores, aprovação, entrega nem cancelamento.
- O link do cliente usa um código aleatório de 24 caracteres; mostra só o primeiro nome e não aparece no Google.
- Orçamento aprovado fica travado. Para mudar, "Reabrir orçamento" (volta para aprovação e fica no histórico).
- OS com pagamento não pode ser cancelada.
