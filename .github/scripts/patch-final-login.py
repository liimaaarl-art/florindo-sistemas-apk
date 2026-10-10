from pathlib import Path
import sys

p = Path(sys.argv[1] if len(sys.argv) > 1 else 'index.html')
s = p.read_text(encoding='utf-8')

extra_css = r'''
.login-options{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:13px;flex-wrap:wrap}.login-option{display:flex;align-items:center;gap:8px;color:#526875;font-size:11px;font-weight:700;cursor:pointer;user-select:none}.login-option input{width:17px;height:17px;accent-color:#16879a;cursor:pointer}.login-save-help{margin:8px 0 0;color:#8b989f;font-size:9.5px;line-height:1.45}@media(max-width:420px){.login-options{align-items:flex-start;flex-direction:column;gap:10px}}
'''
assert '</style>' in s
s = s.replace('</style>', extra_css + '\n</style>', 1)

old_password = '<div class="login-field"><label for="loginPassword">Senha</label><input id="loginPassword" name="password" type="password" autocomplete="current-password" required></div>'
new_password = '''<div class="login-field"><label for="loginPassword">Senha</label><input id="loginPassword" name="password" type="password" autocomplete="current-password" required></div><div class="login-options"><label class="login-option" for="loginShowPassword"><input id="loginShowPassword" type="checkbox"><span>Mostrar senha</span></label><label class="login-option" for="loginRemember"><input id="loginRemember" name="remember" type="checkbox" checked><span>Salvar senha</span></label></div><p class="login-save-help">Ao salvar, o aplicativo mantém uma sessão protegida neste aparelho. A senha não é armazenada em texto.</p>'''
assert old_password in s, 'Campo de senha não encontrado'
s = s.replace(old_password, new_password, 1)

const_marker = "const LOGIN_USER_KEY='florindo-login-user-v1';"
const_extra = """const LOGIN_USER_KEY='florindo-login-user-v1';
const LOGIN_REMEMBER_KEY='florindo-login-remember-v1';
const LOGIN_SESSION_TOKEN_KEY='florindo-login-session-token-v1';
const FINAL_LOGIN_VERSION_KEY='florindo-final-login-version';
const FINAL_LOGIN_VERSION='final-2026-10-10-v1';"""
assert const_marker in s, 'Constante de login não encontrada'
s = s.replace(const_marker, const_extra, 1)

old_token = "function neonToken(){return localStorage.getItem(NEON_TOKEN_KEY)||''}"
new_token = "function loginRemembered(){return localStorage.getItem(LOGIN_REMEMBER_KEY)!=='0'}\nfunction neonToken(){return sessionStorage.getItem(LOGIN_SESSION_TOKEN_KEY)||localStorage.getItem(NEON_TOKEN_KEY)||''}"
assert old_token in s, 'Leitura do token não encontrada'
s = s.replace(old_token, new_token, 1)

old_helpers = r'''function setNeonToken(value){if(value)localStorage.setItem(NEON_TOKEN_KEY,value);else localStorage.removeItem(NEON_TOKEN_KEY)}
function showLogin(message=''){document.body.classList.add('auth-locked');const error=$('loginError');if(error)error.textContent=message;const saved=localStorage.getItem(LOGIN_USER_KEY)||'';if($('loginUsername')&&!$('loginUsername').value)$('loginUsername').value=saved;setTimeout(()=>$(saved?'loginPassword':'loginUsername')?.focus(),80)}
function hideLogin(){document.body.classList.remove('auth-locked');if($('loginError'))$('loginError').textContent='';if($('loginPassword'))$('loginPassword').value=''}
async function appLogin(username,password){const result=await neonRPC('florindo_login',{p_username:String(username||'').trim(),p_password:String(password||'')});if(!result?.token)throw Error('Não foi possível iniciar a sessão.');localStorage.setItem(LOGIN_USER_KEY,String(username||'').trim());setNeonToken(result.token);await connectNeon(result.token);hideLogin();return true}
async function appLogout(){const token=neonToken();try{if(token)await neonRPC('florindo_logout',{p_token:token})}catch{}setNeonToken('');neonOnline=false;updateSaveStatus();showLogin()}'''
new_helpers = r'''function setRememberLogin(value){localStorage.setItem(LOGIN_REMEMBER_KEY,value?'1':'0')}
function setNeonToken(value,persist=loginRemembered()){sessionStorage.removeItem(LOGIN_SESSION_TOKEN_KEY);localStorage.removeItem(NEON_TOKEN_KEY);if(value){if(persist)localStorage.setItem(NEON_TOKEN_KEY,value);else sessionStorage.setItem(LOGIN_SESSION_TOKEN_KEY,value)}}
function showLogin(message=''){document.body.classList.add('auth-locked');const error=$('loginError');if(error)error.textContent=message;const saved=localStorage.getItem(LOGIN_USER_KEY)||'';if($('loginUsername')&&!$('loginUsername').value)$('loginUsername').value=saved;const remember=$('loginRemember');if(remember)remember.checked=loginRemembered();const show=$('loginShowPassword');if(show)show.checked=false;if($('loginPassword'))$('loginPassword').type='password';setTimeout(()=>$(saved?'loginPassword':'loginUsername')?.focus(),80)}
function hideLogin(){document.body.classList.remove('auth-locked');if($('loginError'))$('loginError').textContent='';if($('loginPassword')){$('loginPassword').value='';$('loginPassword').type='password'}if($('loginShowPassword'))$('loginShowPassword').checked=false}
async function appLogin(username,password,remember){const result=await neonRPC('florindo_login',{p_username:String(username||'').trim(),p_password:String(password||'')});if(!result?.token)throw Error('Não foi possível iniciar a sessão.');localStorage.setItem(LOGIN_USER_KEY,String(username||'').trim());setRememberLogin(!!remember);setNeonToken(result.token,!!remember);await connectNeon(result.token);hideLogin();return true}
async function appLogout(){const token=neonToken();try{if(token)await neonRPC('florindo_logout',{p_token:token})}catch{}setRememberLogin(false);setNeonToken('',false);neonOnline=false;updateSaveStatus();showLogin()}'''
assert old_helpers in s, 'Funções de login base não encontradas'
s = s.replace(old_helpers, new_helpers, 1)

