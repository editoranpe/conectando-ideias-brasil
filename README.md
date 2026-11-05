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

## Versão 2: editor, assinaturas, avisos e importação

### Editor visual (somente administrador)

1. Entre em `/entrar` com a conta administradora já inicializada via `SETUP_TOKEN`.
2. Abra `/painel` → **Editor visual do site** ou acesse `/editar-site`.
3. Adicione/remova seções, configure colunas, cores, fontes, imagem de fundo, espaçamento e selecione widgets (título, texto, imagem, botão, cards, depoimento, FAQ, formulário, divisória e espaçador).
4. Use os controles de arrastar e soltar nos widgets e as setas para reordenar seções.
5. **Salvar rascunho** preserva o site em produção. **Publicar** atualiza o conteúdo em `/`. O histórico permite recuperar versões anteriores **como rascunho**.
6. Antes da primeira publicação com o editor, o site institucional original permanece visível. A primeira publicação substitui o layout público pelo documento do editor, portanto revise a prévia cuidadosamente antes de publicar.

O documento é armazenado no D1, em `site_pages` e `site_page_versions`. Apenas `role=admin` pode atualizar e publicar. A API valida tipos, extensões, comprimentos, cores e URLs e não aceita scripts ou HTML arbitrário.

### Assinaturas mensais

1. Abra **Assinaturas mensais** ou `/assinaturas`.
2. Selecione associados ativos, defina número de parcelas (padrão 6, máximo 36), mês inicial e dia de vencimento (padrão 10, editável entre 1 e 28).
3. Escolha um valor fixo por mensalidade ou deixe vazio para usar primeiro o valor especial do associado e, se não houver, o valor padrão da mensalidade em Configurações.
4. O Worker tem um **Cron Trigger `0 6 * * *`** no `wrangler.jsonc`. Ele processa os planos diariamente às 06:00 UTC, emitindo uma cobrança apenas quando chega a competência de cada mês. Uma restrição `UNIQUE(member_id,period)` impede cobrança duplicada na mesma competência. O dia de vencimento é mantido inclusive em finais de semana.
5. Para antecipar a rotina, use **Processar agora**. É possível pausar/retomar planos e alterar seu dia de vencimento para **parcelas futuras**, ou alterar o vencimento de uma cobrança pendente específica em Mensalidades.
6. Criar a cobrança e gerar QR Pix estático **não confirma pagamento**. A tesouraria confere o extrato e realiza a baixa. O desenvolvimento da integração com a API bancária fica reservado para uma etapa futura.

**Atenção ao Cloudflare:** Cron Triggers precisam aparecer em **Worker → Triggers** depois do deploy. Se o projeto estiver configurado para ignorar o `wrangler.jsonc`, ajuste a configuração no painel. Não assuma que o agendamento está ativo sem confirmar no Cloudflare.

### Importação e exportação de planilhas

- Acesse `/importar`. Converta a planilha do Excel ou Google Sheets para **CSV UTF-8**.
- Colunas obrigatórias: `Nome`, `E-mail`. Opcionais: `Telefone`, `Empresa`, `Segmento`, `Cidade`, `Status`, `Mensalidade`, `Observações`.
- O sistema mostra uma prévia, valida as linhas, envia lotes de até 100 registros, ignora e-mails já existentes e registra auditoria. Dados importados não são enviados ao repositório GitHub.
- Exporte associados, cobranças e lançamentos financeiros em CSV pelos links do painel. Faça backup regular do próprio banco D1 na Cloudflare para garantir uma cópia completa, além dos relatórios CSV.
- Para importar movimentações financeiras históricas, faça uma conferência do formato de sua planilha antes de qualquer lançamento ou baixa retroativa; **a importação de CSV desta versão cadastra associados**, não confirma pagamentos.

### Dados bancários e avisos

- Em **Configurações → Dados do Pix**, cadastre **somente a chave Pix oficial do grupo**, recebedor, cidade e opcionalmente banco, agência, conta, tipo, CPF/CNPJ e descrição.
- Clique em **Salvar configurações** e depois em **Testar Pix (R$ 1,00)**. Confira o recebedor no aplicativo bancário antes de disponibilizar cobranças reais.
- Para cada cobrança pendente, Mensalidades possui botões **E-mail** e **WhatsApp**. Sem provedor conectado, abre uma mensagem pronta no aplicativo para revisão e envio manual. O sistema não afirma que esse aviso já foi enviado.
- Opcionalmente configure **somente no Cloudflare Worker → Settings → Variables and Secrets**:
  - `RESEND_API_KEY` (Secret) e `RESEND_FROM` (endereço remetente verificado) para envio por e-mail via Resend;
  - `WHATSAPP_ACCESS_TOKEN` (Secret) e `WHATSAPP_PHONE_NUMBER_ID` (identificador de telefone Meta) para envio via Meta WhatsApp Business API. Nesse caso, é necessário ter um modelo aprovado chamado `cib_mensalidade` (idioma `pt_BR`, quatro parâmetros: nome, competência, valor e vencimento).
- **Avisos automáticos são opt-in:** vêm desativados por padrão. Com as credenciais de um provedor cadastradas no Cloudflare, selecione e salve **Configurações → Cobranças → Envio automático de avisos → Ativado**. O Cron diário processará os avisos dos planos com canal e-mail/WhatsApp selecionado. O sistema registra cada envio por cobrança/canal e evita repetições, com limite de processamento por execução. Sem provedores configurados, nenhum aviso automático é enviado. Os botões de envio manual permanecem disponíveis. **Confirmação bancária automática ainda não está ativada:** a tesouraria continua conferindo o extrato e baixando pagamentos manualmente. Antes dos avisos automáticos, valide a base legal e preferências de comunicação dos associados.
- Credenciais de banco e provedores nunca devem ser adicionadas ao GitHub.

### Verificações de desenvolvimento

```sh
npm install
npm run check
```

O comando roda build, checagem de TypeScript da API, testes Pix, esquema D1, recorrências, CSV e validação dos documentos do editor. O workflow `verify-cloudflare-deployment.yml` compara a resposta publicada em `/api/version` com a marca da versão 2, consulta `/api/public-page`, `/api/health` e `/api/setup-status`. Uma compilação aprovada no GitHub **não substitui** a confirmação no painel da Cloudflare para agendamentos e segredos.
