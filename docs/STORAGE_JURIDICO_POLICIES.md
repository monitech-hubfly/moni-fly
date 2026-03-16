# Políticas de Storage para o bucket juridico-anexos

A migração `010_juridico_storage.sql` cria o bucket e as funções `juridico_can_access_path` e `juridico_can_insert_path`, mas **não** cria políticas na tabela `storage.objects` (no Supabase hospedado só o dono dessa tabela pode criar policies; por isso o erro "must be owner of table objects").

É preciso criar as políticas **pelo Dashboard** do Supabase.

## 1. Garantir o bucket

- Se a migração 010 já rodou: o bucket `juridico-anexos` deve existir em **Storage**.
- Se não existir: **Storage** → **New bucket** → Nome: `juridico-anexos`, **Private**, tamanho máximo por arquivo 50 MB (opcional).

## 2. Criar as políticas no bucket

Em **Storage** → clique no bucket **juridico-anexos** → aba **Policies** → **New policy** (ou "Add policy").

Crie **4 políticas** (uma para cada operação):

### SELECT (leitura)

- **Name:** `Juridico anexos read`
- **Allowed operation:** `SELECT` (ou "Read")
- **Target roles:** `authenticated` (ou "Enable read access for authenticated users")
- **Using expression (Policy definition):**
  ```sql
  bucket_id = 'juridico-anexos' AND public.juridico_can_access_path(name)
  ```

### INSERT (upload)

- **Name:** `Juridico anexos insert`
- **Allowed operation:** `INSERT`
- **Target roles:** `authenticated`
- **With check expression:**
  ```sql
  bucket_id = 'juridico-anexos' AND public.juridico_can_insert_path(name)
  ```

### UPDATE

- **Name:** `Juridico anexos update`
- **Allowed operation:** `UPDATE`
- **Target roles:** `authenticated`
- **Using expression:**
  ```sql
  bucket_id = 'juridico-anexos' AND public.juridico_can_access_path(name)
  ```

### DELETE

- **Name:** `Juridico anexos delete`
- **Allowed operation:** `DELETE`
- **Target roles:** `authenticated`
- **Using expression:**
  ```sql
  bucket_id = 'juridico-anexos' AND (public.get_my_role() IN ('consultor', 'admin') OR public.juridico_can_access_path(name))
  ```

## 3. Se o Dashboard não aceitar funções em políticas

Algumas versões do Supabase permitem só expressões simples nas políticas de Storage. Nesse caso:

1. Deixe **apenas** a política que permite ao **authenticated** acessar o bucket `juridico-anexos` (por exemplo, uma política única de SELECT/INSERT/UPDATE/DELETE com condição `bucket_id = 'juridico-anexos'`), **ou**
2. Use um **Edge Function** ou API que valide `juridico_can_access_path` / `juridico_can_insert_path` antes de chamar o Storage.

A primeira opção é mais simples, mas menos restritiva (qualquer usuário autenticado poderá ler/escrever em qualquer path do bucket). A restrição por ticket fica então na aplicação (só mostramos e permitimos upload nos paths dos tickets do usuário).
