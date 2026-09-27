# CORTEX.OS — Relatório da consolidação para o beta

Branch `claude/fade-os-pre-pilot-update-7znkqj` · commit inicial `4b8b8b5` ·
`main` intocada (`8f443aa`) · sem merge.

## 1. Commits (12)

| Commit | Bloco |
|---|---|
| `f608615` | B1 Início: Pulso adaptativo, indicadores com tendência de 12 semanas, nada esticado |
| `d717284` | B2 CNPJ ou CPF com dígito verificador e CNPJ alfanumérico |
| `bb38c7f` | B3 Onboarding: etapa “Seu plano”, produto pago em beta |
| `77749cd` | B4 Sentry: navegador, servidor e edge, sem dados pessoais |
| `4fa487b` | B5 Pesquisas e visão do beta no banco |
| `7b3acea` | B6 Pesquisas: cartão discreto e Admin |
| `5097a7a` | B7 Admin: Central por janela, alertas, beta, matriz, erros |
| `2b1332b` | B8 Landing e `/beta`: pago, beta sem cobrança, planos em jan/2027 |
| `1f10add` | B9 Performance: SDK do Supabase sob demanda, consultas em paralelo |
| `d6d43a3` | Correções achadas na validação final |
| (este) | Documentação e relatório |

72+ arquivos, ~6,9 mil linhas.

## 2. Migrations (aplicadas no banco `xaxszgyvapvzwensbjjq`)

| Arquivo | O que cria |
|---|---|
| `20260929100000_pesquisas_e_beta.sql` | `pesquisa`, `pesquisa_participacao` (RLS sem política, sem acesso direto), funções de público/resposta/admin, `admin_beta_empresas` |
| `20260929110000_admin_pulso_e_matriz.sql` | `admin_pulso_da_plataforma(janela)`, `admin_matriz_de_uso(dias)` |

Aditivas: nenhuma tabela ou função existente mudou. Produção (`main`) segue
funcionando sobre o mesmo banco (verificado, §8).

## 3. Integrações

**Sentry** é a única integração externa nova. Firebase, Google Maps, Stripe,
cobrança: nenhuma. Dependência instalada: `@sentry/nextjs@^11` (justificativa:
SDK oficial exigido pela missão).

## 4. Sentry — configuração

- Organização `cortexos`, projeto `cortex-os` (criado nesta rodada).
- `instrumentation.ts` (`onRequestError`), `sentry.server.config.ts`,
  `sentry.edge.config.ts`, `instrumentation-client.ts`, `app/global-error.tsx`,
  error boundaries, `friendlyMessage` → `reportarErro` para erro inesperado
  (regra de negócio e permissão não entram).
- Ambientes `production` / `preview` / `development` (de `VERCEL_ENV`);
  development só envia com `NEXT_PUBLIC_SENTRY_DEV=1`.
- Release = commit do deploy (`VERCEL_GIT_COMMIT_SHA`); source maps sobem com
  `SENTRY_AUTH_TOKEN` e são apagados do bundle público.
- Contexto: id do usuário, id da empresa, papel, área — nunca nome, e-mail,
  telefone.
- Proteção em duas camadas: coleta fechada no SDK (`dataCollection`) +
  limpeza testada em `beforeSend`/`beforeSendSpan`/`beforeBreadcrumb`
  (e-mail, telefone, CPF, CNPJ, JWT, bearer, cookies, corpo, query, UUID em
  URL). Sem Session Replay, sem widget de feedback.
- Túnel `/monitoramento` (fora do middleware).
- SDK do navegador carregado depois que a tela fica pronta: JS compartilhado
  105 kB (carregando direto seria 170 kB); erros anteriores vão numa fila.
- **Validado com eventos reais** (development): mensagens chegaram limpas
  (`[email]`, `[documento]`, `[telefone]`), headers só os permitidos, sem
  cookies/corpo, com usuário/empresa/papel; spans sem query. Os 4 issues de
  teste foram resolvidos no painel com comentário.

Variáveis (detalhe em `docs/observabilidade.md`):

| Variável | Onde | Estado |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Vercel Production + Preview | **falta configurar** |
| `SENTRY_AUTH_TOKEN` | Vercel (sensitive) | **falta** — sem ele não há source maps |
| `SENTRY_API_TOKEN` | Vercel Production (sensitive) | **falta** — sem ele Admin > Saúde mostra “Não conectado” |

A sessão não tem permissão para criar variáveis no projeto Vercel (403).
Sem elas, nada quebra: preview e produção apenas não enviam.

## 5. O que mudou para quem usa

**Início (dono/gerente)** — Pulso adaptativo (faixa fina quando não há
sinal; lista compacta com poucos; grade com muitos; sem altura fixa), níveis
Crítico/Importante/Atenção/Informativo com contexto e ação; indicadores com
variação contra o período anterior de mesmo tamanho e linha de 12 semanas;
gráfico diário só com 2+ dias com movimento (senão, explica); estoque separa
produtos e materiais a custo; movimento reduzido respeitado.

**Onboarding** — “CNPJ ou CPF” validado; etapa “Seu plano” (R$ 200 riscado,
BETA, sem cobrança, planos a partir de janeiro de 2027); um documento
recusado não apaga mais o que foi digitado.

**Pesquisas** — cartão discreto para responsável/gerência, profissionais e
clientes; nunca repete; espera fora de atendimento/venda/caixa e enquanto há
diálogo aberto.

**Admin** — Ônix + azul, denso: Central (hoje/7/30 com tendência e
comparação), Alertas (regras fixas), Barbearias no beta, Pesquisas, Produto
com matriz módulo × barbearia, Saúde com erros do Sentry.

**Landing e `/beta`** — deixa claro que o CORTEX é pago, que o beta é sem
cobrança e que os planos abrem em janeiro de 2027; nenhuma promessa nova.

