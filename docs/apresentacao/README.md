# Apresentação comercial — FisioOne

`FisioOne_Apresentacao.pptx`: apresentação de vendas (13 slides, com roteiro nas anotações do apresentador).

## Prints das telas

Coloque as imagens em `prints/` com estes nomes (PNG ou JPG), sem dados reais de pacientes:

| Arquivo | Tela |
|---|---|
| `dashboard.png` | Dashboard (tela inicial) |
| `agenda.png` | Agenda do dia |
| `pacientes.png` | Cadastro do paciente / pacote |
| `prontuario.png` | Prontuário (evolução ou avaliação) |
| `financeiro.png` | Financeiro (visão geral ou recebimentos) |
| `whatsapp.png` | WhatsApp (lista de pacientes) |
| `atestados.png` | Atestados (formulário e prévia) |
| `equipe.png` | Equipe |

Depois gere de novo:

```sh
cd docs/apresentacao
npm install --no-save pptxgenjs react react-dom react-icons sharp
node build.js
```

Espaços sem print aparecem como "Espaço para print".

Os prints desta pasta já estão com dados fictícios (nomes, telefones, e-mails, CREFITO e valores). Nunca suba prints com dados reais de clientes.
