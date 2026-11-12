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

Depois gere de novo:

```sh
cd docs/apresentacao
npm install --no-save pptxgenjs react react-dom react-icons sharp
node build.js
```

Espaços sem print aparecem como "Espaço para print". O contato do último slide está entre colchetes para preencher.