Documentação: `docs/observabilidade.md`, `docs/beta-e-pesquisas.md`,
`docs/ADMIN.md` (§0), `docs/landing-promessas.md`.

## 6. Testes e resultados

| Verificação | Resultado |
|---|---|
| Testes unitários (`npm test`) | **187 passando**, 0 falhas (novos: tendência, documento, limpeza Sentry, classificação Sentry, pesquisas, alertas) |
| Typecheck (`tsc --noEmit`) | limpo |
| Build de produção | ok (local e preview Vercel `1f10add` READY) |
| Banco — pesquisas/beta | 30 cenários (dono, profissional, cliente, outra empresa, suspensa, sem sessão, respostas inválidas, 2ª resposta, encerrada, acesso direto) — todos como esperado, revertidos |
| Banco — pulso/matriz | admin lê; dono recebe FORBIDDEN |
| Autorização por rota (build de produção) | sem sessão → login (produto, Admin, área do cliente); dono → “Acesso restrito” em todo o Admin; admin sem empresa → onboarding |
| Pesquisas ponta a ponta | admin cria/publica → dono vê cartão sem perder foco → responde → não volta → resultado no Admin; “Agora não” gravado como dispensa; 320/390 ok |
| Onboarding ponta a ponta | usuário temporário: CNPJ inválido recusado, válido aceito, plano correto, conclusão no produto |
| Responsividade | 147 combinações (21 rotas × 320/375/390/430/768/1024/1440) — 0 transbordo após correções (Beta em 1024 e gráfico em 320) |
| Acessibilidade | telas novas: sem controle sem nome, sem campo sem rótulo, 1 `h1`, `lang` pt-BR, nada animando com movimento reduzido; foco visível (2 px) |
| Sentry | eventos reais de navegador e servidor, limpos e com contexto; túnel 200 |
| Produção (só leitura) | públicas 200, login QA ok, produto sem erro, 0 erros de console |

Falsos positivos conhecidos dos scripts (verificados à mão): títulos
`sr-only` contados como “cortados”; checkboxes decorativas dentro de moldura
`inert` na landing; contorno 0 px ao reaproveitar a mesma página.

Performance (First Load JS): `/configuracoes` 191 → **124 kB**, `/agenda`
179 → **112 kB**, `/atendimento/[id]` **120 kB**, compartilhado 105 kB com
Sentry. O tempo de servidor medido daqui (1–1,5 s) é dominado pela latência
até o Supabase a partir deste contêiner; na Vercel será outro número.

## 7. Dados de teste criados e removidos

| Criado | Destino |
|---|---|
| Admin temporário `qa-admin-temporario@cortex-qa.test` | privilégio removido, identidade e sessões apagadas, conta travada. **Exceção:** a linha em `auth.users` fica, porque é autora de 2 registros imutáveis em `platform_audit_log` (pesquisa criada/publicada) e a chave estrangeira impede apagar |
| Usuário `qa-onboarding-temporario@cortex-qa.test` + barbearia “QA Temporária Onboarding” (unidade, profissional, serviço, pagamento) | removidos |
| Pesquisa “QA temporária — agenda” + 2 participações | removidas |
| Participações nas pesquisas de teste do banco | revertidas (transação) |
| CNPJ/CPF de teste na NORTE 21 (B2) | restaurado ao valor original |
| Issues CORTEX-OS-1 a 4 no Sentry | resolvidos com comentário (o Sentry não apaga pela API disponível) |

Estado final: 6 empresas (as mesmas do início), 0 pesquisas, 0 participações.
Registros imutáveis de auditoria preservados.

Pendente de decisão sua (de rodadas anteriores): contas
`qa.r7.admin.…@gmail.com` e `qa.r9.owner.…@gmail.com` ainda são admins de
plataforma.

## 8. Vercel

- Preview do branch: builds READY a cada push (último conferido: `1f10add`;
  o push final sai com este relatório).
- Produção: `main` (`8f443aa`), intocada, conferida só por leitura (§6).

## 9. Implementado × preparado × depende de terceiros × depende de você

**Implementado e validado**: tudo das seções 5 e 6.

**Preparado, sem dado real para validar**: leitura do Sentry no Admin
(estado “conectado” — o parser é testado com o formato da API, mas não houve
token para ler de verdade); erros por barbearia; alertas de erro.

**Depende de configuração externa**: as 3 variáveis do Sentry na Vercel;
ligar *Prevent Storing of IP Addresses* no projeto do Sentry (o Sentry deduz
país/cidade pelo IP de envio).

**Depende de decisão sua**:
- valor de referência (R$ 200) e data dos planos (janeiro de 2027) — estão
  como pedido, num lugar só (`lib/beta.ts`);
- as duas contas QA antigas com admin de plataforma;
- a sugestão de corrigir os outros 14 formulários que ainda apagam o que foi
  digitado quando o servidor recusa (fora do escopo; deixada como tarefa).

**Deliberadamente não implementado**: Firebase, Google Maps, Stripe e
cobrança; Session Replay e widget de feedback do Sentry; comparação de
“quem entrou” entre períodos e divisão online × equipe dos agendamentos (os
dados não existem — ver `docs/beta-e-pesquisas.md` §6); rankings de
barbearias por volume.

## 10. Riscos

- Sem as variáveis do Sentry, preview e produção **não registram erro
  nenhum** — o maior risco operacional para o beta até isso ser feito.
- O túnel `/monitoramento` aceita envios de qualquer origem para o projeto do
  Sentry (normal para túnel; o DSN já é público). Se virar ruído, limitar por
  rate limit na Vercel.
- As funções de Admin rodam várias contagens por chamada; com poucas
  barbearias é instantâneo, com centenas vale materializar.