old_listener = r'''$('loginForm').addEventListener('submit',async event=>{event.preventDefault();const button=$('loginButton'),data=new FormData(event.target),username=String(data.get('username')||'').trim(),password=String(data.get('password')||'');if(!username||!password)return;button.disabled=true;button.textContent='Entrando…';$('loginError').textContent='';try{await appLogin(username,password);toast('Acesso liberado. Bem-vindo ao Florindo Sistemas.')}catch(e){setNeonToken('');neonOnline=false;const unauthorized=e.status===401||e.status===403||String(e.message).includes('invalid_credentials')||String(e.message).toLowerCase().includes('unauthorized');showLogin(unauthorized?'Usuário ou senha incorretos.':'Não foi possível entrar. Verifique sua internet e tente novamente.')}finally{button.disabled=false;button.textContent='Entrar'}});'''
new_listener = r'''$('loginForm').addEventListener('submit',async event=>{event.preventDefault();const button=$('loginButton'),data=new FormData(event.target),username=String(data.get('username')||'').trim(),password=String(data.get('password')||''),remember=data.get('remember')==='on';if(!username||!password)return;button.disabled=true;button.textContent='Entrando…';$('loginError').textContent='';try{await appLogin(username,password,remember);toast('Acesso liberado. Bem-vindo ao Florindo Sistemas.')}catch(e){setNeonToken('',false);neonOnline=false;const unauthorized=e.status===401||e.status===403||String(e.message).includes('invalid_credentials')||String(e.message).toLowerCase().includes('unauthorized');showLogin(unauthorized?'Usuário ou senha incorretos.':'Não foi possível entrar. Verifique sua internet e tente novamente.')}finally{button.disabled=false;button.textContent='Entrar'}});
$('loginShowPassword').addEventListener('change',event=>{const input=$('loginPassword');if(input)input.type=event.target.checked?'text':'password'});'''
assert old_listener in s, 'Evento de login não encontrado'
s = s.replace(old_listener, new_listener, 1)

old_start = "async function start(){await initStorage();route=nav.some(x=>x[0]===location.hash.slice(1))?location.hash.slice(1):'overview';render();const logo=document.querySelector('.brand-logo');if(logo&&$('loginLogo'))$('loginLogo').src=logo.src;const token=neonToken();if(token){try{await connectNeon(token);hideLogin()}catch(e){setNeonToken('');neonOnline=false;showLogin('Sua sessão expirou. Entre novamente.')}}else showLogin()}"
new_start = "async function start(){await initStorage();route=nav.some(x=>x[0]===location.hash.slice(1))?location.hash.slice(1):'overview';render();const logo=document.querySelector('.brand-logo');if(logo&&$('loginLogo'))$('loginLogo').src=logo.src;const firstFinalAccess=localStorage.getItem(FINAL_LOGIN_VERSION_KEY)!==FINAL_LOGIN_VERSION;if(firstFinalAccess){localStorage.setItem(FINAL_LOGIN_VERSION_KEY,FINAL_LOGIN_VERSION);sessionStorage.removeItem(LOGIN_SESSION_TOKEN_KEY);localStorage.removeItem(NEON_TOKEN_KEY);showLogin();return}const token=neonToken();if(token){try{await connectNeon(token);hideLogin()}catch(e){setNeonToken('',false);neonOnline=false;showLogin('Sua sessão expirou. Entre novamente.')}}else showLogin()}"
assert old_start in s, 'Inicialização do login não encontrada'
s = s.replace(old_start, new_start, 1)

for marker in [
    'id="loginShowPassword"',
    'id="loginRemember"',
    'FINAL_LOGIN_VERSION',
    'sessionStorage.getItem(LOGIN_SESSION_TOKEN_KEY)',
    "data.get('remember')==='on'",
    "event.target.checked?'text':'password'",
]:
    assert marker in s, marker

p.write_text(s, encoding='utf-8')
print(f'Login final aplicado em {p} ({len(s)} bytes)')
