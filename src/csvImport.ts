/** RFC4180-compatible lightweight CSV parser for Excel/Google Sheets exports. */
export function parseCsv(input:string):string[][]{
 const text=input.replace(/^\uFEFF/,'');
 const headerLine=text.split(/\r?\n/,1)[0]||'';
 const comma=(headerLine.match(/,/g)||[]).length,semicolon=(headerLine.match(/;/g)||[]).length;
 const delimiter=semicolon>comma?';':',';
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted;}
  else if(ch===delimiter&&!quoted){row.push(cell.trim());cell='';}
  else if((ch==='\r'||ch==='\n')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());cell='';if(row.some(x=>x.length))rows.push(row);row=[];}
  else cell+=ch;
 }
 if(quoted)throw Error('CSV com aspas não fechadas');
 row.push(cell.trim());if(row.some(x=>x.length))rows.push(row);
 return rows;
}
const normalize=(x:string)=>x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const aliases:Record<string,string[]>={
 name:['nome','nomecompleto','associado','name'], email:['email','e-mail','correioeletronico'],
 phone:['telefone','celular','whatsapp','fone','phone'], company:['empresa','company','negocio'],
 segment:['segmento','ramo','setor'],city:['cidade','city','municipio'],
 status:['status','situacao'], monthly_fee_cents:['mensalidadecentavos','mensalidadeemcentavos','mensalidade','valor','valormensal'],
 notes:['observacoes','observacao','anotacoes','notas']
};
export type ImportedMember={name:string;email:string;phone:string;company:string;segment:string;city:string;status:string;monthly_fee_cents:number|null;notes:string};
function money(value:string,centsColumn:boolean):number|null{
 if(!value.trim())return null;
 if(centsColumn){const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:null}
 const cleaned=value.replace(/R\$/gi,'').replace(/\s/g,'').replace(/[^\d,.]/g,'');
 if(!cleaned)return null;
 const normalized=cleaned.includes(',')?cleaned.replace(/\./g,'').replace(',','.'):cleaned;
 const num=Number(normalized);
 return Number.isFinite(num)&&num>0?Math.round(num*100):null;
}
export function membersFromCsv(input:string):{rows:ImportedMember[];errors:string[]}{
 const parsed=parseCsv(input);if(parsed.length<2)throw Error('A planilha precisa de cabeçalho e pelo menos um associado');
 const headers=parsed[0].map(normalize);
 const indexes:Record<string,number>={};
 for(const [key,variants] of Object.entries(aliases))indexes[key]=headers.findIndex(x=>variants.map(normalize).includes(x));
 if(indexes.name<0||indexes.email<0)throw Error('A planilha deve conter as colunas Nome e E-mail');
 const errors:string[]=[],rows:ImportedMember[]=[];
 for(let i=1;i<parsed.length;i++){
  const cols=parsed[i];const get=(key:string)=>indexes[key]>=0?(cols[indexes[key]]||'').trim():'';
  const name=get('name'),email=get('email').toLowerCase();
  if(!name&&!email)continue;
  if(!name||!/^\S+@\S+\.\S+$/.test(email)){errors.push(`Linha ${i+1}: Nome ou E-mail inválido`);continue}
  const feeHeader=indexes.monthly_fee_cents>=0?headers[indexes.monthly_fee_cents]:'';
  const rawFee=get('monthly_fee_cents'),fee=money(rawFee,feeHeader.includes('centav'));
  if(rawFee&&fee===null){errors.push(`Linha ${i+1}: mensalidade inválida`);continue}
  const statusRaw=normalize(get('status'));
  const status=statusRaw==='inativo'||statusRaw==='inactive'?'inactive':statusRaw==='pendente'||statusRaw==='pending'?'pending':'active';
  rows.push({name,email,phone:get('phone'),company:get('company'),segment:get('segment'),city:get('city'),status,monthly_fee_cents:fee,notes:get('notes')});
 }
 return {rows,errors};
}
