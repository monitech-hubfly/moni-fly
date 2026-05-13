# Políticas do bucket `processo-docs` (PDF Score & Batalha)

Se o SQL da migration não criou as políticas (erro de permissão no `storage.objects`), crie-as **manualmente** no Dashboard do Supabase.

---

## Onde criar

1. Acesse **https://supabase.com/dashboard** e abra seu projeto.
2. Menu lateral: **Storage**.
3. Clique no bucket **processo-docs**.
4. Aba **Policies** (Políticas).
5. Clique em **New Policy** (Nova política).

---

## Política 1 — Upload (INSERT)

- **Policy name:** `Usuários autenticados podem fazer upload`
- **Allowed operation:** **INSERT** (ou "Allow upload")
- **Target roles:** marque **authenticated**
- **WITH CHECK expression:**  
  `bucket_id = 'processo-docs'`

Se a interface pedir só "Policy definition", use o template **"For full customization"** e preencha:

- **WITH CHECK:** `bucket_id = 'processo-docs'`

Salve.

---

## Política 2 — Leitura (SELECT)

- **Policy name:** `Usuários autenticados podem ler`
- **Allowed operation:** **SELECT** (ou "Allow read")
- **Target roles:** **authenticated**
- **USING expression:**  
  `bucket_id = 'processo-docs'`

Salve.

---

## Política 3 — Atualização (UPDATE)

- **Policy name:** `Usuários autenticados podem atualizar`
- **Allowed operation:** **UPDATE**
- **Target roles:** **authenticated**
- **USING expression:**  
  `bucket_id = 'processo-docs'`

Salve.

---

## Política 4 — Exclusão (DELETE)

- **Policy name:** `Usuários autenticados podem deletar`
- **Allowed operation:** **DELETE**
- **Target roles:** **authenticated**
- **USING expression:**  
  `bucket_id = 'processo-docs'`

Salve.

---

## Resumo

| Operação | Nome da política                         | Role        | Expressão                    |
|----------|------------------------------------------|-------------|-----------------------------|
| INSERT   | Usuários autenticados podem fazer upload | authenticated | WITH CHECK: `bucket_id = 'processo-docs'` |
| SELECT   | Usuários autenticados podem ler          | authenticated | USING: `bucket_id = 'processo-docs'`      |
| UPDATE   | Usuários autenticados podem atualizar   | authenticated | USING: `bucket_id = 'processo-docs'`      |
| DELETE   | Usuários autenticados podem deletar     | authenticated | USING: `bucket_id = 'processo-docs'`      |

Ao final, a aba **Policies** do bucket **processo-docs** deve listar essas 4 políticas.
