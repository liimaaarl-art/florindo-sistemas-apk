import { randomUUID } from 'node:crypto';
export const columns={
 clients:{name:'name',company:'company',sector:'sector',address:'address',document:'document',email:'email',phone:'phone',status:'status',notes:'notes',additionalInfo:'additional_info',internalNotes:'internal_notes'},
 projects:{clientId:'client_id',name:'name',status:'status',due:'due',url:'url',databaseProvider:'database_provider',databaseProject:'database_project',server:'server',configuration:'configuration',internalNotes:'internal_notes',notes:'notes'},
 updates:{clientId:'client_id',projectId:'project_id',title:'title',version:'version',status:'status',date:'date',notes:'notes'},
 contracts:{clientId:'client_id',projectId:'project_id',title:'title',status:'status',value:'value',start:'start_date',end:'end_date',notes:'notes'},
 finances:{clientId:'client_id',projectId:'project_id',title:'title',type:'type',category:'category',value:'value',status:'status',due:'due',paidAt:'paid_at',notes:'notes'}
};
export const statuses={clients:['Ativo','Em negociação','Inativo'],projects:['Planejamento','Em andamento','Entregue','Manutenção','Pausado'],updates:['Planejada','Em andamento','Entregue'],contracts:['Rascunho','Aguardando assinatura','Assinado','Encerrado'],finances:['Pendente','Pago','Cancelado']};
const dateFields=new Set(['due','date','start','end','paidAt']);
function validDate(v){return v===''||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v)}
export function validatePlan(plan,state){
 if(!plan||typeof plan.message!=='string'||plan.message.length>3000||!Array.isArray(plan.actions)||plan.actions.length>12)throw Error('Resposta da IA inválida.');
 const next=structuredClone(state),changes=[];
 for(const a of plan.actions){
  if(!a||!Object.hasOwn(columns,a.entity)||!['create','update'].includes(a.operation)||!a.fields||Array.isArray(a.fields)||typeof a.fields!=='object')throw Error('Operação não permitida.');
  const allowed=columns[a.entity],old=a.operation==='update'?next[a.entity].find(x=>x.id===a.id):null;
  if(a.operation==='update'&&!old)throw Error('Registro não encontrado. Informe o cliente ou sistema exato.');
  if(a.operation==='create'&&a.id)throw Error('A IA não pode definir identificadores de novos registros.');
  const fields={};
  for(const [key,value] of Object.entries(a.fields)){
   if(!Object.hasOwn(allowed,key))throw Error('Campo não permitido: '+key);
   if(key==='value'){if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e12)throw Error('Valor inválido.');fields[key]=Math.round(value*100)/100}
   else {if(typeof value!=='string'||value.length>10000)throw Error('Campo inválido.');fields[key]=value.trim();if(dateFields.has(key)&&!validDate(value))throw Error('Data inválida.')}
   if(old&&['clientId','projectId'].includes(key)&&value!==old[key])throw Error('A IA não pode transferir registros entre clientes ou sistemas.');
  }
  if(!Object.keys(fields).length)throw Error('Nenhuma alteração informada.');
  if('status' in fields&&!statuses[a.entity].includes(fields.status))throw Error('Situação inválida.');
  if('type' in fields&&!['Receita','Despesa'].includes(fields.type))throw Error('Tipo financeiro inválido.');
  if(fields.url){const u=new URL(fields.url);if(!['https:','http:'].includes(u.protocol))throw Error('Link inválido.')}
  const defaults=Object.fromEntries(Object.keys(allowed).map(k=>[k,k==='value'?0:'']));
  defaults.status=statuses[a.entity][0];
  if(a.entity==='finances')defaults.type='Receita';
  const record={...(old||defaults),...fields,id:old?.id||randomUUID()};
  if(!(record.name||record.title||'').trim())throw Error('Informe o nome ou título.');
  if(a.entity!=='clients'&&!next.clients.some(x=>x.id===record.clientId))throw Error('Cliente inválido.');
  if(record.projectId&&!next.projects.some(x=>x.id===record.projectId&&x.clientId===record.clientId))throw Error('Sistema não pertence ao cliente.');
  if(a.entity==='updates'&&(!record.projectId||!record.date))throw Error('Informe o sistema e a data da atualização.');
  if(a.entity==='finances'&&(a.operation==='create'&&!('value' in fields)||record.status==='Pago'&&!record.paidAt))throw Error('Informe o valor e, quando pago, a data do pagamento.');
  if(record.start&&record.end&&record.end<record.start)throw Error('Fim do contrato anterior ao início.');
  if(old)Object.assign(old,record);else next[a.entity].push(record);
  changes.push({entity:a.entity,operation:a.operation,id:record.id,fields,before:old?state[a.entity].find(x=>x.id===record.id)||null:null,record});
 }
 return changes;
}
export function sqlFor(change){
 const entries=Object.entries(change.fields),cols=entries.map(([k])=>columns[change.entity][k]);
 const values=entries.map(([k,v])=>dateFields.has(k)&&v===''||k==='projectId'&&v===''?null:v);
 if(change.operation==='update')return {text:'UPDATE public.'+change.entity+' SET '+cols.map((c,i)=>c+'=$'+(i+1)).join(',')+',updated_at=now() WHERE id=$'+(values.length+1)+' AND deleted_at IS NULL',values:[...values,change.id]};
 return {text:'INSERT INTO public.'+change.entity+' (id,'+cols.join(',')+') VALUES ('+[change.id,...values].map((_,i)=>'$'+(i+1)).join(',')+')',values:[change.id,...values]};
}
