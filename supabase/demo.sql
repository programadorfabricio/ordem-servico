-- =============================================================
-- Ordem de Serviço FH - dados de demonstração (catálogo de oficina de motos)
-- Rode depois do nova_empresa.sql. Rodar de novo apaga as ordens da
-- conta de demonstração e recria o catálogo.
-- =============================================================
do $$
declare
  v_email text := 'demo@fhdigitalmarketing.com';
  v_emp uuid;
begin
  select ue.empresa_id into v_emp from usuarios_empresa ue join auth.users u on u.id = ue.user_id
   where lower(u.email) = v_email and ue.papel = 'dono';
  if v_emp is null then raise exception 'Conta % não encontrada.', v_email; end if;

  delete from ordens where empresa_id = v_emp;
  delete from clientes where empresa_id = v_emp;
  delete from catalogo where empresa_id = v_emp;

  update empresas set nome = 'Moto Center Demo', telefone = '(19) 98157-7861', endereco = 'Paulínia - SP',
         garantia_dias = 90, validade_dias = 7,
         termos = 'Orçamento válido pelo prazo indicado. Garantia de 90 dias para mão de obra. Peças substituídas ficam à disposição do cliente por 30 dias.'
   where id = v_emp;

  insert into catalogo (empresa_id, tipo, nome, preco) values
    (v_emp, 'servico', 'Revisão completa', 120),
    (v_emp, 'servico', 'Troca de óleo (mão de obra)', 20),
    (v_emp, 'servico', 'Troca de kit relação (mão de obra)', 40),
    (v_emp, 'servico', 'Troca de pastilha de freio (mão de obra)', 25),
    (v_emp, 'servico', 'Regulagem de carburador', 60),
    (v_emp, 'servico', 'Diagnóstico elétrico', 50),
    (v_emp, 'peca', 'Óleo 10W30 1L', 32),
    (v_emp, 'peca', 'Filtro de óleo', 25),
    (v_emp, 'peca', 'Kit relação', 185),
    (v_emp, 'peca', 'Pastilha de freio dianteira', 45),
    (v_emp, 'peca', 'Vela de ignição', 28),
    (v_emp, 'peca', 'Pneu traseiro 90/90-18', 210);
end $$;
