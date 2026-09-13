# Recuperação de senha — "Esqueci minha senha"

Fluxo novo, para contas com e-mail real (dono/gerência). Usa só o mecanismo
oficial do Supabase Auth já em uso pelo projeto — nenhum token próprio,
nenhuma tabela nova, nenhuma chave nova.

## Por que só dono/gerência

O login por identificador (profissional/barbeiro) usa um e-mail interno
sintético (`<identificador>@login.fade.os`, gerado em
`actions/profissional-acesso.ts`) — não existe caixa de entrada de verdade
por trás dele. Enviar um "link de recuperação" para esse endereço não
chegaria a ninguém. Para profissionais, o caminho de recuperação continua
sendo o que já existia: o responsável reseta o acesso em
Configurações → Equipe (`resetProfessionalAccess`), que gera uma nova senha
temporária. Isso está documentado na própria tela de "Esqueci minha senha".

## Fluxo

```
/login ("Esqueceu sua senha?")
  → /esqueci-senha (informa e-mail)
  → actions/auth.ts: requestPasswordReset()
      → supabase.auth.resetPasswordForEmail(email, { redirectTo })
      → resposta SEMPRE neutra (o próprio Supabase já não diferencia
        e-mail existente de inexistente nesta chamada)
  → e-mail chega (template padrão do Supabase, "Reset Password")
  → link aponta para {redirectTo} = {origin}/auth/callback?next=/redefinir-senha
  → app/auth/callback/route.ts: exchangeCodeForSession(code)
      → sucesso: redireciona para /redefinir-senha (sessão de recuperação ativa)
      → falha (link usado/expirado): redireciona para /redefinir-senha?error=invalid
  → /redefinir-senha: formulário de nova senha + confirmação
      → actions/auth.ts: updatePasswordAfterRecovery()
      → supabase.auth.updateUser({ password })
      → sucesso: redireciona para "/" — a mesma sessão continua,
        com o mesmo company/role/professional/RLS de sempre
```

## Configuração necessária no painel do Supabase

**Isto precisa ser feito manualmente no projeto `xaxszgyvapvzwensbjjq`, uma
vez, por quem tem acesso ao painel — não é algo que o código resolve
sozinho:**

1. **Authentication → URL Configuration → Redirect URLs**: adicionar
   `<origem>/auth/callback` para cada origem real onde o CORTEX.OS roda —
   por exemplo `https://seu-dominio-de-producao.com/auth/callback` e, se
   quiser testar localmente, `http://localhost:3000/auth/callback`. **Sem
   essa entrada, o Supabase ignora o `redirectTo` pedido e usa a Site URL
   padrão do projeto** — o link do e-mail levaria para o lugar errado.
2. **Authentication → URL Configuration → Site URL**: confirmar que aponta
   para a origem de produção real — é o fallback usado quando o
   `redirectTo` não bate com nenhuma entrada acima.
3. **Authentication → Email Templates → Reset Password**: este fluxo
   assume o template padrão do Supabase (o que usa `{{ .ConfirmationURL }}`
   sem alteração). Se o template tiver sido customizado para outro formato
   de link, o `code` que `app/auth/callback` espera pode não chegar do jeito
   esperado — vale conferir depois de configurar o item 1.
4. **Rate limits de e-mail** (Authentication → Rate Limits): o Supabase já
   limita quantos e-mails de recuperação saem por hora por padrão; nenhuma
   mudança foi feita aqui, só documentado que existe.

Nenhum destes quatro itens foi alterado por código — são ajustes de painel,
fora do repositório, e ficam registrados aqui em vez de inventados.

## O que NÃO foi tocado

- `SUPABASE_SERVICE_ROLE_KEY` não é usada em nenhum ponto deste fluxo —
  `resetPasswordForEmail`, `exchangeCodeForSession` e `updateUser` rodam
  inteiramente com a chave anônima (`NEXT_PUBLIC_SUPABASE_ANON_KEY`), do
  lado do usuário. O bloqueio de ambiente conhecido (chave de serviço
  placeholder, documentado nas rodadas de auditoria anteriores) **não afeta
  este fluxo**.
- Nenhum token de recuperação é lido, gerado, validado ou guardado por este
  app — o código só troca o `code` que o Supabase já validou por uma sessão
  (`exchangeCodeForSession`), a mesma função usada pelo padrão oficial do
  Supabase para Next.js App Router.
- `company_id`/`role`/`professional_id`/RLS/escopo do usuário não mudam:
  `updateUser({ password })` só troca a senha da conta (`auth.users`); nada
  neste fluxo escreve em `user_company_role`, `professional` ou
  `professional_access`.
