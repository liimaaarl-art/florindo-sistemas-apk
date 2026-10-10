from pathlib import Path
import sys,re
p=Path(sys.argv[1] if len(sys.argv)>1 else 'index.html')
s=p.read_text(encoding='utf-8')
s=s.replace('<body class="auth-locked">','<body>',1)
s=s.replace('</head>',"<script>globalThis.FLORINDO_PROTOTYPE_TOKEN='';</script>\n</head>",1)
s,n=re.subn(r"function showLogin\(message=''\)\{.*?\nfunction hideLogin","function showLogin(message=''){document.body.classList.remove('auth-locked')}\nfunction hideLogin",s,count=1,flags=re.S)
assert n==1
old="const token=neonToken();if(token){try{await connectNeon(token);hideLogin()}catch(e){setNeonToken('');neonOnline=false;showLogin('Sua sessão expirou. Entre novamente.')}}else showLogin()"
assert old in s
s=s.replace(old,"const token=globalThis.FLORINDO_PROTOTYPE_TOKEN||neonToken()||'';if(token){setNeonToken(token);try{await connectNeon(token);hideLogin()}catch(e){neonOnline=false;hideLogin();toast('Aplicativo aberto. Sem conexão com o Neon no momento.')}}else hideLogin()",1)
s=re.sub(r"\$\{action\('logout','Sair desta conta'.*?\)\}",'',s,count=1)
s=s.replace('Florindo Sistemas · acesso protegido','Florindo Sistemas · versão de testes')
s=s.replace("'Sessão desconectada'","'Versão de testes · acesso direto'")
assert '<body class="auth-locked">' not in s
assert "const token=globalThis.FLORINDO_PROTOTYPE_TOKEN||neonToken()" in s
s=s.replace("async function start(){await initStorage();","async function start(){await new Promise(resolve=>setTimeout(resolve,0));await initStorage();",1)
s=s.replace('</body>',Path('backend/prototype.html').read_text(encoding='utf-8')+'\n</body>',1)
p.write_text(s,encoding='utf-8')
print('Versão de testes com acesso direto aplicada.')
