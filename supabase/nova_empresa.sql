-- =============================================================
-- OS FH - cadastrar um cliente novo
-- 1) Authentication > Users > Add user > Create new user
--    (e-mail do dono + senha, marque "Auto Confirm User")
-- 2) Preencha as linhas abaixo e clique em "Run"
-- =============================================================
do $$
declare
  v_email_dono  text := 'dono@exemplo.com';      -- e-mail criado no passo 1
  v_nome        text := 'Oficina Exemplo';       -- nome da empresa
  v_telefone    text := '(19) 99999-9999';       -- WhatsApp da empresa
  -- ---------------------------------------------------------
  v_user uuid;
  v_emp  uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(trim(v_email_dono));
  if v_user is null then raise exception 'Crie primeiro o usuário % em Authentication > Users.', v_email_dono; end if;
  if exists (select 1 from usuarios_empresa where user_id = v_user) then
    raise exception 'Esse e-mail já está ligado a uma empresa.';
  end if;
  insert into empresas (nome, telefone, termos)
  values (v_nome, v_telefone, 'Orçamento válido pelo prazo indicado. Peças substituídas ficam à disposição do cliente por 30 dias.')
  returning id into v_emp;
  insert into usuarios_empresa (user_id, empresa_id, papel, nome) values (v_user, v_emp, 'dono', 'Dono');
  raise notice 'Pronto: % criada.', v_nome;
end $$;
