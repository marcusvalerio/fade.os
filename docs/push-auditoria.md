# Push — auditoria de 30/09/2026

Verificação feita sem ler nenhum valor secreto. Fontes: bundle público do
deploy de produção (`dpl_99R9sG24…`, main `74d8ab7`) e do Preview de 30/09
(`cortex-fydngx5s5`), painel **Admin → Saúde → Integrações** dos dois
ambientes (lê o ambiente do servidor e diz só "presente/ausente"), e consultas
somente leitura no banco.

## Variáveis (projeto Vercel **cortex-os**)

| Variável | Production | Preview | Usada pelo código? | Para quê |
|---|---|---|---|---|
| NEXT_PUBLIC_FIREBASE_API_KEY | ausente | ausente | sim (push-navegador.ts) | ligar push no aparelho |
| NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN | ausente | ausente | sim | idem |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID | ausente | ausente | sim | idem |
| NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID | ausente | ausente | sim | idem |
| NEXT_PUBLIC_FIREBASE_APP_ID | ausente | ausente | sim | idem |
| NEXT_PUBLIC_FIREBASE_VAPID_KEY | **presente** | **presente** | sim (há padrão no código) | assinatura Web Push |
| NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET | — | — | não | nenhum (opcional) |
| FIREBASE_SERVICE_ACCOUNT | ausente | ausente | sim (fcm.ts) | servidor enviar ao FCM |
| FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY | ausentes | ausentes | sim (alternativa à de cima) | idem |
| NOTIFICACOES_SEGREDO | ausente | ausente | sim (processar/route.ts) | proteger o processador |
| CRON_SECRET | ausente | ausente | sim (alternativa, ≥ 24 caracteres) | idem |

Controle do método: a URL do Supabase aparece embutida no mesmo bundle, e a
chave VAPID também. Só as cinco do app Web do Firebase é que não entraram.

Existe na equipe um projeto antigo **fade-os**, separado do **cortex-os**.
Variáveis cadastradas lá não valem para o Cortex.

## Banco

- Vault `notificacoes_url`: ausente. Vault `notificacoes_segredo`: ausente.
- `pg_net` → `/api/notificacoes/processar`: 0 chamadas em 7 dias.
- Aparelhos registrados (todas as pessoas): 0. Pessoas com push ligado: 0.
- Entregas de push na história: 0.
- Realtime: `notificacao` na publicação (migration `notificacao_realtime`).

## Teste real (30/09 09:25 UTC)

Notificação de teste `plataforma.integracao_falha` com a chave
`auditoria-push:admin:20260930` para o admin:

1. Criada no banco: sim.
2. Entrega no app: `entregue`.
3. Realtime: um assinante autenticado recebeu a própria notificação de teste
   na hora; a do admin não chegou a ele (RLS por pessoa funcionando).
4. Entrega de push: **não criada**. O admin não tem push ligado nem aparelho.
5. Endpoint chamado: não. Firebase: não. Aparelho: não.

Último ponto funcionando: **notificação no banco + central/sino + Realtime**.

## O que falta (manual)

1. Vercel → projeto **cortex-os** → Settings → Environment Variables,
   para Production e Preview:
   - as cinco `NEXT_PUBLIC_FIREBASE_*` do app Web
     (Firebase → Configurações do projeto → Geral → Seus apps → app Web → Configuração);
   - `FIREBASE_SERVICE_ACCOUNT` = o JSON inteiro de
     Firebase → Contas de serviço → Gerar nova chave privada (marcar como Sensitive);
   - `NOTIFICACOES_SEGREDO` = texto aleatório com 32+ caracteres (Sensitive).
2. Refazer o deploy de produção. As `NEXT_PUBLIC_*` só valem depois de um build novo.
3. Supabase → SQL Editor (feito por você, para o valor nunca passar por aqui):
   ```sql
   select vault.create_secret('https://fadeos-five.vercel.app', 'notificacoes_url');
   select vault.create_secret('<o mesmo NOTIFICACOES_SEGREDO>', 'notificacoes_segredo');
   ```
4. No celular: abrir `https://fadeos-five.vercel.app/admin/avisos/preferencias`,
   tocar em ativar push e permitir. No iPhone, antes: Compartilhar →
   Adicionar à Tela de Início, e abrir pelo ícone (iOS 16.4+).
5. Conferir em Admin → Saúde: todas as linhas de push em "OK".
