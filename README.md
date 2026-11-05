# Conectando Ideias Brasil

Site institucional e sistema de administração para membros, inscrições, mensalidades, controle financeiro e Pix. Stack: React 19 + Vite, API no Cloudflare Workers e banco D1.

**Repositório**: https://github.com/editoranpe/conectando-ideias-brasil  
**Worker**: https://conectando-ideias-brasil.jeferson-samagaia.workers.dev/

## Implantação do site no Cloudflare Worker

Este projeto é um **Worker com Static Assets**, não um Cloudflare Pages Functions. O arquivo `wrangler.jsonc` controla a publicação: Worker `conectando-ideias-brasil`, frontend em `dist/` e API em `src/worker.ts` sob `/api/*`.

1. No Cloudflare, abra Workers & Pages → `conectando-ideias-brasil` → **Settings → Builds**. Confirme que a conexão está no repositório **editoranpe/conectando-ideias-brasil**, branch **main**, diretório raiz `/`.
2. Use **Build command**: `npm run build` e **Deploy command**: `npx wrangler deploy`. Se a conexão tiver apenas deploy, existe um arquivo estático inicial em `dist/` e um GitHub Actions que compila e versiona o frontend automaticamente após commits em `main`. Acompanhe a aba Actions e os builds do Cloudflare para confirmar o resultado.
3. Em **Settings → Domains & Routes**, confirme que o domínio **workers.dev** está habilitado para este Worker.
4. Teste `/` e `/demonstracao` (dados fictícios). O código Pix possui testes automatizados. **O modo de demonstração não registra dinheiro de verdade.**

## Ativação do banco de membros e financeiro

> Sem o banco D1 configurado, a API retorna **503**. O site e as telas de demonstração continuam acessíveis. **Não cadastre dados pessoais reais no modo de demonstração.**

1. No painel Cloudflare, abra **Storage & databases → D1** e crie um banco com nome `conectando-ideias-brasil-db`.
2. Execute a migração inicial `migrations/0001_initial.sql` no **Console** desse banco. Alternativamente, execute com Wrangler autenticado em sua conta:
   ```sh
   npx wrangler d1 execute conectando-ideias-brasil-db --remote --file=migrations/0001_initial.sql
   ```
3. Na configuração do Worker, vá em **Settings → Bindings → Add Binding → D1 database** e crie a variável **`DB`** apontando para esse banco. Se as implantações substituírem os bindings, fixe o `database_id` real em `wrangler.jsonc` dentro de `d1_databases`:
   ```json
   "d1_databases": [
     { "binding": "DB", "database_name": "conectando-ideias-brasil-db", "database_id": "SEU_UUID_REAL_DO_D1" }
   ]
   ```
   Não use UUID fictício. O identificador real aparece na página do banco no Cloudflare.
4. Em **Settings → Variables & Secrets**, cadastre um segredo `SETUP_TOKEN` forte, aleatório e exclusivo (mínimo 24 caracteres), **nunca no GitHub**. Acesse `/entrar`, informe o segredo e crie a primeira conta administrativa com senha forte. Remova ou substitua o segredo após o primeiro acesso.
5. Dentro do painel, informe a chave Pix verdadeira do grupo, o nome correto do favorecido e sua cidade. Confirme um QR Code com seu banco antes de cobrar mensalidades.

### Nota sobre Pix

O código **Pix Copia e Cola/QR Code é estático** e usa a chave informada. A tesouraria confirma manualmente no extrato. O envio de comprovante pelo membro não equivale a pagamento confirmado. **Conciliação bancária automática** exige integração com um provedor financeiro autorizado e não está ativada.

## Segurança e privacidade

A API usa controle de acesso por perfil (`admin`, `finance`, `member`), hashes de senha PBKDF2, cookies HttpOnly, logs de auditoria e validação de origem em mutações. Não registre no GitHub chaves bancárias privadas, `.dev.vars`, senhas ou dados dos membros. Antes de processar dados reais, valide os controles de segurança, faça backup do banco, defina uma política LGPD, e configure responsabilidades da tesouraria e retenção de dados. Faça testes com o banco D1 recém-criado antes de uso real.

## Desenvolvimento

```sh
npm install
npm run check
npx wrangler dev
```

## Diagnóstico

- `GET /api/health` → retorna JSON quando o D1 está conectado; retorna 503 se não houver binding.
- `GET /api/setup-status` → indica se precisa criar o primeiro administrador.
- `GET /` e `/demonstracao` → site institucional e visualização fictícia.
- O envio de código ao GitHub **não comprova sozinho** que o Cloudflare implantou: valide os registros de Builds e o URL final.

## Provisionamento automatizado do D1 (sem compartilhar credenciais)

O workflow manual [Provision and connect Cloudflare D1](.github/workflows/provision-d1.yml) evita copiar UUIDs manualmente e mantém a associação permanente com o Worker no `wrangler.jsonc`.

**O que configurar uma única vez** (somente na interface do GitHub, nunca em commits ou conversas):

1. No Cloudflare, gere um API Token com permissão **Account > D1 > Edit**, restrito à conta que hospeda este Worker. Consulte [Cloudflare: API Tokens](https://dash.cloudflare.com/profile/api-tokens).
2. No repositório, abra **Settings > Secrets and variables > Actions > New repository secret**. Cadastre `CLOUDFLARE_API_TOKEN` com o token e `CLOUDFLARE_ACCOUNT_ID` com o identificador da conta Cloudflare.
3. Abra **Actions > Provision and connect Cloudflare D1 > Run workflow**, usando a branch `main`.

O workflow consulta o D1 `conectando-ideias-brasil-db`; cria somente se ainda não existir; liga o binding `DB`, aplica as migrações SQL na base remota e grava o UUID em `wrangler.jsonc`. Em caso de divergência com um binding já existente, **interrompe sem substituí-lo**. O commit com a configuração aciona o deploy do Worker ligado ao GitHub. A permissão de escrita do token deve estar limitada a D1; o deploy continua sendo feito pela integração Cloudflare-GitHub já instalada.

**Atenção:** este workflow não recebe nem cria a senha do administrador. Após o banco estar ligado e `/api/health` retornar HTTP 200, adicione **SETUP_TOKEN** como segredo de execução em **Cloudflare Worker > Settings > Variables and Secrets** e crie a primeira conta através de `/entrar`. O token de inicialização deve ser aleatório e ter pelo menos 24 caracteres. Não envie o segredo por mensagem.
