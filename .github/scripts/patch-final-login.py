from pathlib import Path
import re
import sys

p = Path(sys.argv[1] if len(sys.argv) > 1 else 'index.html')
s = p.read_text(encoding='utf-8')

extra_css = r'''
.login-mode-switch{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:18px 0 22px;padding:5px;border-radius:16px;background:#f1f5f7;border:1px solid #dfe7eb}
.login-mode-button{border:0;border-radius:12px;padding:12px 10px;background:transparent;color:#58707c;font-weight:800;font-size:11px;cursor:pointer}
.login-mode-button.active{background:#fff;color:#0b567b;box-shadow:0 4px 12px rgba(26,64,84,.08)}
.login-options{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:13px;flex-wrap:wrap}
.login-option{display:flex;align-items:center;gap:8px;color:#526875;font-size:11px;font-weight:700;cursor:pointer;user-select:none}
.login-option input{width:17px;height:17px;accent-color:#16879a;cursor:pointer}
.login-save-help{margin:8px 0 0;color:#8b989f;font-size:9.5px;line-height:1.45}
.login-confirm[hidden]{display:none!important}
@media(max-width:420px){.login-options{align-items:flex-start;flex-direction:column;gap:10px}.login-mode-button{font-size:10.5px}}
'''
assert '</style>' in s
s = s.replace('</style>', extra_css + '\n</style>', 1)

login_html = '''
<div class="login-screen" id="loginScreen" role="dialog" aria-modal="true" aria-labelledby="loginTitle"><form class="login-shell" id="loginForm" data-mode="register"><div class="login-brand"><img id="loginLogo" alt="Florindo Sistemas"><div><strong>Florindo</strong><span>SISTEMAS</span></div></div><p class="eyebrow" id="loginEyebrow">ACESSO AO SISTEMA</p><h1 id="loginTitle">Escolha como entrar.</h1><p class="login-copy" id="loginCopy">Crie um novo acesso ou entre com um cadastro que já existe.</p><div class="login-mode-switch" aria-label="Tipo de acesso"><button class="login-mode-button active" id="loginModeRegister" type="button">Fazer cadastro</button><button class="login-mode-button" id="loginModeLogin" type="button">Já tenho login</button></div><div class="login-field"><label for="loginUsername">Usuário</label><input id="loginUsername" name="username" type="text" autocomplete="username" required></div><div class="login-field"><label for="loginPassword">Senha</label><input id="loginPassword" name="password" type="password" autocomplete="new-password" required></div><div class="login-field login-confirm" id="loginConfirmWrap"><label for="loginConfirm">Confirmar senha</label><input id="loginConfirm" name="confirm" type="password" autocomplete="new-password" required></div><div class="login-options"><label class="login-option" for="loginShowPassword"><input id="loginShowPassword" type="checkbox"><span>Mostrar senha</span></label><label class="login-option" for="loginRemember"><input id="loginRemember" name="remember" type="checkbox" checked><span>Salvar senha</span></label></div><p class="login-save-help">A senha não fica salva em texto. O aplicativo guarda apenas uma sessão protegida para os próximos acessos.</p><button class="button primary login-submit" id="loginButton" type="submit">Criar cadastro</button><p class="login-error" id="loginError" role="alert"></p><p class="login-foot">Florindo Sistemas · Neon + IA protegidos</p></form></div>
'''
s, count = re.subn(r'<div class="login-screen" id="loginScreen".*?</form></div>\n', login_html, s, count=1, flags=re.S)
assert count == 1, 'Tela de login base não encontrada'

const_marker = "const LOGIN_USER_KEY='florindo-login-user-v1';"
const_extra = '''const LOGIN_USER_KEY='florindo-login-user-v1';
const LOGIN_REMEMBER_KEY='florindo-login-remember-v4';
const LOGIN_SESSION_TOKEN_KEY='florindo-login-session-token-v4';
const LOCAL_AUTH_SALT_KEY='florindo-local-auth-salt-v1';
const LOCAL_AUTH_HASH_KEY='florindo-local-auth-hash-v1';
const LOCAL_AUTH_SESSION_KEY='florindo-local-auth-session-v1';
const FINAL_LOGIN_VERSION='register-or-login-2026-10-10-v4';
const FIRST_ACCESS_REGISTRATION=true;'''
assert const_marker in s, 'Constante de login não encontrada'
s = s.replace(const_marker, const_extra, 1)

