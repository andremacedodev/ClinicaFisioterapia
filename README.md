# ClinicaFisioterapia

## NFS-e / NFe.io

A tela de Notas Fiscais funciona em modo de preparação mesmo sem emissão fiscal.
Para emitir pela NFe.io, use a Supabase Edge Function
`nfeio-service-invoice` como proxy seguro e informe o endpoint em
`VITE_NFEIO_PROXY_URL`. Não coloque o token da NFe.io diretamente no frontend.

### Testes

1. Crie uma `.env.local` com `NFEIO_API_KEY` e `NFEIO_COMPANY_ID`.
   Use o `Company.Id` da NFe.io, não o `AccountId` que começa com `acc_`.
2. Rode `yarn nfeio:smoke` para validar chave, listar empresas e checar NFS-e
   sem emitir nota.
3. Configure a Inscrição Municipal da empresa na NFe.io com `Environment:
   "Development"` enquanto estiver em homologação.

### Edge Function

Configure a chave da NFe.io nos secrets do Supabase:

```sh
supabase secrets set NFEIO_API_KEY=...
```

Cada clínica emite no próprio CNPJ. Informe o `Company.Id` da NFe.io de cada
clínica na coluna `clinics.nfeio_company_id`:

```sql
update public.clinics
set nfeio_company_id = '<Company.Id da NFe.io>'
where id = '<id da clínica>';
```

A função valida o usuário logado, descobre a clínica dele e só baixa PDF ou
reenvia e-mail de notas dessa clínica. `NFEIO_COMPANY_ID` só é usado com
`NFEIO_REQUIRE_AUTH=false`, para testes locais.

Depois publique a função e use a URL gerada no frontend:

```sh
supabase functions deploy nfeio-service-invoice
```

No ambiente do app, configure:

```sh
VITE_NFEIO_PROXY_URL=https://<project-ref>.functions.supabase.co/nfeio-service-invoice
```

## Arquivos (Storage)

Os buckets `patient-files` e `transaction-docs` são privados. O banco guarda o
caminho do arquivo e o app gera um link assinado (válido por 10 minutos) quando
alguém abre ou baixa o documento. Registros antigos com URL pública continuam
funcionando: o caminho é extraído da URL.
