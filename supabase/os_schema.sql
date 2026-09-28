-- =============================================================
-- OS FH - FH Digital
-- Ordem de serviço e orçamento para oficinas, assistência técnica
-- e prestadores (ar-condicionado, eletrônicos, motos, carros...).
-- Cole tudo no SQL Editor do Supabase (projeto NOVO) e clique em "Run".
-- Pode rodar mais de uma vez sem erro.
-- =============================================================

create extension if not exists pgcrypto with schema extensions;

-- -------------------------------------------------------------
-- TABELAS
-- -------------------------------------------------------------

create table if not exists public.empresas (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null,
  telefone          text not null default '',      -- WhatsApp da empresa (aparece para o cliente)
  endereco          text not null default '',
  documento         text not null default '',      -- CNPJ/CPF (sai na impressão)
  garantia_dias     integer not null default 90 check (garantia_dias between 0 and 3650),
  validade_dias     integer not null default 7 check (validade_dias between 1 and 365),  -- validade do orçamento
  termos            text not null default '',      -- texto no rodapé do orçamento
  ativa             boolean not null default true,
  created_at        timestamptz not null default now()
);

create table if not exists public.usuarios_empresa (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  papel       text not null check (papel in ('dono','gerente','atendente','tecnico')),
  nome        text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists idx_usuarios_empresa on public.usuarios_empresa (empresa_id);

create table if not exists public.clientes (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nome        text not null check (length(trim(nome)) > 0),
  telefone    text not null default '',
  documento   text not null default '',
  email       text not null default '',
  endereco    text not null default '',
  observacao  text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists idx_clientes_empresa on public.clientes (empresa_id, nome);

-- Serviços e peças mais usados (para lançar rápido no orçamento)
create table if not exists public.catalogo (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  tipo        text not null default 'servico' check (tipo in ('servico','peca')),
  nome        text not null check (length(trim(nome)) > 0),
  preco       numeric(10,2) not null default 0 check (preco >= 0),
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists idx_catalogo_empresa on public.catalogo (empresa_id, tipo, nome);

-- A ordem de serviço
--   orcamento  = sendo montado (rascunho)
--   aguardando = orçamento enviado, esperando o cliente
--   aprovada / recusada
--   andamento  = em execução
--   peca       = parado esperando peça
--   pronta     = pronto para retirar
--   entregue / cancelada
create table if not exists public.ordens (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  numero          integer not null,
  token           text not null unique,             -- link do cliente
  cliente_id      uuid not null references public.clientes(id) on delete restrict,
  equipamento     text not null default '',          -- ex.: Honda CG 160 2019 / Split 12.000 BTUs
  identificacao   text not null default '',          -- placa, nº de série, IMEI...
  detalhes        text not null default '',          -- km, cor, acessórios deixados...
  defeito         text not null default '',          -- o que o cliente relatou
  diagnostico     text not null default '',          -- o que o técnico encontrou
  status          text not null default 'orcamento'
                  check (status in ('orcamento','aguardando','aprovada','recusada','andamento','peca','pronta','entregue','cancelada')),
  tecnico_id      uuid references auth.users(id) on delete set null,
  previsao        date,
  desconto        numeric(10,2) not null default 0 check (desconto >= 0),
  garantia_dias   integer not null default 90,
  enviado_em      timestamptz,
  aprovado_em     timestamptz,
  aprovado_por    text,                              -- nome de quem aprovou (cliente)
  aprovado_via    text check (aprovado_via in ('link','balcao')),
  recusado_em     timestamptz,
  recusa_motivo   text,
  pronto_em       timestamptz,
  entregue_em     timestamptz,
  cancelado_em    timestamptz,
  criado_por      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  unique (empresa_id, numero)
);
-- devolvida sem fazer o serviço (orçamento recusado): não entra no faturamento
alter table public.ordens add column if not exists sem_servico boolean not null default false;
create index if not exists idx_ordens_empresa on public.ordens (empresa_id, status, created_at desc);
create index if not exists idx_ordens_cliente on public.ordens (cliente_id);

create table if not exists public.os_itens (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  ordem_id    uuid not null references public.ordens(id) on delete cascade,
  tipo        text not null default 'servico' check (tipo in ('servico','peca')),
  descricao   text not null check (length(trim(descricao)) > 0),
  quantidade  numeric(10,3) not null check (quantidade > 0),
  preco_unit  numeric(10,2) not null check (preco_unit >= 0),
  total       numeric(10,2) generated always as (round(quantidade * preco_unit, 2)) stored,
  ordem       integer not null default 0
);
create index if not exists idx_os_itens on public.os_itens (ordem_id);

-- Histórico: mudança de status, anotações e fotos
create table if not exists public.os_eventos (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  ordem_id    uuid not null references public.ordens(id) on delete cascade,
  tipo        text not null check (tipo in ('status','nota','foto')),
  status      text,
  texto       text not null default '',
  foto        text,                                   -- caminho no Storage (bucket os-fotos)
  publico     boolean not null default true,          -- aparece no link do cliente
  autor       text not null default '',               -- nome de quem fez (ou "Cliente")
  user_id     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_os_eventos on public.os_eventos (ordem_id, created_at);

create table if not exists public.os_pagamentos (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  ordem_id    uuid not null references public.ordens(id) on delete cascade,
  forma       text not null check (forma in ('pix','credito','debito','dinheiro','boleto','outro')),
  valor       numeric(10,2) not null check (valor > 0),
  user_id     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_os_pagamentos on public.os_pagamentos (empresa_id, created_at);
create index if not exists idx_os_pagamentos_ordem on public.os_pagamentos (ordem_id);

-- -------------------------------------------------------------
-- QUEM É QUEM
-- -------------------------------------------------------------
create or replace function public.minha_empresa()
returns uuid language sql stable security definer set search_path = public as $$
  select empresa_id from usuarios_empresa where user_id = auth.uid() limit 1
$$;

create or replace function public.meu_papel()
returns text language sql stable security definer set search_path = public as $$
  select papel from usuarios_empresa where user_id = auth.uid() limit 1
$$;

create or replace function public._exigir(p_papeis text[])
returns usuarios_empresa language plpgsql stable security definer set search_path = public as $$
declare v usuarios_empresa;
begin
  select * into v from usuarios_empresa where user_id = auth.uid() limit 1;
  if v.id is null then raise exception 'Faça login novamente.'; end if;
  if not (v.papel = any(p_papeis)) then raise exception 'Este acesso não pode fazer isso.'; end if;
  if not exists (select 1 from empresas where id = v.empresa_id and ativa) then
    raise exception 'Empresa desativada. Fale com a FH Digital.';
  end if;
  return v;
end $$;

-- -------------------------------------------------------------
-- SEGURANÇA (RLS)
-- A equipe lê os dados da própria empresa. OS, itens, histórico
-- e pagamentos só são gravados pelas funções abaixo.
-- -------------------------------------------------------------
alter table public.empresas          enable row level security;
alter table public.usuarios_empresa  enable row level security;
alter table public.clientes          enable row level security;
alter table public.catalogo          enable row level security;
alter table public.ordens            enable row level security;
alter table public.os_itens          enable row level security;
alter table public.os_eventos        enable row level security;
alter table public.os_pagamentos     enable row level security;

drop policy if exists ler on public.empresas;
create policy ler on public.empresas for select to authenticated using (id = minha_empresa());

drop policy if exists ler on public.usuarios_empresa;
create policy ler on public.usuarios_empresa for select to authenticated
  using (user_id = auth.uid() or empresa_id = minha_empresa());

do $$
declare t text;
begin
  foreach t in array array['clientes','catalogo','ordens','os_itens','os_eventos','os_pagamentos'] loop
    execute format('drop policy if exists ler on public.%I', t);
    execute format('create policy ler on public.%I for select to authenticated using (empresa_id = minha_empresa())', t);
  end loop;

  -- Clientes: a equipe do balcão cadastra e edita. Catálogo: só gestão.
  execute 'drop policy if exists editar on public.clientes';
  execute $p$create policy editar on public.clientes for all to authenticated
    using (empresa_id = minha_empresa() and meu_papel() in ('dono','gerente','atendente'))
    with check (empresa_id = minha_empresa() and meu_papel() in ('dono','gerente','atendente'))$p$;
  execute 'drop policy if exists editar on public.catalogo';
  execute $p$create policy editar on public.catalogo for all to authenticated
    using (empresa_id = minha_empresa() and meu_papel() in ('dono','gerente'))
    with check (empresa_id = minha_empresa() and meu_papel() in ('dono','gerente'))$p$;
end $$;

-- -------------------------------------------------------------
-- AUXILIARES
-- -------------------------------------------------------------
create or replace function public._subtotal(p_os uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(total), 0) from os_itens where ordem_id = p_os
$$;

create or replace function public._pago(p_os uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(valor), 0) from os_pagamentos where ordem_id = p_os
$$;

create or replace function public._nome_status(p text)
returns text language sql immutable as $$
  select case p
    when 'orcamento'  then 'Orçamento em preparo'
    when 'aguardando' then 'Aguardando sua aprovação'
    when 'aprovada'   then 'Orçamento aprovado'
    when 'recusada'   then 'Orçamento recusado'
    when 'andamento'  then 'Em andamento'
    when 'peca'       then 'Aguardando peça'
    when 'pronta'     then 'Pronto para retirar'
    when 'entregue'   then 'Entregue'
    when 'cancelada'  then 'Cancelada'
    else p end
$$;

-- Carrega a OS da empresa (trava a linha) ou dá erro
create or replace function public._minha_os(p_os uuid, p_empresa uuid)
returns ordens language plpgsql security definer set search_path = public as $$
declare o ordens;
begin
  select * into o from ordens where id = p_os and empresa_id = p_empresa for update;
  if o.id is null then raise exception 'Ordem de serviço não encontrada.'; end if;
  return o;
end $$;

create or replace function public._evento(p_os ordens, p_tipo text, p_status text, p_texto text, p_publico boolean, p_foto text, p_autor text)
returns void language sql security definer set search_path = public as $$
  insert into os_eventos (empresa_id, ordem_id, tipo, status, texto, publico, foto, autor, user_id)
  values (p_os.empresa_id, p_os.id, p_tipo, p_status, coalesce(p_texto, ''), p_publico, p_foto, coalesce(p_autor, ''), auth.uid())
$$;

-- -------------------------------------------------------------
-- ORDENS DE SERVIÇO
-- -------------------------------------------------------------

-- Abre uma OS. p_cliente: {"id": "..."} ou {"nome": "...", "telefone": "...", "documento": "..."}
create or replace function public.nova_os(
  p_cliente jsonb, p_equipamento text, p_identificacao text, p_detalhes text,
  p_defeito text, p_previsao date default null, p_tecnico uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  u usuarios_empresa := _exigir(array['dono','gerente','atendente']);
  v_cli uuid;
  v_num integer;
  v_os ordens;
  e empresas;
begin
  select * into e from empresas where id = u.empresa_id;
  if nullif(p_cliente->>'id', '') is not null then
    select id into v_cli from clientes where id = (p_cliente->>'id')::uuid and empresa_id = u.empresa_id;
    if v_cli is null then raise exception 'Cliente não encontrado.'; end if;
  else
    if length(trim(coalesce(p_cliente->>'nome', ''))) < 2 then raise exception 'Informe o nome do cliente.'; end if;
    insert into clientes (empresa_id, nome, telefone, documento)
    values (u.empresa_id, trim(p_cliente->>'nome'), trim(coalesce(p_cliente->>'telefone', '')), trim(coalesce(p_cliente->>'documento', '')))
    returning id into v_cli;
  end if;
  if length(trim(coalesce(p_equipamento, ''))) = 0 then raise exception 'Informe o veículo ou equipamento.'; end if;
  if p_tecnico is not null and not exists (select 1 from usuarios_empresa where user_id = p_tecnico and empresa_id = u.empresa_id) then
    raise exception 'Técnico não encontrado.';
  end if;

  perform pg_advisory_xact_lock(hashtext('os-numero-' || u.empresa_id::text));
  select coalesce(max(numero), 0) + 1 into v_num from ordens where empresa_id = u.empresa_id;

  insert into ordens (empresa_id, numero, token, cliente_id, equipamento, identificacao, detalhes, defeito,
                      previsao, tecnico_id, garantia_dias, criado_por)
  values (u.empresa_id, v_num, encode(extensions.gen_random_bytes(12), 'hex'), v_cli, trim(p_equipamento),
          trim(coalesce(p_identificacao, '')), trim(coalesce(p_detalhes, '')), trim(coalesce(p_defeito, '')),
          p_previsao, p_tecnico, e.garantia_dias, auth.uid())
  returning * into v_os;

  perform _evento(v_os, 'status', 'orcamento', 'Ordem de serviço aberta', true, null, u.nome);
  return v_os.id;
end $$;

-- Edita os dados da OS (equipamento, defeito, diagnóstico, previsão, técnico, desconto)
create or replace function public.salvar_os(
  p_os uuid, p_equipamento text, p_identificacao text, p_detalhes text, p_defeito text,
  p_diagnostico text, p_previsao date, p_tecnico uuid, p_desconto numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
  u usuarios_empresa := _exigir(array['dono','gerente','atendente','tecnico']);
  o ordens := _minha_os(p_os, u.empresa_id);
  v_desc numeric := round(coalesce(p_desconto, 0), 2);
begin
  if o.status in ('entregue','cancelada') then raise exception 'Esta OS já foi encerrada.'; end if;
  if u.papel = 'tecnico' then
    -- técnico só mexe no diagnóstico
    update ordens set diagnostico = trim(coalesce(p_diagnostico, '')), atualizado_em = now() where id = o.id;
    return;
  end if;
  if length(trim(coalesce(p_equipamento, ''))) = 0 then raise exception 'Informe o veículo ou equipamento.'; end if;
  if p_tecnico is not null and not exists (select 1 from usuarios_empresa where user_id = p_tecnico and empresa_id = u.empresa_id) then
    raise exception 'Técnico não encontrado.';
  end if;
  if v_desc < 0 then raise exception 'Desconto inválido.'; end if;
  if v_desc <> o.desconto and o.status not in ('orcamento','aguardando','recusada') then
    raise exception 'O desconto só muda com o orçamento aberto. Use "Reabrir orçamento".';
  end if;
  if v_desc > _subtotal(o.id) then raise exception 'O desconto é maior que o valor dos itens.'; end if;

  update ordens set
    equipamento = trim(p_equipamento), identificacao = trim(coalesce(p_identificacao, '')),
    detalhes = trim(coalesce(p_detalhes, '')), defeito = trim(coalesce(p_defeito, '')),
    diagnostico = trim(coalesce(p_diagnostico, '')), previsao = p_previsao, tecnico_id = p_tecnico,
    desconto = v_desc, atualizado_em = now()
  where id = o.id;
end $$;

-- Substitui os itens do orçamento: [{"tipo":"servico","descricao":"...","quantidade":1,"preco":80}]
create or replace function public.salvar_itens(p_os uuid, p_itens jsonb)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  u usuarios_empresa := _exigir(array['dono','gerente','atendente','tecnico']);
  o ordens := _minha_os(p_os, u.empresa_id);
  it jsonb;
  i integer := 0;
  v_qtd numeric;
  v_preco numeric;
begin
  if o.status not in ('orcamento','aguardando','recusada') then
    raise exception 'O orçamento já foi aprovado. Use "Reabrir orçamento" para mudar os itens.';
  end if;
  if jsonb_typeof(coalesce(p_itens, '[]'::jsonb)) <> 'array' then raise exception 'Itens inválidos.'; end if;
  if jsonb_array_length(coalesce(p_itens, '[]'::jsonb)) > 100 then raise exception 'Muitos itens (máximo 100).'; end if;

  delete from os_itens where ordem_id = o.id;
  for it in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) loop
    i := i + 1;
    v_qtd := round(coalesce((it->>'quantidade')::numeric, 0), 3);
    v_preco := round(coalesce((it->>'preco')::numeric, -1), 2);
    if length(trim(coalesce(it->>'descricao', ''))) = 0 then raise exception 'O item % está sem descrição.', i; end if;
    if v_qtd <= 0 or v_qtd > 9999 then raise exception 'Quantidade inválida no item %.', i; end if;
    if v_preco < 0 or v_preco > 999999 then raise exception 'Preço inválido no item %.', i; end if;
    insert into os_itens (empresa_id, ordem_id, tipo, descricao, quantidade, preco_unit, ordem)
    values (o.empresa_id, o.id, case when it->>'tipo' = 'peca' then 'peca' else 'servico' end,
            left(trim(it->>'descricao'), 200), v_qtd, v_preco, i);
  end loop;

  if _pago(o.id) > _subtotal(o.id) - least(o.desconto, _subtotal(o.id)) then
    raise exception 'O cliente já pagou % e o orçamento ficaria menor que isso.', replace(to_char(_pago(o.id), 'FM999999990.00'), '.', ',');
  end if;
  if o.desconto > _subtotal(o.id) then
    update ordens set desconto = 0 where id = o.id;
  end if;
  -- orçamento enviado e alterado: continua aguardando, com a versão nova
  update ordens set atualizado_em = now() where id = o.id;
  return _subtotal(o.id) - least(o.desconto, _subtotal(o.id));
end $$;

-- Muda o status (equipe). Transições permitidas:
--   orcamento  -> aguardando (enviar ao cliente) | aprovada (cliente aprovou no balcão) | cancelada
--   aguardando -> aprovada | recusada | orcamento | cancelada
--   recusada   -> orcamento | cancelada (devolver sem fazer: entregar_os)
--   aprovada   -> andamento | peca | pronta | orcamento | cancelada
--   andamento  -> peca | pronta | orcamento | cancelada
--   peca       -> andamento | pronta | orcamento | cancelada
--   pronta     -> andamento (voltou) | entregue (use entregar_os)
create or replace function public.mudar_status(p_os uuid, p_status text, p_texto text default '', p_aprovado_por text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  u usuarios_empresa := _exigir(array['dono','gerente','atendente','tecnico']);
  o ordens := _minha_os(p_os, u.empresa_id);
  ok boolean;
  v_txt text := trim(coalesce(p_texto, ''));
begin
  ok := case o.status
    when 'orcamento'  then p_status in ('aguardando','aprovada','cancelada')
    when 'aguardando' then p_status in ('aprovada','recusada','orcamento','cancelada')
    when 'recusada'   then p_status in ('orcamento','cancelada')
    when 'aprovada'   then p_status in ('andamento','peca','pronta','orcamento','cancelada')
    when 'andamento'  then p_status in ('peca','pronta','orcamento','cancelada')
    when 'peca'       then p_status in ('andamento','pronta','orcamento','cancelada')
    when 'pronta'     then p_status in ('andamento')
    else false end;
  if not ok then
    raise exception 'Não dá para ir de "%" para "%".', _nome_status(o.status), _nome_status(p_status);
  end if;

  -- técnico cuida da execução; orçamento, aprovação e cancelamento ficam com o balcão
  if u.papel = 'tecnico' and p_status not in ('andamento','peca','pronta') then
    raise exception 'Este acesso não pode fazer isso.';
  end if;
  if p_status in ('aguardando','aprovada') and not exists (select 1 from os_itens where ordem_id = o.id) then
    raise exception 'Coloque pelo menos um item no orçamento.';
  end if;
  if p_status = 'cancelada' and exists (select 1 from os_pagamentos where ordem_id = o.id) then
    raise exception 'Esta OS tem pagamento registrado. Estorne com o cliente antes de cancelar.';
  end if;

  update ordens set
    status        = p_status,
    enviado_em    = case when p_status = 'aguardando' then now() else enviado_em end,
    aprovado_em   = case when p_status = 'aprovada' then now() when p_status = 'orcamento' then null else aprovado_em end,
    aprovado_por  = case when p_status = 'aprovada' then coalesce(nullif(trim(p_aprovado_por), ''), 'Cliente (no balcão)')
                         when p_status = 'orcamento' then null else aprovado_por end,
    aprovado_via  = case when p_status = 'aprovada' then 'balcao' when p_status = 'orcamento' then null else aprovado_via end,
    recusado_em   = case when p_status = 'recusada' then now() when p_status = 'orcamento' then null else recusado_em end,
    recusa_motivo = case when p_status = 'recusada' then nullif(v_txt, '') when p_status = 'orcamento' then null else recusa_motivo end,
    pronto_em     = case when p_status = 'pronta' then now() when p_status = 'andamento' then null else pronto_em end,
    cancelado_em  = case when p_status = 'cancelada' then now() else cancelado_em end,
    atualizado_em = now()
  where id = o.id;

  perform _evento(o, 'status', p_status,
    case p_status
      when 'aguardando' then 'Orçamento enviado para aprovação'
      when 'aprovada'   then 'Orçamento aprovado por ' || coalesce(nullif(trim(p_aprovado_por), ''), 'cliente no balcão')
      when 'orcamento'  then 'Orçamento reaberto para ajuste'
      else _nome_status(p_status) end
      || case when v_txt <> '' and p_status <> 'aprovada' then ' — ' || v_txt else '' end,
    p_status <> 'orcamento', null, u.nome);
end $$;

-- Anotação ou foto no histórico (publico = aparece no link do cliente)
create or replace function public.adicionar_nota(p_os uuid, p_texto text, p_publico boolean, p_foto text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  u usuarios_empresa := _exigir(array['dono','gerente','atendente','tecnico']);
  o ordens := _minha_os(p_os, u.empresa_id);
begin
  if length(trim(coalesce(p_texto, ''))) = 0 and p_foto is null then raise exception 'Escreva a anotação ou escolha uma foto.'; end if;
  if p_foto is not null and p_foto not like o.empresa_id::text || '/%' then raise exception 'Foto inválida.'; end if;
  perform _evento(o, case when p_foto is null then 'nota' else 'foto' end, null, left(trim(coalesce(p_texto, '')), 1000),
                  coalesce(p_publico, false), p_foto, u.nome);
  update ordens set atualizado_em = now() where id = o.id;
end $$;

-- Recebe um valor (sinal/adiantamento ou saldo depois da entrega)
create or replace function public.registrar_pagamento(p_os uuid, p_forma text, p_valor numeric)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  u usuarios_empresa := _exigir(array['dono','gerente','atendente']);
  o ordens := _minha_os(p_os, u.empresa_id);
  v_total numeric;
  v_valor numeric := round(coalesce(p_valor, 0), 2);
begin
  if o.status in ('cancelada') then raise exception 'Esta OS foi cancelada.'; end if;
  if o.status in ('orcamento','aguardando','recusada') then raise exception 'Aprove o orçamento antes de receber.'; end if;
  if v_valor <= 0 then raise exception 'Informe o valor.'; end if;
  if p_forma not in ('pix','credito','debito','dinheiro','boleto','outro') then raise exception 'Forma de pagamento inválida.'; end if;
  v_total := _subtotal(o.id) - o.desconto;
  if _pago(o.id) + v_valor > v_total then
    raise exception 'O valor passa do total da OS. Falta receber %.', replace(to_char(v_total - _pago(o.id), 'FM999999990.00'), '.', ',');
  end if;
  insert into os_pagamentos (empresa_id, ordem_id, forma, valor, user_id) values (o.empresa_id, o.id, p_forma, v_valor, auth.uid());
  perform _evento(o, 'nota', null, 'Pagamento recebido: R$ ' || replace(to_char(v_valor, 'FM999999990.00'), '.', ','), false, null, u.nome);
  return v_total - _pago(o.id);
end $$;

-- Entrega ao cliente, recebendo o que faltar: [{"forma":"pix","valor":150}]
-- Se ficar saldo, a OS vai para "a receber" (fiado).
create or replace function public.entregar_os(p_os uuid, p_pagamentos jsonb default '[]'::jsonb, p_texto text default '')
returns numeric language plpgsql security definer set search_path = public as $$
declare
  u usuarios_empresa := _exigir(array['dono','gerente','atendente']);
  o ordens := _minha_os(p_os, u.empresa_id);
  pg jsonb;
  v_total numeric;
  v_soma numeric := 0;
  v_valor numeric;
begin
  if o.status not in ('pronta','recusada') then raise exception 'Marque a OS como pronta antes de entregar.'; end if;
  v_total := case when o.status = 'recusada' then 0 else _subtotal(o.id) - o.desconto end;

  for pg in select * from jsonb_array_elements(coalesce(p_pagamentos, '[]'::jsonb)) loop
    v_valor := round(coalesce((pg->>'valor')::numeric, 0), 2);
    if v_valor <= 0 then continue; end if;
    if pg->>'forma' not in ('pix','credito','debito','dinheiro','boleto','outro') then raise exception 'Forma de pagamento inválida.'; end if;
    v_soma := v_soma + v_valor;
    insert into os_pagamentos (empresa_id, ordem_id, forma, valor, user_id) values (o.empresa_id, o.id, pg->>'forma', v_valor, auth.uid());
  end loop;
  if _pago(o.id) > v_total then raise exception 'O pagamento passa do total da OS.'; end if;

  update ordens set status = 'entregue', entregue_em = now(), sem_servico = (o.status = 'recusada'), atualizado_em = now() where id = o.id;
  perform _evento(o, 'status', 'entregue',
    case when o.status = 'recusada' then 'Devolvido ao cliente sem o serviço' else 'Entregue ao cliente' end
    || case when trim(coalesce(p_texto, '')) <> '' then ' — ' || trim(p_texto) else '' end, true, null, u.nome);
  return v_total - _pago(o.id);
end $$;

-- -------------------------------------------------------------
-- LINK DO CLIENTE (sem login)
-- -------------------------------------------------------------
create or replace function public.os_publica(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  o ordens;
  e empresas;
  c clientes;
begin
  if p_token !~ '^[0-9a-f]{24}$' then return null; end if;
  select * into o from ordens where token = p_token;
  if o.id is null then return null; end if;
  select * into e from empresas where id = o.empresa_id;
  if not e.ativa then return null; end if;
  select * into c from clientes where id = o.cliente_id;

  return jsonb_build_object(
    'numero', o.numero, 'status', o.status, 'status_nome', _nome_status(o.status),
    'equipamento', o.equipamento, 'identificacao', o.identificacao, 'defeito', o.defeito, 'diagnostico', o.diagnostico,
    'previsao', o.previsao, 'garantia_dias', o.garantia_dias, 'criado_em', o.created_at, 'enviado_em', o.enviado_em,
    'aprovado_em', o.aprovado_em, 'aprovado_por', o.aprovado_por, 'pronto_em', o.pronto_em, 'entregue_em', o.entregue_em,
    'validade', case when o.enviado_em is not null then (o.enviado_em at time zone 'America/Sao_Paulo')::date + e.validade_dias end,
    'cliente', split_part(c.nome, ' ', 1),
    'empresa', jsonb_build_object('nome', e.nome, 'telefone', e.telefone, 'endereco', e.endereco, 'termos', e.termos),
    'mostrar_valores', o.status <> 'orcamento', 'sem_servico', o.sem_servico,
    'itens', case when o.status = 'orcamento' then '[]'::jsonb else coalesce((
        select jsonb_agg(jsonb_build_object('tipo', tipo, 'descricao', descricao, 'quantidade', quantidade, 'preco', preco_unit, 'total', total) order by ordem)
          from os_itens where ordem_id = o.id), '[]'::jsonb) end,
    'subtotal', _subtotal(o.id), 'desconto', o.desconto, 'total', _subtotal(o.id) - o.desconto, 'pago', _pago(o.id),
    'eventos', coalesce((
        select jsonb_agg(jsonb_build_object('tipo', tipo, 'status', status, 'texto', texto, 'foto', foto, 'quando', created_at) order by created_at)
          from os_eventos where ordem_id = o.id and publico), '[]'::jsonb)
  );
end $$;

-- O cliente aprova ou recusa pelo link
create or replace function public.responder_orcamento(p_token text, p_aprovar boolean, p_nome text, p_motivo text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o ordens;
  e empresas;
  v_nome text := left(trim(coalesce(p_nome, '')), 80);
begin
  if p_token !~ '^[0-9a-f]{24}$' then raise exception 'Link inválido.'; end if;
  select * into o from ordens where token = p_token for update;
  if o.id is null then raise exception 'Link inválido.'; end if;
  select * into e from empresas where id = o.empresa_id;
  if not e.ativa then raise exception 'Link inválido.'; end if;
  if o.status <> 'aguardando' then raise exception 'Este orçamento não está mais esperando resposta. Fale com a %.', e.nome; end if;
  if length(v_nome) < 2 then raise exception 'Escreva seu nome para confirmar.'; end if;

  if p_aprovar then
    update ordens set status = 'aprovada', aprovado_em = now(), aprovado_por = v_nome, aprovado_via = 'link', atualizado_em = now()
     where id = o.id;
    insert into os_eventos (empresa_id, ordem_id, tipo, status, texto, publico, autor)
    values (o.empresa_id, o.id, 'status', 'aprovada', 'Orçamento aprovado pelo link por ' || v_nome, true, 'Cliente');
  else
    update ordens set status = 'recusada', recusado_em = now(), recusa_motivo = nullif(left(trim(coalesce(p_motivo, '')), 300), ''),
           atualizado_em = now()
     where id = o.id;
    insert into os_eventos (empresa_id, ordem_id, tipo, status, texto, publico, autor)
    values (o.empresa_id, o.id, 'status', 'recusada',
            'Orçamento recusado pelo link por ' || v_nome
            || case when trim(coalesce(p_motivo, '')) <> '' then ' — ' || left(trim(p_motivo), 300) else '' end, true, 'Cliente');
  end if;
  return os_publica(p_token);
end $$;

-- -------------------------------------------------------------
-- PAINEL E CONFIGURAÇÕES
-- -------------------------------------------------------------
create or replace function public.painel_os(p_inicio date, p_fim date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  u usuarios_empresa := _exigir(array['dono','gerente']);
  v_ini timestamptz := (p_inicio::text || ' 00:00:00-03')::timestamptz;
  v_fim timestamptz := ((p_fim + 1)::text || ' 00:00:00-03')::timestamptz;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if p_fim < p_inicio or p_fim - p_inicio > 400 then raise exception 'Período inválido.'; end if;
  return jsonb_build_object(
    'por_status', coalesce((select jsonb_object_agg(status, n) from (
        select status, count(*) n from ordens where empresa_id = u.empresa_id and status not in ('entregue','cancelada') group by status) s), '{}'::jsonb),
    'atrasadas', (select count(*) from ordens where empresa_id = u.empresa_id and previsao < hoje
                    and status in ('aprovada','andamento','peca')),
    'a_receber', coalesce((select sum(t.total - t.pago) from (
        select _subtotal(o.id) - o.desconto total, _pago(o.id) pago from ordens o
         where o.empresa_id = u.empresa_id and o.status = 'entregue' and not o.sem_servico) t where t.total > t.pago), 0),
    'recebido', coalesce((select sum(valor) from os_pagamentos where empresa_id = u.empresa_id and created_at >= v_ini and created_at < v_fim), 0),
    'por_forma', coalesce((select jsonb_object_agg(forma, v) from (
        select forma, sum(valor) v from os_pagamentos where empresa_id = u.empresa_id and created_at >= v_ini and created_at < v_fim group by forma) f), '{}'::jsonb),
    'entregues', (select count(*) from ordens where empresa_id = u.empresa_id and status = 'entregue' and not sem_servico and entregue_em >= v_ini and entregue_em < v_fim),
    'faturado', coalesce((select sum(_subtotal(id) - desconto) from ordens where empresa_id = u.empresa_id and status = 'entregue' and not sem_servico
                          and entregue_em >= v_ini and entregue_em < v_fim), 0),
    'abertas_periodo', (select count(*) from ordens where empresa_id = u.empresa_id and created_at >= v_ini and created_at < v_fim),
    'enviados', (select count(*) from ordens where empresa_id = u.empresa_id and enviado_em >= v_ini and enviado_em < v_fim),
    'aprovados', (select count(*) from ordens where empresa_id = u.empresa_id and enviado_em >= v_ini and enviado_em < v_fim and aprovado_em is not null),
    'recusados', (select count(*) from ordens where empresa_id = u.empresa_id and enviado_em >= v_ini and enviado_em < v_fim and recusado_em is not null and aprovado_em is null)
  );
end $$;

create or replace function public.salvar_config(
  p_nome text, p_telefone text, p_endereco text, p_documento text,
  p_garantia integer, p_validade integer, p_termos text)
returns void language plpgsql security definer set search_path = public as $$
declare u usuarios_empresa := _exigir(array['dono']);
begin
  if length(trim(coalesce(p_nome, ''))) < 2 then raise exception 'Informe o nome da empresa.'; end if;
  if p_garantia is null or p_garantia < 0 or p_garantia > 3650 then raise exception 'Garantia inválida (0 a 3650 dias).'; end if;
  if p_validade is null or p_validade < 1 or p_validade > 365 then raise exception 'Validade inválida (1 a 365 dias).'; end if;
  update empresas set nome = left(trim(p_nome), 80), telefone = left(trim(coalesce(p_telefone, '')), 30),
         endereco = left(trim(coalesce(p_endereco, '')), 200), documento = left(trim(coalesce(p_documento, '')), 30),
         garantia_dias = p_garantia, validade_dias = p_validade, termos = left(trim(coalesce(p_termos, '')), 2000)
   where id = u.empresa_id;
end $$;

-- -------------------------------------------------------------
-- PERMISSÕES DAS FUNÇÕES
-- -------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('minha_empresa','meu_papel','_exigir','_subtotal','_pago','_nome_status','_minha_os','_evento',
                         'nova_os','salvar_os','salvar_itens','mudar_status','adicionar_nota','registrar_pagamento','entregar_os',
                         'os_publica','responder_orcamento','painel_os','salvar_config')
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    if f.proname in ('minha_empresa','meu_papel') then
      execute format('grant execute on function %s to authenticated', f.sig);
    elsif f.proname like '\_%' escape '\' then
      execute format('revoke all on function %s from authenticated', f.sig);
    else
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
    if f.proname in ('os_publica','responder_orcamento') then
      execute format('grant execute on function %s to anon', f.sig);
    end if;
  end loop;
end $$;

-- -------------------------------------------------------------
-- TEMPO REAL (a lista e a OS aberta atualizam sozinhas)
-- -------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['ordens','os_eventos','os_pagamentos'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- -------------------------------------------------------------
-- FOTOS (Storage). Pasta = id da empresa.
-- O bucket é público para o cliente ver as fotos no link; o nome
-- do arquivo é aleatório. Só a equipe da empresa envia e apaga.
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('os-fotos', 'os-fotos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "os enviar" on storage.objects;
create policy "os enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'os-fotos' and (storage.foldername(name))[1] = public.minha_empresa()::text);
drop policy if exists "os apagar" on storage.objects;
create policy "os apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'os-fotos' and (storage.foldername(name))[1] = public.minha_empresa()::text
         and public.meu_papel() in ('dono','gerente'));
drop policy if exists "os ver" on storage.objects;
create policy "os ver" on storage.objects for select to authenticated
  using (bucket_id = 'os-fotos' and (storage.foldername(name))[1] = public.minha_empresa()::text);
