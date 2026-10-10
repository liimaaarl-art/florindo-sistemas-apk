from pathlib import Path
import re
import sys

p = Path(sys.argv[1] if len(sys.argv) > 1 else 'index.html')
s = p.read_text(encoding='utf-8')

extra_css = r'''
.login-options{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:13px;flex-wrap:wrap}
.login-option{display:flex;align-items:center;gap:8px;color:#526875;font-size:11px;font-weight:700;cursor:pointer;user-select:none}
.login-option input{width:17px;height:17px;accent-color:#16879a;cursor:pointer}
.login-save-help{margin:8px 0 0;color:#8b989f;font-size:9.5px;line-height:1.45}
.login-reset{display:block;margin:13px auto 0;border:0;background:transparent;color:#0b567b;font-weight:700;cursor:pointer;padding:8px}
.login-reset[hidden]{display:none!important}.login-confirm[hidden]{display:none!important}
@media(max-width:420px){.login-options{align-items:flex-start;flex-direction:column;gap:10px}}
'''
assert '</style>' in s
s = s.replace('</style>', extra_css + '\n</style>', 1)

login_html = '''
<div class="login-screen" id="loginScreen" role="dialog" aria-modal="true" aria-labelledby="loginTitle"><form class="login-shell" id="loginForm" data-mode="register"><div class="login-brand"><img id="loginLogo" alt="Florindo Sistemas"><div><strong>Florindo</strong><span>SISTEMAS</span></div></div><p class="eyebrow" id="loginEyebrow">PRIMEIRO ACESSO</p><h1 id="loginTitle">Crie seu acesso.</h1><p class="login-copy" id="loginCopy">No primeiro acesso, confirme o usuário e a senha do Florindo Sistemas. O aplicativo cria sua proteção neste aparelho e conecta automaticamente Neon e Assistente IA.</p><div class="login-field"><label for="loginUsername">Usuário</label><input id="loginUsername" name="username" type="text" autocomplete="username" required></div><div class="login-field"><label for="loginPassword">Senha</label><input id="loginPassword" name="password" type="password" autocomplete="current-password" required></div><div class="login-field login-confirm" id="loginConfirmWrap"><label for="loginConfirm">Confirmar senha</label><input id="loginConfirm" name="confirm" type="password" autocomplete="new-password"></div><div class="login-options"><label class="login-option" for="loginShowPassword"><input id="loginShowPassword" type="checkbox"><span>Mostrar senha</span></label><label class="login-option" for="loginRemember"><input id="loginRemember" name="remember" type="checkbox" checked><span>Salvar senha</span></label></div><p class="login-save-help">A senha não é armazenada em texto. Ao marcar “Salvar senha”, uma sessão protegida fica salva neste aparelho.</p><button class="button primary login-submit" id="loginButton" type="submit">Criar acesso</button><p class="login-error" id="loginError" role="alert"></p><button class="login-reset" id="loginResetAccess" type="button" hidden>Refazer cadastro neste aparelho</button><p class="login-foot">Florindo Sistemas · Neon + IA protegidos</p></form></div>
'''
s, count = re.subn(r'<div class="login-screen" id="loginScreen".*?</form></div>\n', login_html, s, count=1, flags=re.S)
assert count == 1, 'Tela de login base não encontrada'

const_marker = "const LOGIN_USER_KEY='florindo-login-user-v1';"
const_extra = '''const LOGIN_USER_KEY='florindo-login-user-v1';
const LOGIN_REMEMBER_KEY='florindo-login-remember-v3';
const LOGIN_SESSION_TOKEN_KEY='florindo-login-session-token-v3';
const LOCAL_AUTH_SALT_KEY='florindo-local-auth-salt-v1';
const LOCAL_AUTH_HASH_KEY='florindo-local-auth-hash-v1';
const LOCAL_AUTH_SESSION_KEY='florindo-local-auth-session-v1';
const FINAL_LOGIN_VERSION='first-access-cloud-2026-10-10-v3';
const LEGACY_LOGIN_RPC='florindo_login';
const FIRST_ACCESS_REGISTRATION=true;'''
assert const_marker in s, 'Constante de login não encontrada'
s = s.replace(const_marker, const_extra, 1)

old_token = "function neonToken(){return localStorage.getItem(NEON_TOKEN_KEY)||''}"
new_token = "function loginRemembered(){return localStorage.getItem(LOGIN_REMEMBER_KEY)!=='0'}\nfunction hasLocalAccount(){return !!(localStorage.getItem(LOGIN_USER_KEY)&&localStorage.getItem(LOCAL_AUTH_SALT_KEY)&&localStorage.getItem(LOCAL_AUTH_HASH_KEY))}\nfunction neonToken(){return sessionStorage.getItem(LOGIN_SESSION_TOKEN_KEY)||localStorage.getItem(NEON_TOKEN_KEY)||''}"
assert old_token in s, 'Leitura do token não encontrada'
s = s.replace(old_token, new_token, 1)