old_token = "function neonToken(){return localStorage.getItem(NEON_TOKEN_KEY)||''}"
new_token = "function loginRemembered(){return localStorage.getItem(LOGIN_REMEMBER_KEY)!=='0'}\nfunction hasLocalAccount(){return !!localStorage.getItem(LOGIN_USER_KEY)}\nfunction neonToken(){return sessionStorage.getItem(LOGIN_SESSION_TOKEN_KEY)||localStorage.getItem(NEON_TOKEN_KEY)||''}"
assert old_token in s, 'Leitura do token não encontrada'
s = s.replace(old_token, new_token, 1)

helpers = r'''function setRememberLogin(value){localStorage.setItem(LOGIN_REMEMBER_KEY,value?'1':'0')}
function setNeonToken(value,persist=loginRemembered()){sessionStorage.removeItem(LOGIN_SESSION_TOKEN_KEY);localStorage.removeItem(NEON_TOKEN_KEY);if(value){if(persist)localStorage.setItem(NEON_TOKEN_KEY,value);else sessionStorage.setItem(LOGIN_SESSION_TOKEN_KEY,value)}}
function localSalt(){const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}
async function localPasswordHash(salt,password){const bytes=new TextEncoder().encode(String(salt)+'\0'+String(password)+'\0florindo-sistemas-local-v1');const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')}
async function rememberLocalAccess(username,password){const salt=localSalt(),hash=await localPasswordHash(salt,password);localStorage.setItem(LOGIN_USER_KEY,String(username||'').trim());localStorage.setItem(LOCAL_AUTH_SALT_KEY,salt);localStorage.setItem(LOCAL_AUTH_HASH_KEY,hash)}
function setLoginMode(mode){const register=mode==='register',form=$('loginForm');if(!form)return;form.dataset.mode=register?'register':'login';$('loginEyebrow').textContent=register?'NOVO ACESSO':'ACESSO RESTRITO';$('loginTitle').textContent=register?'Faça seu cadastro.':'Entre na sua conta.';$('loginCopy').textContent=register?'Crie um usuário e uma senha. O cadastro será salvo no Neon e já libera a sincronização e a Assistente IA.':'Use um usuário e senha que já estejam cadastrados no Florindo Sistemas.';$('loginButton').textContent=register?'Criar cadastro':'Entrar';$('loginConfirmWrap').hidden=!register;$('loginConfirm').required=register;$('loginPassword').autocomplete=register?'new-password':'current-password';$('loginModeRegister').classList.toggle('active',register);$('loginModeLogin').classList.toggle('active',!register);if($('loginError'))$('loginError').textContent=''}
function showLogin(message='',mode=''){document.body.classList.add('auth-locked');const chosen=mode||(hasLocalAccount()?'login':'register');setLoginMode(chosen);const error=$('loginError');if(error)error.textContent=message;const saved=localStorage.getItem(LOGIN_USER_KEY)||'';if($('loginUsername')&&!$('loginUsername').value)$('loginUsername').value=saved;if($('loginRemember'))$('loginRemember').checked=loginRemembered();if($('loginShowPassword'))$('loginShowPassword').checked=false;for(const id of ['loginPassword','loginConfirm']){const input=$(id);if(input){input.value='';input.type='password'}}setTimeout(()=>$(saved?'loginPassword':'loginUsername')?.focus(),80)}
function hideLogin(){document.body.classList.remove('auth-locked');if($('loginError'))$('loginError').textContent='';for(const id of ['loginPassword','loginConfirm']){const input=$(id);if(input){input.value='';input.type='password'}}if($('loginShowPassword'))$('loginShowPassword').checked=false}
async function cloudLogin(username,password,remember){const result=await neonRPC('florindo_login',{p_username:String(username||'').trim(),p_password:String(password||'')});if(!result?.token)throw Error('Não foi possível criar a sessão de sincronização.');setRememberLogin(!!remember);setNeonToken(result.token,!!remember);await connectNeon(result.token);await rememberLocalAccess(username,password);sessionStorage.setItem(LOCAL_AUTH_SESSION_KEY,'1');hideLogin();return result}
async function cloudRegister(username,password,confirm,remember){username=String(username||'').trim();password=String(password||'');if(username.length<4)throw Error('Crie um usuário com pelo menos 4 caracteres.');if(password.length<8)throw Error('Crie uma senha com pelo menos 8 caracteres.');if(password!==confirm)throw Error('As senhas não conferem.');let result;try{result=await neonRPC('florindo_register',{p_username:username,p_password:password})}catch(e){if(e.status===409||String(e.message).includes('username_exists'))throw Error('Esse usuário já está cadastrado. Toque em “Já tenho login” para entrar.');if(e.status===400)throw Error('Use letras, números, ponto, traço, underline ou @ no usuário.');throw e}if(!result?.token)throw Error('O cadastro foi criado, mas a sessão não pôde ser iniciada.');setRememberLogin(!!remember);setNeonToken(result.token,!!remember);await connectNeon(result.token);await rememberLocalAccess(username,password);sessionStorage.setItem(LOCAL_AUTH_SESSION_KEY,'1');hideLogin();return result}
async function unlockLocalAccess(){sessionStorage.setItem(LOCAL_AUTH_SESSION_KEY,'1');const token=neonToken();if(!token)throw Error('Entre novamente para ativar Neon e IA.');await connectNeon(token);hideLogin();return true}
async function appLogout(){const token=neonToken();try{if(token)await neonRPC('florindo_logout',{p_token:token})}catch{}sessionStorage.removeItem(LOCAL_AUTH_SESSION_KEY);setRememberLogin(false);setNeonToken('',false);neonOnline=false;updateSaveStatus();showLogin('','login')}'''
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

