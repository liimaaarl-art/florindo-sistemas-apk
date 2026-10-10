from pathlib import Path
import re,sys
p=Path(sys.argv[1] if len(sys.argv)>1 else 'index.html')
s=p.read_text(encoding='utf-8')
assert 'id="loginPassword"' in s
css='''
.password-wrap{position:relative}.password-wrap input{padding-right:94px!important}.password-toggle{position:absolute;right:6px;top:6px;height:36px;min-width:78px;border:0;border-radius:9px;background:#edf3f8;color:#083859;font:700 12px system-ui;cursor:pointer}.password-toggle:focus-visible,.forgot-password:focus-visible{outline:3px solid #d7ac49;outline-offset:2px}.forgot-password{display:block;margin:15px auto 0;padding:9px;border:0;background:transparent;color:#0b567b;font-weight:700;cursor:pointer}.recovery-dialog{width:min(430px,calc(100% - 28px));max-height:calc(100dvh - 40px);overflow:auto;border:1px solid #dfe7ec;border-radius:24px;padding:26px;background:white;color:#083859}.recovery-dialog::backdrop{background:rgba(5,30,51,.6)}.recovery-dialog h2{margin:0 0 12px;font-size:22px}.recovery-copy{font-size:13px;line-height:1.6;color:#647887}.recovery-dialog [hidden]{display:none!important}.recovery-dialog .password-wrap input,.recovery-dialog .login-field input{font-size:16px}.recovery-secondary{width:100%;margin-top:12px;background:#f1f5f8;border:0;padding:12px;border-radius:10px;color:#083859;font-weight:700}.recovery-dialog .login-error{font-size:12px;line-height:1.5}.login-screen{overflow:auto}.login-shell{margin:auto}
'''
s=s.replace('</style>',css+'\n</style>',1)
match=re.search(r'<input id="loginPassword" name="password" type="password" autocomplete="[^"]+" required>',s)
assert match, 'Campo de senha não encontrado'
needle=match.group(0)
s=s.replace(needle,'<div class="password-wrap">'+needle+'<button class="password-toggle" type="button" data-password-target="loginPassword" aria-controls="loginPassword" aria-pressed="false" aria-label="Mostrar senha">Mostrar</button></div>',1)
needle='<p class="login-error" id="loginError" role="alert"></p>'
assert needle in s
s=s.replace(needle,needle+'<button type="button" class="forgot-password" id="forgotPassword">Esqueci minha senha</button>',1)
fragment=Path('backend/recovery.html').read_text(encoding='utf-8')
assert '</body>' in s
s=s.replace('</body>',fragment+'\n</body>',1)
p.write_text(s,encoding='utf-8')
print('Mostrar/Ocultar senha e recuperação de acesso aplicados.')