helpers = r'''function setRememberLogin(value){localStorage.setItem(LOGIN_REMEMBER_KEY,value?'1':'0')}
function setNeonToken(value,persist=loginRemembered()){sessionStorage.removeItem(LOGIN_SESSION_TOKEN_KEY);localStorage.removeItem(NEON_TOKEN_KEY);if(value){if(persist)localStorage.setItem(NEON_TOKEN_KEY,value);else sessionStorage.setItem(LOGIN_SESSION_TOKEN_KEY,value)}}
function localSalt(){const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}
async function localPasswordHash(salt,password){const bytes=new TextEncoder().encode(String(salt)+'\0'+String(password)+'\0florindo-sistemas-local-v1');const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')}
function setLoginMode(mode){const register=mode==='register',form=$('loginForm');if(!form)return;form.dataset.mode=register?'register':'login';$('loginEyebrow').textContent=register?'PRIMEIRO ACESSO':'ACESSO RESTRITO';$('loginTitle').textContent=register?'Crie seu acesso.':'Bem-vindo.';$('loginCopy').textContent=register?'No primeiro acesso, confirme o usuário e a senha do Florindo Sistemas. Assim o aplicativo conecta automaticamente Neon e Assistente IA.':'Entre com o usuário e a senha cadastrados neste aparelho. A sincronização com Neon e IA será reativada automaticamente.';$('loginButton').textContent=register?'Criar acesso':'Entrar';$('loginConfirmWrap').hidden=!register;$('loginConfirm').required=register;$('loginResetAccess').hidden=register}
function showLogin(message='',mode=''){document.body.classList.add('auth-locked');const error=$('loginError');if(error)error.textContent=message;const register=mode?mode==='register':!hasLocalAccount();setLoginMode(register?'register':'login');const saved=localStorage.getItem(LOGIN_USER_KEY)||'';if($('loginUsername'))$('loginUsername').value=saved;if($('loginRemember'))$('loginRemember').checked=loginRemembered();if($('loginShowPassword'))$('loginShowPassword').checked=false;if($('loginPassword')){$('loginPassword').value='';$('loginPassword').type='password'}if($('loginConfirm')){$('loginConfirm').value='';$('loginConfirm').type='password'}setTimeout(()=>$(saved?'loginPassword':'loginUsername')?.focus(),80)}
function hideLogin(){document.body.classList.remove('auth-locked');if($('loginError'))$('loginError').textContent='';for(const id of ['loginPassword','loginConfirm']){const input=$(id);if(input){input.value='';input.type='password'}}if($('loginShowPassword'))$('loginShowPassword').checked=false}
async function cloudLogin(username,password,remember){const result=await neonRPC('florindo_login',{p_username:String(username||'').trim(),p_password:String(password||'')});if(!result?.token)throw Error('Não foi possível criar a sessão de sincronização.');setRememberLogin(!!remember);setNeonToken(result.token,!!remember);await connectNeon(result.token);return true}
async function unlockLocalAccess(){sessionStorage.setItem(LOCAL_AUTH_SESSION_KEY,'1');const token=neonToken();if(!token)throw Error('Confirme sua senha para ativar Neon e IA.');await connectNeon(token);hideLogin();return true}
async function registerLocalAccess(username,password,confirm,remember){username=String(username||'').trim();if(username.length<4)throw Error('Informe um usuário válido.');if(String(password||'').length<8)throw Error('A senha precisa ter pelo menos 8 caracteres.');if(password!==confirm)throw Error('As senhas não conferem.');try{await cloudLogin(username,password,remember)}catch(e){if(e.status===401||e.status===403||String(e.message).includes('invalid_credentials'))throw Error('Usuário ou senha não foram reconhecidos pelo Neon. Use o acesso do Florindo Sistemas.');throw e}const salt=localSalt(),hash=await localPasswordHash(salt,password);localStorage.setItem(LOGIN_USER_KEY,username);localStorage.setItem(LOCAL_AUTH_SALT_KEY,salt);localStorage.setItem(LOCAL_AUTH_HASH_KEY,hash);sessionStorage.setItem(LOCAL_AUTH_SESSION_KEY,'1');hideLogin();return true}
async function appLogin(username,password,remember){username=String(username||'').trim();if(!hasLocalAccount())throw Error('Nenhum cadastro foi criado neste aparelho.');if(username!==localStorage.getItem(LOGIN_USER_KEY))throw Error('Usuário ou senha incorretos.');const actual=await localPasswordHash(localStorage.getItem(LOCAL_AUTH_SALT_KEY)||'',password);if(actual!==localStorage.getItem(LOCAL_AUTH_HASH_KEY))throw Error('Usuário ou senha incorretos.');setRememberLogin(!!remember);const token=neonToken();if(token){try{await connectNeon(token);sessionStorage.setItem(LOCAL_AUTH_SESSION_KEY,'1');hideLogin();return true}catch(e){setNeonToken('',false)}}try{await cloudLogin(username,password,remember)}catch(e){if(e.status===401||e.status===403||String(e.message).includes('invalid_credentials'))throw Error('Sua senha local confere, mas o Neon recusou o acesso. Use “Refazer cadastro” e confirme o usuário e a senha do Florindo Sistemas.');throw e}sessionStorage.setItem(LOCAL_AUTH_SESSION_KEY,'1');hideLogin();return true}
async function appLogout(){const token=neonToken();try{if(token)await neonRPC('florindo_logout',{p_token:token})}catch{}sessionStorage.removeItem(LOCAL_AUTH_SESSION_KEY);setRememberLogin(false);setNeonToken('',false);neonOnline=false;updateSaveStatus();showLogin('',hasLocalAccount()?'login':'register')}'''
start = s.index('function setNeonToken(value)')
end = s.index('function onlinePayload', start)
s = s[:start] + helpers + '\n' + s[end:]

