from pathlib import Path
import re, sys

path=Path(sys.argv[1] if len(sys.argv)>1 else 'index.html')
text=path.read_text(encoding='utf-8')

if 'CLIENT_INFRASTRUCTURE_VERSION' in text:
    raise SystemExit(0)

helper="""
const CLIENT_INFRASTRUCTURE_VERSION='1.0';
function infraData(raw){
 const empty={hosting:{provider:'',email:'',project:'',url:''},github:{email:'',account:'',repo:'',url:''},database:{provider:'',email:'',project:''},storage:{provider:'',email:'',project:''},ai:{provider:'',email:'',project:''},other:''};
 try{const x=typeof raw==='string'&&raw.trim()?JSON.parse(raw):raw;if(!x||typeof x!=='object')return empty;for(const k of ['hosting','github','database','storage','ai'])empty[k]={...empty[k],...(x[k]&&typeof x[k]==='object'?x[k]:{})};empty.other=String(x.other||'');return empty}catch{return empty}
}
function infraFromForm(form){return JSON.stringify({hosting:{provider:String(form.get('infraHostingProvider')||'').trim(),email:String(form.get('infraHostingEmail')||'').trim(),project:String(form.get('infraHostingProject')||'').trim(),url:String(form.get('infraHostingUrl')||'').trim()},github:{email:String(form.get('infraGithubEmail')||'').trim(),account:String(form.get('infraGithubAccount')||'').trim(),repo:String(form.get('infraGithubRepo')||'').trim(),url:String(form.get('infraGithubUrl')||'').trim()},database:{provider:String(form.get('infraDatabaseProvider')||'').trim(),email:String(form.get('infraDatabaseEmail')||'').trim(),project:String(form.get('infraDatabaseProject')||'').trim()},storage:{provider:String(form.get('infraStorageProvider')||'').trim(),email:String(form.get('infraStorageEmail')||'').trim(),project:String(form.get('infraStorageProject')||'').trim()},ai:{provider:String(form.get('infraAiProvider')||'').trim(),email:String(form.get('infraAiEmail')||'').trim(),project:String(form.get('infraAiProject')||'').trim()},other:String(form.get('infraOther')||'').trim()})}
function infrastructureSection(c){const i=infraData(c.infrastructure),groups=[['Hospedagem / Deploy',i.hosting.provider,i.hosting.email,i.hosting.project,i.hosting.url],['GitHub',i.github.account||'GitHub',i.github.email,i.github.repo,i.github.url],['Banco de dados',i.database.provider,i.database.email,i.database.project,''],['Armazenamento',i.storage.provider,i.storage.email,i.storage.project,''],['IA / APIs',i.ai.provider,i.ai.email,i.ai.project,'']].filter(g=>g.slice(1).some(Boolean));return `<section><h3>Infraestrutura e contas</h3><p class=\"subtext\">Organização das contas usadas neste cliente. Senhas, tokens e chaves privadas não ficam salvos aqui.</p>${groups.length?groups.map(g=>`<div class=\"mini-project\"><div class=\"row\"><h3>${esc(g[0])}</h3>${g[1]?badge(g[1],'blue'):''}</div>${g[2]?`<small><b>Conta / e-mail:</b> ${esc(g[2])}</small><br>`:''}${g[3]?`<small><b>Projeto:</b> ${esc(g[3])}</small>`:''}${g[4]&&validURL(g[4])?`<p class=\"card-note\"><a href=\"${esc(g[4])}\" target=\"_blank\" rel=\"noopener\">Abrir projeto ↗</a></p>`:''}</div>`).join(''):'<p class=\"subtext\">Nenhuma infraestrutura cadastrada ainda.</p>'}${i.other?`<p class=\"card-note\"><b>Outros serviços / observações</b><br>${esc(i.other)}</p>`:''}</section>`}
"""
marker="function clientOptions(required=false)"
if marker not in text: raise SystemExit('Ponto de inserção clientOptions não encontrado')
text=text.replace(marker,helper+'\n'+marker,1)

