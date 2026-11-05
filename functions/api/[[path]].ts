import { buildPixCode } from '../_lib/pix';
import { INITIAL_SCHEMA_STATEMENTS } from '../_lib/schema';
import { NOW, uuid, sha256, randomToken, passwordHash, verifyPassword, readSessionCookie, sessionCookie, expireCookie } from '../_lib/auth';

type Role = 'admin' | 'finance' | 'member';
type Query = { bind: (...values: unknown[]) => Query; first: <T = any>() => Promise<T | null>; all: <T = any>() => Promise<{results: T[]}>; run: () => Promise<{meta: {changes?: number}}> };
type DB = { prepare: (sql: string) => Query; batch: (queries: Query[]) => Promise<unknown> };
type Env = { DB: DB; SETUP_TOKEN?: string };
type Context = { request: Request; env: Env };
type User = { id: string; email: string; role: Role; member_id: string | null };

type AppError = Error & { status?: number };
function fail(message: string, status = 400): never {
  const error = new Error(message) as AppError;
  error.status = status;
  throw error;
}
function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
}
async function body(request: Request): Promise<Record<string, any>> {
  if (!request.headers.get('Content-Type')?.toLowerCase().includes('application/json')) fail('Envie os dados em JSON', 415);
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 30_000) fail('Requisição muito grande', 413);
  try {
    const value = await request.json();
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('bad');
    if (JSON.stringify(value).length > 30_000) fail('Requisição muito grande', 413);
    return value;
  } catch (error) {
    if ((error as AppError).status) throw error;
    fail('JSON inválido');
  }
}
function str(value: unknown, max = 250): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function required(value: unknown, title: string, max = 250): string {
  const item = str(value, max);
  if (!item) fail(`Informe ${title}`);
  return item;
}
function email(value: unknown): string {
  const e = required(value, 'o e-mail', 160).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) fail('E-mail inválido');
  return e;
}
function cents(value: unknown, positive = true): number {
  if (!Number.isSafeInteger(value) || (positive ? Number(value) <= 0 : Number(value) < 0) || Number(value) > 50_000_000) fail('Valor monetário inválido');
  return Number(value);
}
function validPeriod(v: unknown): string {
  const p = str(v, 7);
  if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(p)) fail('Competência inválida (AAAA-MM)');
  return p;
}
function validDate(v: unknown): string {
  const d = str(v, 10);
  if (!/^\d{4}-\d\d-\d\d$/.test(d) || Number.isNaN(Date.parse(`${d}T12:00:00Z`)) || new Date(`${d}T12:00:00Z`).toISOString().slice(0, 10) !== d) fail('Data inválida');
  return d;
}
function currentDateBR(): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return /^\d{4}-\d\d-\d\d$/.test(p) ? p : new Date().toISOString().slice(0, 10);
}
function routeSegments(request: Request): string[] {
  return new URL(request.url).pathname.replace(/\/+$/, '').split('/').filter(Boolean).slice(1);
}
function requireOrigin(request: Request): void {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) fail('Origem não permitida', 403);
  if (request.headers.get('Sec-Fetch-Site') === 'cross-site') fail('Origem não permitida', 403);
}
async function account(context: Context, requiredRoles?: Role[]): Promise<User> {
  const token = readSessionCookie(context.request);
  if (!token) fail('Entre na sua conta para continuar', 401);
  const tokenHash = await sha256(token);
  const user = await context.env.DB.prepare(
    'SELECT u.id,u.email,u.role,u.member_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?'
  ).bind(tokenHash, NOW()).first<User>();
  if (!user) fail('Sessão expirada. Faça login novamente.', 401);
  if (requiredRoles && !requiredRoles.includes(user.role)) fail('Você não tem permissão para esta ação', 403);
  return user;
}
async function audit(db: DB, user: User | null, action: string, entity: string, entityId: string, details: Record<string, unknown> = {}) {
  await db.prepare('INSERT INTO audit_logs(id,actor_id,action,entity_type,entity_id,details,created_at) VALUES(?,?,?,?,?,?,?)')
    .bind(uuid(), user?.id ?? null, action, entity, entityId, JSON.stringify(details), NOW()).run();
}
const defaults: Record<string, string> = {
  group_name: 'Conectando Ideias Brasil',
  monthly_amount_cents: '4000',
  due_day: '10',
  pix_key: '',
  pix_receiver: '',
  pix_city: 'BLUMENAU',
  contact_email: '',
  contact_whatsapp: '',
  meeting_place: 'Auditório do Casarão dos Sonhos, Blumenau - SC',
};
async function getSettings(db: DB): Promise<Record<string, string>> {
  const rows = (await db.prepare('SELECT key,value FROM settings').all<{key: string; value: string}>()).results;
  const values = { ...defaults };
  for (const row of rows) if (row.key in values) values[row.key] = row.value;
  return values;
}
async function setupRequired(db: DB): Promise<boolean> {
  const result = await db.prepare("SELECT COUNT(*) AS total FROM users WHERE role='admin'").first<{total: number}>();
  return !result?.total;
}
function csv(rows: any[], columns: [string,string][]): Response {
  const safe = (value: unknown) => {
    let cell = String(value ?? '');
    if (/^[\s]*[=+@\-]/.test(cell)) cell = "'" + cell;
    return `"${cell.replace(/"/g, '""')}"`;
  };
  const content = [columns.map(c => safe(c[1])).join(';'), ...rows.map(row => columns.map(([field]) => safe(row[field])).join(';'))].join('\r\n');
  return new Response('\ufeff' + content, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Disposition': 'attachment; filename="conectando-ideias-relatorio.csv"' } });
}

// Bootstrap only a completely empty D1. Never auto-modify a database with app tables.
async function initializeEmptyDatabase(db: DB): Promise<void> {
  const found = await db.prepare(
    "SELECT COUNT(*) AS total FROM sqlite_master WHERE type='table' AND name IN ('users','members','sessions','login_attempts','invitations','settings','applications','charges','payment_reports','transactions','audit_logs')"
  ).first<{ total: number }>();
  if (Number(found?.total || 0) === 0) {
    // D1.exec splits SQL on newlines, which breaks multi-line CREATE TABLE statements.
    // D1.batch executes prepared statements transactionally instead.
    await db.batch(INITIAL_SCHEMA_STATEMENTS.map(statement => db.prepare(statement)));
  }
}

async function handle(context: Context): Promise<Response> {
  const { request, env } = context;
  const db = env.DB;
  if (!db?.prepare) return json({ error: 'Banco D1 não conectado. Configure o binding DB no Cloudflare Workers.' }, 503);
  const path = routeSegments(request), method = request.method.toUpperCase();
  if (!['GET','POST','PATCH'].includes(method)) fail('Método não permitido', 405);
  if (method !== 'GET') requireOrigin(request);
  const is = (verb: string, ...parts: string[]) => method === verb && JSON.stringify(path) === JSON.stringify(parts);

  await initializeEmptyDatabase(db);

  if (is('GET', 'health')) return json({ ok: true, service: 'Conectando Ideias Brasil', date: NOW() });
  if (is('GET', 'public')) {
    const s = await getSettings(db);
    return json({ group_name: s.group_name, monthly_amount_cents: Number(s.monthly_amount_cents), due_day: Number(s.due_day), meeting_place: s.meeting_place, contact_email: s.contact_email, contact_whatsapp: s.contact_whatsapp, pix_available: !!(s.pix_key && s.pix_receiver) });
  }
  if (is('GET', 'setup-status')) return json({ setup_required: await setupRequired(db) });
  if (is('POST', 'setup')) {
    if (!(await setupRequired(db))) fail('A conta administrativa já foi criada', 409);
    if (!env.SETUP_TOKEN || env.SETUP_TOKEN.length < 24) fail('Configure o segredo SETUP_TOKEN no Cloudflare antes de continuar', 503);
    const data = await body(request);
    const setupHash = await sha256(str(data.setup_token, 512));
    if (setupHash !== await sha256(env.SETUP_TOKEN)) fail('Código de configuração inválido', 403);
    const loginEmail = email(data.email);
    const name = required(data.name, 'o nome do administrador', 120);
    const hashed = await passwordHash(str(data.password, 128));
    const userId = uuid(), memberId = uuid(), now = NOW();
    // A restrição UNIQUE do banco impede duas inicializações simultâneas com o mesmo e-mail.
    await db.batch([
      db.prepare('INSERT INTO members(id,name,email,company,status,joined_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(memberId, name, loginEmail, 'Administração CIB', 'active', currentDateBR(), now, now),
      db.prepare('INSERT INTO users(id,email,password_salt,password_hash,role,member_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(userId, loginEmail, hashed.salt, hashed.hash, 'admin', memberId, now, now),
    ]);
    await audit(db, { id: userId, email: loginEmail, role: 'admin', member_id: memberId }, 'initial_setup', 'user', userId);
    return json({ success: true, message: 'Administração criada. Faça login.' }, 201);
  }
  if (is('POST', 'login')) {
    const data = await body(request), loginEmail = email(data.email), password = str(data.password, 128);
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    const key = await sha256(`${loginEmail}|${clientIp}`);
    const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();
    const attempts = await db.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE key_hash=? AND attempted_at>?').bind(key, cutoff).first<{n: number}>();
    if ((attempts?.n || 0) >= 6) fail('Muitas tentativas. Tente novamente em 15 minutos.', 429);
    const user = await db.prepare('SELECT id,email,role,member_id,password_salt,password_hash FROM users WHERE email=?').bind(loginEmail).first<User & {password_salt:string; password_hash:string}>();
    let valid = false;
    if (user && password) {
      try { valid = await verifyPassword(password, user.password_salt, user.password_hash); } catch { valid = false; }
    }
    if (!valid || !user) {
      await db.prepare('INSERT INTO login_attempts(key_hash,attempted_at) VALUES(?,?)').bind(key, NOW()).run();
      fail('E-mail ou senha incorretos', 401);
    }
    await db.prepare('DELETE FROM login_attempts WHERE key_hash=?').bind(key).run();
    const token = randomToken(), expiry = new Date(Date.now() + 12 * 3600_000).toISOString();
    await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').bind(await sha256(token), user.id, expiry, NOW()).run();
    return json({ user: { id: user.id, email: user.email, role: user.role, member_id: user.member_id } }, 200, { 'Set-Cookie': sessionCookie(token) });
  }
  if (is('POST', 'logout')) {
    const token = readSessionCookie(request);
    if (token) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(token)).run();
    return json({ success: true }, 200, { 'Set-Cookie': expireCookie() });
  }
  if (is('GET', 'me')) {
    const user = await account(context);
    const member = user.member_id ? await db.prepare('SELECT id,name,email,company,status FROM members WHERE id=?').bind(user.member_id).first() : null;
    return json({ user, member });
  }
  if (is('POST', 'apply')) {
    const data = await body(request);
    if (data.website) return json({ success: true }, 201); // honeypot
    if (data.consent !== true) fail('É necessário aceitar a política de privacidade');
    const e = email(data.email), name = required(data.name, 'o nome', 120), phone = required(data.phone, 'o telefone', 40), company = required(data.company, 'a empresa', 120);
    const cutoff = new Date(Date.now() - 24*3600_000).toISOString();
    const repeated = await db.prepare('SELECT COUNT(*) AS n FROM applications WHERE email=? AND created_at>?').bind(e, cutoff).first<{n: number}>();
    if ((repeated?.n || 0) >= 2) fail('Já recebemos sua solicitação. Aguarde o contato do grupo.', 429);
    const id = uuid(), now = NOW();
    await db.prepare('INSERT INTO applications(id,name,email,phone,company,message,consented_at,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,name,e,phone,company,str(data.message,1000),now,now).run();
    return json({ success: true, message: 'Inscrição recebida. A comissão entrará em contato.' }, 201);
  }
  if (is('POST', 'activate')) {
    const data = await body(request), invitationToken = required(data.token, 'o convite', 128);
    const invitation = await db.prepare('SELECT i.id,i.member_id,i.expires_at,i.used_at,m.email FROM invitations i JOIN members m ON m.id=i.member_id WHERE i.token_hash=?').bind(await sha256(invitationToken)).first<{id:string;member_id:string;expires_at:string;used_at:string|null;email:string}>();
    if (!invitation || invitation.used_at || invitation.expires_at < NOW()) fail('Este convite expirou ou já foi utilizado', 410);
    const hashed = await passwordHash(str(data.password,128));
    const existing = await db.prepare('SELECT id FROM users WHERE member_id=? OR email=?').bind(invitation.member_id, invitation.email).first<{id: string}>();
    const now = NOW();
    if (existing) {
      await db.prepare("UPDATE users SET password_salt=?,password_hash=?,updated_at=? WHERE id=? AND role='member'").bind(hashed.salt,hashed.hash,now,existing.id).run();
      const current = await db.prepare('SELECT role FROM users WHERE id=?').bind(existing.id).first<{role:Role}>();
      if (current?.role !== 'member') fail('Convite inválido para esta conta', 403);
      await db.prepare('DELETE FROM sessions WHERE user_id=?').bind(existing.id).run();
    } else {
      await db.prepare('INSERT INTO users(id,email,password_salt,password_hash,role,member_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(uuid(),invitation.email,hashed.salt,hashed.hash,'member',invitation.member_id,now,now).run();
    }
    await db.prepare('UPDATE invitations SET used_at=? WHERE id=? AND used_at IS NULL').bind(now,invitation.id).run();
    return json({ success: true, message: 'Conta ativada. Faça login.' });
  }

  // Rotas autenticadas a partir deste ponto.
  const user = await account(context);
  const isManager = user.role === 'admin' || user.role === 'finance';
  if (is('GET', 'dashboard')) {
    if (!isManager) {
      const charges = (await db.prepare('SELECT id,period,due_date,amount_cents,status,paid_at FROM charges WHERE member_id=? ORDER BY period DESC LIMIT 24').bind(user.member_id).all()).results;
      return json({ charges, today: currentDateBR() });
    }
    const members = await db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active FROM members").first();
    const charges = await db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending, SUM(CASE WHEN status='paid' THEN amount_cents ELSE 0 END) AS collected_cents, SUM(CASE WHEN status='pending' THEN amount_cents ELSE 0 END) AS open_cents, SUM(CASE WHEN status='pending' AND due_date < ? THEN 1 ELSE 0 END) AS overdue FROM charges").bind(currentDateBR()).first();
    const transactions = await db.prepare("SELECT SUM(CASE WHEN kind='income' THEN amount_cents ELSE 0 END) AS other_income_cents, SUM(CASE WHEN kind='expense' THEN amount_cents ELSE 0 END) AS expenses_cents FROM transactions").first();
    const applications = await db.prepare("SELECT COUNT(*) AS total FROM applications WHERE status='new'").first<{total: number}>();
    const reports = await db.prepare("SELECT COUNT(*) AS total FROM payment_reports WHERE status='pending'").first<{total: number}>();
    return json({ members, charges, transactions, applications: applications?.total || 0, reports: reports?.total || 0, today: currentDateBR() });
  }
  if (is('GET', 'settings')) {
    if (user.role !== 'admin') fail('Acesso restrito à administração', 403);
    return json({ settings: await getSettings(db) });
  }
  if (is('PATCH', 'settings')) {
    if (user.role !== 'admin') fail('Acesso restrito à administração', 403);
    const data = await body(request), changes: Record<string,string> = {};
    for (const key of Object.keys(defaults)) {
      if (!(key in data)) continue;
      if (key === 'monthly_amount_cents') changes[key] = String(cents(data[key]));
      else if (key === 'due_day') {
        const day = Number(data[key]);
        if (!Number.isInteger(day) || day < 1 || day > 28) fail('O dia de vencimento deve ser de 1 a 28');
        changes[key] = String(day);
      } else changes[key] = str(data[key], key === 'pix_key' ? 77 : 160);
    }
    if ('pix_key' in changes && changes.pix_key && changes.pix_key.length < 3) fail('Chave Pix inválida');
    if (!Object.keys(changes).length) fail('Nenhuma configuração informada');
    await db.batch(Object.entries(changes).map(([key,value]) => db.prepare('INSERT INTO settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind(key,value,NOW())));
    await audit(db,user,'update_settings','settings','global',{ keys: Object.keys(changes) }); // Não grava chave Pix no log.
    return json({ settings: await getSettings(db) });
  }
  if (is('GET', 'members')) {
    if (!isManager) fail('Acesso restrito',403);
    const list = (await db.prepare('SELECT m.*, CASE WHEN u.id IS NOT NULL THEN 1 ELSE 0 END AS portal_active FROM members m LEFT JOIN users u ON u.member_id=m.id ORDER BY m.name COLLATE NOCASE LIMIT 1000').all()).results;
    return json({ members: list });
  }
  if (is('POST', 'members')) {
    if (user.role !== 'admin') fail('Acesso restrito à administração',403);
    const data = await body(request), e = email(data.email), name = required(data.name,'o nome',120);
    const status = ['active','pending','inactive'].includes(data.status) ? data.status : 'active';
    const now=NOW(), id=uuid();
    const fee = data.monthly_fee_cents === null || data.monthly_fee_cents === '' || data.monthly_fee_cents === undefined ? null : cents(data.monthly_fee_cents);
    await db.prepare('INSERT INTO members(id,name,email,phone,company,segment,city,notes,status,monthly_fee_cents,joined_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(id,name,e,str(data.phone,40),str(data.company,120),str(data.segment,120),str(data.city,80),str(data.notes,600),status,fee,currentDateBR(),now,now).run();
    await audit(db,user,'create_member','member',id,{email:e});
    return json({ id, success:true },201);
  }
  if (method === 'PATCH' && path[0] === 'members' && path.length===2) {
    if (user.role !== 'admin') fail('Acesso restrito à administração',403);
    const member = await db.prepare('SELECT id FROM members WHERE id=?').bind(path[1]).first();
    if (!member) fail('Membro não encontrado',404);
    const data = await body(request);
    const patches: string[] = [], values: unknown[] = [];
    for (const field of ['name','email','phone','company','segment','city','notes','status','monthly_fee_cents']) {
      if (!(field in data)) continue;
      let value: unknown;
      if (field === 'email') value = email(data.email);
      else if (field === 'name') value = required(data.name,'o nome',120);
      else if (field === 'status') { if (!['active','pending','inactive'].includes(data.status)) fail('Status inválido'); value=data.status; }
      else if (field === 'monthly_fee_cents') value = data[field] === null || data[field] === '' ? null : cents(data[field]);
      else value = str(data[field], field==='notes'?600:120);
      patches.push(`${field}=?`); values.push(value);
    }
    if (!patches.length) fail('Nenhum campo para atualizar');
    patches.push('updated_at=?'); values.push(NOW(),path[1]);
    await db.prepare(`UPDATE members SET ${patches.join(',')} WHERE id=?`).bind(...values).run();
    await audit(db,user,'update_member','member',path[1],{fields:Object.keys(data).filter(k=>k!=='notes')});
    return json({ success:true });
  }
  if (is('POST','invitations')) {
    if (user.role !== 'admin') fail('Acesso restrito à administração',403);
    const data = await body(request), member = await db.prepare('SELECT id,email FROM members WHERE id=?').bind(required(data.member_id,'o membro')).first<{id:string;email:string}>();
    if (!member) fail('Membro não encontrado',404);
    const token = randomToken(), id=uuid(), now=NOW();
    const expires = new Date(Date.now() + 7*24*3600_000).toISOString();
    await db.prepare('INSERT INTO invitations(id,member_id,token_hash,expires_at,created_by,created_at) VALUES(?,?,?,?,?,?)').bind(id,member.id,await sha256(token),expires,user.id,now).run();
    await audit(db,user,'create_invitation','member',member.id);
    return json({ token, expires_at: expires, email: member.email },201);
  }
  if (is('GET', 'applications')) {
    if (!isManager) fail('Acesso restrito',403);
    return json({ applications:(await db.prepare('SELECT * FROM applications ORDER BY created_at DESC LIMIT 500').all()).results });
  }
  if (method==='POST' && path[0]==='applications' && path.length===3 && ['approve','reject'].includes(path[2])) {
    if (user.role !== 'admin') fail('Acesso restrito à administração',403);
    const row = await db.prepare("SELECT * FROM applications WHERE id=? AND status='new'").bind(path[1]).first<any>();
    if (!row) fail('Inscrição não encontrada ou já avaliada',404);
    if (path[2] === 'approve') {
      const already = await db.prepare('SELECT id FROM members WHERE email=?').bind(row.email).first();
      if (already) fail('Já existe um membro com esse e-mail. Atualize o cadastro antes de aprovar.',409);
      const now=NOW(), memberId=uuid();
      await db.batch([
        db.prepare('INSERT INTO members(id,name,email,phone,company,status,joined_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(memberId,row.name,row.email,row.phone,row.company,'pending',currentDateBR(),now,now),
        db.prepare("UPDATE applications SET status='approved',reviewed_by=?,reviewed_at=? WHERE id=? AND status='new'").bind(user.id,now,row.id),
      ]);
      await audit(db,user,'approve_application','application',row.id,{member_id:memberId});
    } else {
      await db.prepare("UPDATE applications SET status='rejected',reviewed_by=?,reviewed_at=? WHERE id=? AND status='new'").bind(user.id,NOW(),row.id).run();
      await audit(db,user,'reject_application','application',row.id);
    }
    return json({ success:true });
  }
  if (is('GET','charges')) {
    const url = new URL(request.url);
    const period = url.searchParams.get('period'), filter = period ? validPeriod(period) : null;
    const query = isManager
      ? (filter ? db.prepare('SELECT c.*,m.name AS member_name,m.company FROM charges c JOIN members m ON m.id=c.member_id WHERE c.period=? ORDER BY m.name LIMIT 2000').bind(filter) : db.prepare('SELECT c.*,m.name AS member_name,m.company FROM charges c JOIN members m ON m.id=c.member_id ORDER BY c.period DESC,m.name LIMIT 2000'))
      : (filter ? db.prepare('SELECT c.*,m.name AS member_name,m.company FROM charges c JOIN members m ON m.id=c.member_id WHERE c.member_id=? AND c.period=? ORDER BY c.period DESC LIMIT 100').bind(user.member_id,filter) : db.prepare('SELECT c.*,m.name AS member_name,m.company FROM charges c JOIN members m ON m.id=c.member_id WHERE c.member_id=? ORDER BY c.period DESC LIMIT 100').bind(user.member_id));
    return json({ charges:(await query.all()).results, today:currentDateBR() });
  }
  if (is('POST','charges','generate')) {
    if (!isManager) fail('Acesso restrito',403);
    const data = await body(request), period=validPeriod(data.period), now=NOW();
    const settings = await getSettings(db), amountDefault=cents(Number(settings.monthly_amount_cents));
    const dueDay = Number(settings.due_day);
    if (!Number.isInteger(dueDay) || dueDay<1 || dueDay>28) fail('Configure o dia de vencimento de 1 a 28');
    const active = (await db.prepare("SELECT id,monthly_fee_cents FROM members WHERE status='active'").all<{id:string;monthly_fee_cents:number|null}>()).results;
    const date = `${period}-${String(dueDay).padStart(2,'0')}`;
    let created=0;
    for (const member of active) {
      const amount = member.monthly_fee_cents ?? amountDefault;
      if (amount <= 0) continue;
      const result = await db.prepare('INSERT OR IGNORE INTO charges(id,member_id,period,due_date,amount_cents,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(uuid(),member.id,period,date,amount,'pending',now,now).run();
      created += Number(result.meta?.changes||0);
    }
    await audit(db,user,'generate_charges','charge',period,{created});
    return json({created, active_members:active.length, period});
  }
  if (method==='GET' && path[0]==='charges' && path.length===3 && path[2]==='pix') {
    const charge = await db.prepare('SELECT c.id,c.member_id,c.amount_cents,c.status,c.period,m.name FROM charges c JOIN members m ON m.id=c.member_id WHERE c.id=?').bind(path[1]).first<any>();
    if (!charge) fail('Cobrança não encontrada',404);
    if (!isManager && charge.member_id!==user.member_id) fail('Acesso negado',403);
    if (charge.status==='canceled') fail('Cobrança cancelada',409);
    const s = await getSettings(db);
    if (!s.pix_key || !s.pix_receiver || !s.pix_city) fail('O Pix do grupo ainda não foi configurado pela tesouraria',409);
    return json({ code:buildPixCode({key:s.pix_key,receiver:s.pix_receiver,city:s.pix_city,amountCents:charge.amount_cents,txid:charge.id.replace(/-/g,'').slice(0,25)}), amount_cents:charge.amount_cents, receiver:s.pix_receiver, period:charge.period, paid:charge.status==='paid' });
  }
  if (method==='POST' && path[0]==='charges' && path.length===3 && path[2]==='mark-paid') {
    if (!isManager) fail('Acesso restrito',403);
    const data=await body(request), charge = await db.prepare('SELECT id,status,member_id FROM charges WHERE id=?').bind(path[1]).first<any>();
    if (!charge) fail('Cobrança não encontrada',404);
    if (charge.status!=='pending') fail('A cobrança já foi quitada ou cancelada',409);
    const methodValue = ['pix','cash','transfer','other'].includes(data.method) ? data.method : 'pix';
    const reference = str(data.reference,160), now = NOW();
    const updated=await db.prepare("UPDATE charges SET status='paid',paid_at=?,paid_by=?,payment_method=?,payment_reference=?,updated_at=? WHERE id=? AND status='pending'")
      .bind(now,user.id,methodValue,reference,now,path[1]).run();
    if (!updated.meta?.changes) fail('A cobrança já foi alterada',409);
    await db.prepare("UPDATE payment_reports SET status='reviewed',reviewed_at=?,reviewed_by=? WHERE charge_id=? AND status='pending'").bind(now,user.id,path[1]).run();
    await audit(db,user,'mark_paid','charge',path[1],{method:methodValue,reference});
    return json({ success:true });
  }
  if (method==='POST' && path[0]==='charges' && path.length===3 && ['reopen','cancel'].includes(path[2])) {
    if (user.role!=='admin') fail('Acesso restrito à administração',403);
    const next = path[2]==='reopen' ? 'pending':'canceled';
    const result=await db.prepare('UPDATE charges SET status=?,paid_at=NULL,paid_by=NULL,payment_method=NULL,payment_reference=NULL,updated_at=? WHERE id=?').bind(next,NOW(),path[1]).run();
    if (!result.meta?.changes) fail('Cobrança não encontrada',404);
    await audit(db,user,path[2]+'_charge','charge',path[1]);
    return json({ success:true });
  }
  if (method==='POST' && path[0]==='charges' && path.length===3 && path[2]==='report') {
    if (user.role!=='member' || !user.member_id) fail('Apenas o associado pode informar seu pagamento',403);
    const charge = await db.prepare("SELECT id,member_id,status FROM charges WHERE id=?").bind(path[1]).first<any>();
    if (!charge || charge.member_id!==user.member_id) fail('Cobrança não encontrada',404);
    if (charge.status!=='pending') fail('Essa cobrança não está em aberto',409);
    const data=await body(request), paidOn=validDate(data.paid_on), now=NOW();
    await db.prepare("INSERT INTO payment_reports(id,charge_id,member_id,reported_paid_on,reference,note,status,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(charge_id) DO UPDATE SET reported_paid_on=excluded.reported_paid_on,reference=excluded.reference,note=excluded.note,status='pending',created_at=excluded.created_at,reviewed_at=NULL,reviewed_by=NULL")
      .bind(uuid(),charge.id,user.member_id,paidOn,str(data.reference,160),str(data.note,500),'pending',now).run();
    await audit(db,user,'report_payment','charge',charge.id);
    return json({ success:true, message:'Aviso enviado. A tesouraria confirmará no extrato bancário.' });
  }
  if (is('GET','payment-reports')) {
    if (!isManager) fail('Acesso restrito',403);
    return json({reports:(await db.prepare('SELECT p.*,m.name AS member_name,c.period,c.amount_cents,c.status AS charge_status FROM payment_reports p JOIN members m ON m.id=p.member_id JOIN charges c ON c.id=p.charge_id ORDER BY p.created_at DESC LIMIT 500').all()).results});
  }
  if (method==='POST' && path[0]==='payment-reports' && path.length===3 && path[2]==='reject') {
    if (!isManager) fail('Acesso restrito',403);
    const result=await db.prepare("UPDATE payment_reports SET status='rejected',reviewed_by=?,reviewed_at=? WHERE id=? AND status='pending'").bind(user.id,NOW(),path[1]).run();
    if (!result.meta?.changes) fail('Aviso não encontrado ou já avaliado',404);
    await audit(db,user,'reject_payment_report','payment_report',path[1]);
    return json({success:true});
  }
  if (is('GET','transactions')) {
    if (!isManager) fail('Acesso restrito',403);
    const list=(await db.prepare('SELECT t.*,u.email AS created_by_email FROM transactions t LEFT JOIN users u ON u.id=t.created_by ORDER BY occurred_on DESC,created_at DESC LIMIT 1000').all()).results;
    return json({transactions:list});
  }
  if (is('POST','transactions')) {
    if (!isManager) fail('Acesso restrito',403);
    const data=await body(request);
    if (!['income','expense'].includes(data.kind)) fail('Tipo de lançamento inválido');
    const id=uuid();
    await db.prepare('INSERT INTO transactions(id,kind,amount_cents,category,description,party,occurred_on,payment_method,reference,created_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
      .bind(id,data.kind,cents(data.amount_cents),required(data.category,'a categoria',80),required(data.description,'a descrição',250),str(data.party,120),validDate(data.occurred_on),str(data.payment_method,40),str(data.reference,160),NOW(),user.id).run();
    await audit(db,user,'create_transaction','transaction',id,{kind:data.kind,amount_cents:data.amount_cents});
    return json({ id, success:true },201);
  }
  if (is('GET','reports','monthly')) {
    if (!isManager) fail('Acesso restrito',403);
    const current = new URL(request.url).searchParams.get('period') || currentDateBR().slice(0,7), p=validPeriod(current);
    const chargeStats=await db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status='paid' THEN amount_cents ELSE 0 END) AS dues_paid_cents,SUM(CASE WHEN status='pending' THEN amount_cents ELSE 0 END) AS dues_pending_cents,SUM(CASE WHEN status='pending' AND due_date<? THEN amount_cents ELSE 0 END) AS dues_overdue_cents FROM charges WHERE period=?").bind(currentDateBR(),p).first<any>();
    const entries=await db.prepare("SELECT kind,SUM(amount_cents) AS amount_cents FROM transactions WHERE substr(occurred_on,1,7)=? GROUP BY kind").bind(p).all<{kind:string;amount_cents:number}>();
    const income=entries.results.find(x=>x.kind==='income')?.amount_cents||0, expense=entries.results.find(x=>x.kind==='expense')?.amount_cents||0;
    return json({period:p,charge_stats:chargeStats,other_income_cents:income,expenses_cents:expense,net_cents:(chargeStats?.dues_paid_cents||0)+income-expense});
  }
  if (is('GET','reports','charges.csv')) {
    if (!isManager) fail('Acesso restrito',403);
    const rows=(await db.prepare('SELECT c.period AS competencia,m.name AS membro,m.email AS email,m.company AS empresa,c.due_date AS vencimento,c.amount_cents AS valor_centavos,c.status AS situacao,c.paid_at AS pago_em,c.payment_reference AS referencia FROM charges c JOIN members m ON m.id=c.member_id ORDER BY c.period DESC,m.name LIMIT 30000').all()).results;
    return csv(rows,[['competencia','Competência'],['membro','Membro'],['email','E-mail'],['empresa','Empresa'],['vencimento','Vencimento'],['valor_centavos','Valor (centavos)'],['situacao','Situação'],['pago_em','Pago em'],['referencia','Referência']]);
  }
  if (is('GET','reports','transactions.csv')) {
    if (!isManager) fail('Acesso restrito',403);
    const rows=(await db.prepare('SELECT occurred_on AS data,kind AS tipo,category AS categoria,description AS descricao,party AS favorecido,amount_cents AS valor_centavos,payment_method AS forma,reference AS referencia FROM transactions ORDER BY occurred_on DESC LIMIT 30000').all()).results;
    return csv(rows,[['data','Data'],['tipo','Tipo'],['categoria','Categoria'],['descricao','Descrição'],['favorecido','Favorecido'],['valor_centavos','Valor (centavos)'],['forma','Forma'],['referencia','Referência']]);
  }
  if (is('GET','audit')) {
    if (user.role!=='admin') fail('Acesso restrito à administração',403);
    return json({logs:(await db.prepare('SELECT a.*,u.email AS actor_email FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 250').all()).results});
  }
  fail('Rota não encontrada',404);
}

export async function onRequest(context: Context): Promise<Response> {
  try {
    return await handle(context);
  } catch (caught) {
    const error = caught as AppError;
    if (error.status) return json({error:error.message},error.status);
    const msg = String(error?.message||'');
    if (/UNIQUE constraint failed/i.test(msg)) return json({error:'Já existe um registro com este e-mail ou competência'},409);
    if (/FOREIGN KEY constraint failed/i.test(msg)) return json({error:'Registro relacionado não encontrado'},409);
    console.error('API error', error);
    return json({error:'Não foi possível concluir a operação. Confira as configurações do sistema.'},500);
  }
}