rpc = r'''async function neonRPC(name,payload){
 const aiBase=String(globalThis.FLORINDO_AI_URL||'').replace(/\/$/,'');
 const url=aiBase?`${aiBase}/rpc/${encodeURIComponent(name)}`:`${NEON_API_BASE}/rpc/${encodeURIComponent(name)}`;
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(45000)});
 const text=await response.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
 if(!response.ok){const error=Error(data?.message||data?.error||`Falha na conexão com o Neon (${response.status}).`);error.status=response.status;throw error}
 return data;
}
'''
rpc_start = s.index('async function neonRPC(name,payload)')
rpc_end = s.index('function remoteCount', rpc_start)
s = s[:rpc_start] + rpc + s[rpc_end:]

listener = r'''$('loginForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.target,button=$('loginButton'),data=new FormData(form),username=String(data.get('username')||'').trim(),password=String(data.get('password')||''),confirm=String(data.get('confirm')||''),remember=data.get('remember')==='on',register=form.dataset.mode==='register';if(!username||!password)return;button.disabled=true;button.textContent=register?'Criando…':'Entrando…';$('loginError').textContent='';try{if(register){await registerLocalAccess(username,password,confirm,remember);toast('Acesso criado e Neon conectado.')}else{await appLogin(username,password,remember);toast('Acesso liberado. Neon e IA conectados.')}}catch(e){$('loginError').textContent=e.message||'Não foi possível concluir.'}finally{button.disabled=false;button.textContent=form.dataset.mode==='register'?'Criar acesso':'Entrar'}});
$('loginShowPassword').addEventListener('change',event=>{for(const id of ['loginPassword','loginConfirm']){const input=$(id);if(input)input.type=event.target.checked?'text':'password'}});
$('loginResetAccess').addEventListener('click',()=>{if(!confirm('Refazer o cadastro de acesso neste aparelho? Seus clientes, contratos e demais dados não serão apagados.'))return;for(const key of [LOGIN_USER_KEY,LOCAL_AUTH_SALT_KEY,LOCAL_AUTH_HASH_KEY,LOGIN_REMEMBER_KEY,NEON_TOKEN_KEY])localStorage.removeItem(key);sessionStorage.removeItem(LOGIN_SESSION_TOKEN_KEY);sessionStorage.removeItem(LOCAL_AUTH_SESSION_KEY);neonOnline=false;showLogin('Confirme novamente o usuário e a senha do Florindo Sistemas.','register')});
'''
listener_start = s.index("$('loginForm').addEventListener('submit'")
listener_end = s.index("$('editForm').addEventListener", listener_start)
s = s[:listener_start] + listener + s[listener_end:]

start_old = s.index('async function start(){')
start_end = s.index('start();', start_old)
start_new = r'''async function start(){await initStorage();route=nav.some(x=>x[0]===location.hash.slice(1))?location.hash.slice(1):'overview';render();const logo=document.querySelector('.brand-logo');if(logo&&$('loginLogo'))$('loginLogo').src=logo.src;for(const el of document.querySelectorAll('[data-password-target="loginPassword"],#forgotPassword'))el.style.display='none';if(!hasLocalAccount()){showLogin('','register');return}const token=neonToken();if(token&&(loginRemembered()||sessionStorage.getItem(LOCAL_AUTH_SESSION_KEY)==='1')){try{await unlockLocalAccess();return}catch(e){setNeonToken('',false);neonOnline=false}}showLogin(token?'':'Confirme sua senha uma vez para ativar a sincronização com Neon e a Assistente IA.','login')}
'''
s = s[:start_old] + start_new + s[start_end:]

s = s.replace('O acesso ao banco é validado pelo servidor; a senha não é gravada no aplicativo.','O acesso local protege este aparelho e a sessão do Neon conecta sincronização e Assistente IA. A senha não é armazenada em texto.',1)

for marker in ['id="loginShowPassword"','id="loginRemember"','id="loginConfirm"','FIRST_ACCESS_REGISTRATION','FINAL_LOGIN_VERSION','florindo_login','registerLocalAccess','localPasswordHash','globalThis.FLORINDO_AI_URL','Acesso criado e Neon conectado']:
    assert marker in s, marker

p.write_text(s, encoding='utf-8')
print(f'Cadastro + sessão Neon/IA aplicados em {p} ({len(s)} bytes)')