old="if(kind==='clients')fields=field('Nome do cliente','name',old.name,{required:true,full:true})+field('Empresa','company',old.company)+field('Tipo de empresa / ramo','sector',old.sector,{placeholder:'Ex.: Clínica, comércio, escola, prestador de serviços'})+field('Endereço','address',old.address,{full:true})+field('CPF / CNPJ','document',old.document)+field('E-mail','email',old.email,{type:'email'})+field('Telefone / WhatsApp','phone',old.phone,{type:'tel'})+field('Situação','status',old.status||'Ativo',{options:D.statuses.clients,full:true})+field('Observações gerais','notes',old.notes,{area:true,full:true})+field('Informações adicionais do cliente','additionalInfo',old.additionalInfo,{area:true,full:true})+field('Minhas informações internas','internalNotes',old.internalNotes,{area:true,full:true,placeholder:'Seu contexto comercial, decisões e observações internas.'});"
new="if(kind==='clients'){const infra=infraData(old.infrastructure);fields=field('Nome do cliente','name',old.name,{required:true,full:true})+field('Empresa','company',old.company)+field('Tipo de empresa / ramo','sector',old.sector,{placeholder:'Ex.: Clínica, comércio, escola, prestador de serviços'})+field('Endereço','address',old.address,{full:true})+field('CPF / CNPJ','document',old.document)+field('E-mail','email',old.email,{type:'email'})+field('Telefone / WhatsApp','phone',old.phone,{type:'tel'})+field('Situação','status',old.status||'Ativo',{options:D.statuses.clients,full:true})+field('Observações gerais','notes',old.notes,{area:true,full:true})+field('Informações adicionais do cliente','additionalInfo',old.additionalInfo,{area:true,full:true})+field('Minhas informações internas','internalNotes',old.internalNotes,{area:true,full:true,placeholder:'Seu contexto comercial, decisões e observações internas.'})+`<div class=\"field full\"><h3 style=\"margin:8px 0 0\">Infraestrutura e contas</h3><p class=\"helper\">Registre onde cada serviço está e qual conta/e-mail é usada. Não salve senhas, tokens ou chaves privadas.</p></div>`+field('Hospedagem / servidor','infraHostingProvider',infra.hosting.provider,{placeholder:'Ex.: Vercel, GitHub Pages, VPS'})+field('E-mail da hospedagem','infraHostingEmail',infra.hosting.email,{type:'email'})+field('Projeto na hospedagem','infraHostingProject',infra.hosting.project)+field('Link da hospedagem / projeto','infraHostingUrl',infra.hosting.url,{type:'url'})+field('E-mail do GitHub','infraGithubEmail',infra.github.email,{type:'email'})+field('Conta / usuário GitHub','infraGithubAccount',infra.github.account)+field('Repositório GitHub','infraGithubRepo',infra.github.repo)+field('Link do repositório','infraGithubUrl',infra.github.url,{type:'url'})+field('Banco de dados','infraDatabaseProvider',infra.database.provider,{placeholder:'Ex.: Neon, Supabase'})+field('E-mail do banco','infraDatabaseEmail',infra.database.email,{type:'email'})+field('Projeto / banco','infraDatabaseProject',infra.database.project,{full:true})+field('Armazenamento','infraStorageProvider',infra.storage.provider,{placeholder:'Ex.: Cloudflare R2'})+field('E-mail do armazenamento','infraStorageEmail',infra.storage.email,{type:'email'})+field('Bucket / projeto de armazenamento','infraStorageProject',infra.storage.project,{full:true})+field('IA / API','infraAiProvider',infra.ai.provider,{placeholder:'Ex.: Groq, OpenAI, Gemini'})+field('E-mail da IA / API','infraAiEmail',infra.ai.email,{type:'email'})+field('Projeto / identificação da IA','infraAiProject',infra.ai.project,{full:true})+field('Outros serviços / observações','infraOther',infra.other,{area:true,full:true,placeholder:'Outros provedores, contas, domínios ou observações de infraestrutura.'});}"
if old not in text: raise SystemExit('Formulário de clientes não encontrado')
text=text.replace(old,new,1)

needle="for(const name of fields[kind])obj[name]=String(form.get(name)||'').trim();"
repl=needle+"\n  if(kind==='clients')obj.infrastructure=infraFromForm(form);"
if needle not in text: raise SystemExit('Salvamento de formulário não encontrado')
text=text.replace(needle,repl,1)

old_extra="const extra={clients:['sector','address','additionalInfo','internalNotes'],projects:"
new_extra="const extra={clients:['sector','address','additionalInfo','internalNotes','infrastructure'],projects:"
if old_extra not in text: raise SystemExit('Validação de backup não encontrada')
text=text.replace(old_extra,new_extra,1)

# Insere a seção antes do financeiro na ficha do cliente.
needle="<section><h3>Financeiro do cliente</h3>"
if needle not in text: raise SystemExit('Ficha do cliente não encontrada')
text=text.replace(needle,"${infrastructureSection(c)}"+needle,1)

path.write_text(text,encoding='utf-8')
print('Infraestrutura e contas aplicada com sucesso.')
