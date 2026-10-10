# Recuperação de acesso

O APK oferece Mostrar/Ocultar no login e na nova senha, e recuperação por código enviado ao e-mail cadastrado no banco. Não requer acesso ao Gmail via conector.

## Configuração

1. Aplicar `backend/migrations/002-password-recovery.sql` no Neon, primeiro em branch de teste. Registrar o e-mail do usuário na tabela `florindo_auth_private.florindo_recovery_accounts` (fora do schema exposto pela Data API) pela conexão administrativa, sem colocá-lo no HTML nem no repositório.
2. Criar conta Resend com o mesmo e-mail destinatário enquanto usar `onboarding@resend.dev` (restrição do domínio de teste). Produção para outros destinatários requer domínio próprio verificado e troca do remetente.
3. Cadastrar `RESEND_API_KEY` em GitHub → Settings → Secrets and variables → Actions. A chave vai exclusivamente para a Neon Function, nunca para o APK.
4. Executar Build Florindo Sistemas APK novamente e instalar o artefato.

## Garantias e limites

Códigos aleatórios de 6 dígitos, ligados a um identificador aleatório de 256 bits, armazenados apenas como SHA-256; validade de 15 minutos; até 5 tentativas. Até 5 solicitações por usuário/hora e 30 globais/hora, intervalo mínimo de 1 minuto. Ao redefinir, todas as sessões e códigos do usuário são revogados na mesma transação. Mensagem genérica para e-mail desconhecido. Hash da senha preserva o formato legado do login existente; modernização do formato deve incluir migração compatível.

Sem a chave de envio, o botão informa configuração pendente. Testes automatizados não enviam e-mails nem alteram produção. A entrega real deve ser testada depois de configurar a chave.
