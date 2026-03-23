# Passo a passo: configurar envio de documentos pelo Autentique

Este guia é para **cada pessoa** da empresa (consultor, admin ou supervisor) que vai enviar documentos para assinatura. O documento será enviado **pela sua conta** no Autentique.

---

## Etapa 1 — Ter login no Autentique (grupo da empresa)

1. A empresa precisa ter uma **conta/organização** no Autentique e um **grupo** com os logins de quem pode enviar documentos.
2. **Você** precisa ter um **login no Autentique** que esteja nesse grupo (e-mail e senha para acessar [painel.autentique.com.br](https://painel.autentique.com.br)).
3. Se ainda não tiver:
   - Peça ao administrador da conta Autentique da empresa para **criar seu usuário** ou **incluir seu e-mail** no grupo de membros que podem criar documentos.
   - Acesse o painel do Autentique e faça login pelo menos uma vez para confirmar que está tudo certo.

**Resumo:** você deve conseguir entrar em [painel.autentique.com.br](https://painel.autentique.com.br) com seu e-mail e senha.

---

## Etapa 2 — Gerar a chave de API no painel do Autentique

1. Acesse o **painel do Autentique**: [https://painel.autentique.com.br](https://painel.autentique.com.br)
2. Faça **login** com seu usuário (e-mail e senha do grupo da empresa).
3. No menu do painel, procure por uma opção como:
   - **Perfil** ou **Meu perfil**, ou  
   - **Integrações** / **API** / **Chaves de API**
4. Na área de **Chaves de API** (ou equivalente):
   - Clique em **Criar nova chave** / **Gerar chave** / **Nova chave de API**.
   - O sistema vai mostrar uma **chave** (uma sequência longa de caracteres).  
   - **Copie essa chave** e guarde em um lugar seguro (você vai colar na ferramenta no próximo passo).  
   - Em muitos painéis a chave **só aparece uma vez**; se não copiar, será preciso gerar outra.
5. Se o painel pedir um **nome** ou **identificação** para a chave, pode usar algo como: `Ferramenta VIABILIDADE` ou `Envio documentos`.

**Resumo:** você deve sair dessa tela com uma **chave de API** copiada (texto longo). Essa chave é **sua** e representa seu login no Autentique.

---

## Etapa 3 — Colar e salvar a chave no Perfil da ferramenta

1. Abra a **ferramenta** (aplicação onde você revisa documentos e envia para assinatura).
2. Faça **login** com um usuário que tenha perfil **consultor**, **admin** ou **supervisor**.  
   **Importante:** a seção “Chave do Autentique” **só aparece** para esses perfis. Se você estiver logado como **franqueado (frank)**, essa seção não será exibida — entre com uma conta de consultor, admin ou supervisor.
3. No menu ou na navegação, clique em **Perfil** (geralmente no canto superior ou no menu de usuário).  
   - A URL costuma ser algo como: `https://sua-ferramenta.com/perfil` ou `https://localhost:3000/perfil`.
4. Na página de Perfil, role até a seção **“Chave do Autentique”**.
5. No campo (tipo senha):
   - **Cole** a chave que você copiou do painel do Autentique (Ctrl+V).
   - Não precisa ver o texto; o campo pode estar mascarado.
6. Clique no botão **“Salvar”**.
7. Aguarde a mensagem de confirmação (ex.: “Chave do Autentique salva.”).
8. Se aparecer erro:
   - Confirme que você está logado como **consultor**, **admin** ou **supervisor** (só esses perfis podem configurar a chave).
   - Confirme que colou a chave **inteira**, sem espaços no início ou no fim.

**Resumo:** a **sua** chave do Autentique fica salva no seu perfil na ferramenta. Da próxima vez que você clicar em “Enviar para assinatura”, o documento será enviado pela **sua** conta no Autentique.

---

## Trocar ou remover a chave depois

- **Trocar:** na mesma tela de Perfil, digite ou cole a **nova** chave no campo e clique em **Salvar**.
- **Remover:** deixe o campo **em branco** e clique em **Salvar**. A ferramenta passará a usar a chave global do servidor (se existir) ou vai avisar que é preciso configurar uma chave.

---

## Opcional — Chave global no servidor (fallback)

Quem **configura o servidor** da aplicação (devops/desenvolvedor) pode manter uma chave **global** para fallback:

1. No servidor onde a aplicação roda, abra o arquivo de variáveis de ambiente (ex.: `.env` ou `.env.production`).
2. Adicione ou edite a linha:
   ```env
   AUTENTIQUE_API_KEY=chave_longa_aqui
   ```
   (substitua `chave_longa_aqui` por uma chave de API gerada no painel do Autentique — em geral uma chave de um usuário “genérico” ou de serviço.)
3. Reinicie a aplicação para carregar a variável.

**Quando é usada:**  
- Se um usuário **não** tiver chave no Perfil, a ferramenta usa essa `AUTENTIQUE_API_KEY`.  
- Se um usuário **tiver** chave no Perfil, a chave **dele** é usada (e a global é ignorada para esse envio).

**Segurança:** não commite o arquivo `.env` no repositório; mantenha a chave apenas no ambiente do servidor.

---

## Resumo rápido

| Etapa | Onde | O que fazer |
|-------|------|-------------|
| 1 | Autentique (empresa) | Ter login no grupo da empresa no Autentique. |
| 2 | Painel Autentique | Gerar chave de API e copiar. |
| 3 | Ferramenta → Perfil | Colar a chave no campo “Chave do Autentique” e salvar. |
| Opcional | Servidor (.env) | Manter `AUTENTIQUE_API_KEY` como fallback. |

Depois disso, ao clicar em **“Enviar para assinatura (Autentique)”** em um documento aprovado, o envio será feito **pelo seu login** no Autentique.