listener = r'''$('loginModeRegister').addEventListener('click',()=>setLoginMode('register'));
$('loginModeLogin').addEventListener('click',()=>setLoginMode('login'));
$('loginForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.target,button=$('loginButton'),data=new FormData(form),username=String(data.get('username')||'').trim(),password=String(data.get('password')||''),confirm=String(data.get('confirm')||''),remember=data.get('remember')==='on',register=form.dataset.mode==='register';if(!username||!password)return;button.disabled=true;button.textContent=register?'Cadastrando…':'Entrando…';$('loginError').textContent='';try{if(register){await cloudRegister(username,password,confirm,remember);toast('Cadastro criado. Neon e IA conectados.')}else{await cloudLogin(username,password,remember);toast('Login realizado. Neon e IA conectados.')}}catch(e){const msg=e.status===401||e.status===403||String(e.message).includes('invalid_credentials')?'Usuário ou senha incorretos.':(e.message||'Não foi possível concluir.');$('loginError').textContent=msg}finally{button.disabled=false;button.textContent=form.dataset.mode==='register'?'Criar cadastro':'Entrar'}});
$('loginShowPassword').addEventListener('change',event=>{for(const id of ['loginPassword','loginConfirm']){const input=$(id);if(input)input.type=event.target.checked?'text':'password'}});
'''
listener_start = s.index("$('loginForm').addEventListener('submit'")
listener_end = s.index("$('editForm').addEventListener", listener_start)
s = s[:listener_start] + listener + s[listener_end:]

start_old = s.index('async function start(){')
start_end = s.index('start();', start_old)
start_new = r'''async function start(){await initStorage();route=nav.some(x=>x[0]===location.hash.slice(1))?location.hash.slice(1):'overview';render();const logo=document.querySelector('.brand-logo');if(logo&&$('loginLogo'))$('loginLogo').src=logo.src;for(const el of document.querySelectorAll('[data-password-target="loginPassword"],#forgotPassword'))el.style.display='none';const token=neonToken();if(token&&loginRemembered()){try{await unlockLocalAccess();return}catch(e){setNeonToken('',false);neonOnline=false}}showLogin('',hasLocalAccount()?'login':'register')}
'''
s = s[:start_old] + start_new + s[start_end:]

s = s.replace('O acesso ao banco é validado pelo servidor; a senha não é gravada no aplicativo.','Cadastro e login são validados pelo servidor. A senha não é armazenada em texto no aplicativo.',1)

for marker in ['id="loginModeRegister"','id="loginModeLogin"','id="loginShowPassword"','id="loginRemember"','id="loginConfirm"','FINAL_LOGIN_VERSION','florindo_register','florindo_login','cloudRegister','cloudLogin','globalThis.FLORINDO_AI_URL']:
    assert marker in s, marker

p.write_text(s, encoding='utf-8')
print(f'Cadastro + login separados aplicados em {p} ({len(s)} bytes)')
