# Conectando Ideias Brasil

Site institucional e sistema de gestão de membros, mensalidades e Pix. Stack: React + Vite, Cloudflare Worker (API), D1 (banco de dados).

- Site: https://conectando-ideias-brasil.jeferson-samagaia.workers.dev/
- Repositório: https://github.com/editoranpe/conectando-ideias-brasil
- Para apresentação, acesse `/demonstracao` (apenas dados fictícios).

## Política de credenciais: somente Cloudflare

**Nunca colocar tokens, senhas, segredos ou dados privados no GitHub, nem em GitHub Actions Secrets.** GitHub hospeda somente código-fonte, configurações não confidenciais e a compilação do frontend.

Credenciais de produção devem ser cadastradas **exclusivamente em Cloudflare → Workers & Pages → conectando-ideias-brasil → Settings → Variables and Secrets → Add → Secret**. O Cloudflare criptografa esses valores e não permite recuperá-los em texto no painel.

A automação anterior de provisionamento via GitHub foi REMOVIDA. Nenhum workflow deste repositório requer `CLOUDFLARE_API_TOKEN` ou `CLOUDFLARE_ACCOUNT_ID`. Se esses segredos tiverem sido cadastrados no GitHub, exclua-os na interface do repositório e revogue/rotacione qualquer token que tenha sido exposto.

### Configurações de produção

| Configuração | Tipo | Onde configurar | Observações |
|---|---|---|---|
| `SETUP_TOKEN` | **Secret** | Cloudflare → Worker → Settings → Variables and Secrets | Segredo aleatório de 24+ caracteres, somente para a criação do administrador inicial |
| `DB` | **D1 binding** | Cloudflare → Worker → Bindings (ver abaixo) | NÃO é variável textual; aponta para um banco D1, sem senha |
| Chave Pix, nome e cidade do favorecido | Dados administrativos | Painel do sistema após login | Guardados no D1; serão mostrados nas cobranças Pix, portanto não equivalem a um token bancário |

**Nenhuma variável precisa ser cadastrada no GitHub.** A conexão GitHub → Worker é gerenciada pela própria Cloudflare.

## Implantação automática

O Cloudflare Workers Builds está conectado ao repositório `editoranpe/conectando-ideias-brasil`, branch `main`, raiz `/`.

No Cloudflare, em Worker → Settings → Build, use:

- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`

O arquivo `wrangler.jsonc` é público e contém somente a configuração técnica do Worker, sem qualquer credencial, ID de conta ou UUID de banco. Ele define `keep_vars: true`, para preservar variáveis de ambiente configuradas pelo painel durante deploys. Segredos cadastrados no Cloudflare também são preservados.

### Banco D1

O Worker usa um **binding D1 denominado `DB`**. O `wrangler.jsonc` declara apenas esse nome, sem IDs nem informações privadas. O Wrangler 4.45+ suporta provisionamento automático de D1 durante um deploy. Com a integração GitHub/Cloudflare, os IDs gerados ficam no Cloudflare, sem serem escritos no repositório.

1. Abra **Workers & Pages → conectando-ideias-brasil → Bindings** e verifique se o binding `DB` está disponível.
2. Abra **Storage & Databases → D1** no Cloudflare e localize o banco vinculado a `DB`. Se o provisionamento automático não funcionar, crie manualmente um banco chamado `conectando-ideias-brasil-db` e selecione-o no binding `DB` do Worker. Não use uma variável de texto chamada `DB`.
3. Na primeira chamada da API, o sistema cria automaticamente as tabelas **apenas se esse D1 ainda não contiver nenhuma tabela do aplicativo**. O SQL de referência está em [migrations/0001_initial.sql](migrations/0001_initial.sql). Se o banco já contiver tabelas parcialmente criadas ou dados reais, a instalação automática não modifica essas tabelas: faça backup e execute a migração manualmente após revisar o estado do banco.
4. No Worker, em **Settings → Variables and Secrets**, crie o segredo `SETUP_TOKEN` como tipo **Secret** e aplique a mudança.
5. Confirme `GET /api/health` (HTTP 200) e `GET /api/setup-status` (deve indicar `setup_required: true` se não houver administrador).
6. Acesse `/entrar` e inicialize a conta administrativa com o `SETUP_TOKEN`. Em seguida, remova ou rotacione o segredo após o primeiro acesso.

**Atenção:** a primeira chamada à API inicializa o schema apenas em um banco totalmente vazio. `/api/setup-status` confirma a criação das tabelas. Se houver tabelas parciais, elas não são alteradas automaticamente.

### Pix e gestão financeira

O Pix Copia e Cola / QR Code usa a chave e os dados do favorecido informados no painel. Não realiza transferências nem confirma recebimentos automaticamente. A tesouraria confirma o pagamento a partir do extrato bancário.

O modo `/demonstracao` usa dados fictícios. Não insira nele dados pessoais ou financeiros verdadeiros. Antes da operação real, confirme permissões de acesso, política de privacidade (LGPD), backups e processo de conciliação.

## Desenvolvimento e verificações

```sh
npm install
npm run check
npx wrangler dev
```

- `GET /api/health`: HTTP 200 se existe binding `DB`, HTTP 503 se estiver ausente.
- `GET /api/setup-status`: verifica se já existe administrador (exige tabelas D1).
- `GET /`: site público.
- `GET /demonstracao`: painel fictício.

**Importante:** acesso ao repositório GitHub não dá permissão para mudar os recursos da conta Cloudflare. Alterações de bindings, variáveis e segredos são feitas na interface da Cloudflare, com a conta autorizada.
