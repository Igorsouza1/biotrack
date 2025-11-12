# 🧠 Visão Geral da Arquitetura

O **Biotrack MVP** é um sistema de **processamento de imagens assíncrono** projetado para lidar com **grandes volumes de fotos** enviadas para análise de IA.  
A arquitetura separa a interface do usuário (o **“Recepcionista”**) do processamento pesado (o **“Cozinheiro”**), conectados por um **sistema de filas e gatilhos** — o **“Gerente”**.

O design segue o princípio de **simplicidade e custo controlado**, usando serviços **serverless** e **on-demand** (como **Azure Functions** e **Azure Container Instances**) para garantir que **só se paga quando há uso**.

---

## ⚙️ Componentes da Arquitetura

A aplicação é composta por três blocos principais:

---

### 🧾 A. O Recepcionista  
**(Frontend - Next.js: `biotrack-app`)**

**Função:** interface leve e ponto de entrada do usuário.  
**Tecnologia:** Next.js (App Router).  
**Responsabilidade:** upload de imagens, monitoramento de status e exibição dos resultados.

**Arquivos principais:**
- `app/page.tsx` — Gerencia estado da UI (upload, polling, timer) e chama as APIs.  
- `app/api/jobs/create/route.ts` — **Passo 1:** Cria o job com status `"PENDENTE"` na `statustrabalhos` e gera uma **SAS URL** para upload direto ao Blob Storage (`uploads/[jobId]`).  
- `app/api/jobs/start/route.ts` — **Passo 2:** Atualiza status para `"NA_FILA"` e envia a mensagem `{ jobId }` para a fila `trabalhos-pendentes`.  
- `app/api/jobs/[jobId]/status/route.ts` — **Passo 5:** API de polling; retorna status e SAS URL de download do `resultados.json`.  
- `lib/azureClients.ts` — Centraliza a inicialização de `TableClient`, `BlobServiceClient` e `QueueClient`.

---

### 🧩 B. O Gerente  
**(Orquestrador - Azure Function: `biotrack-manager-function`)**

**Função:** conecta o Recepcionista ao Cozinheiro.  
**Tecnologia:** Azure Function (TypeScript v4) com gatilho de fila.  
**Responsabilidade:** escutar a fila `trabalhos-pendentes` e iniciar o contêiner de processamento.

**Arquivo principal:**  
`src/functions/StartJobProcessor.ts`

**Lógica:**
- Usa `DefaultAzureCredential` (Service Principal local / Identidade Gerenciada na nuvem).  
- Executa `aciClient.containerGroups.beginCreateOrUpdate` para iniciar o ACI.  
- Monta o **Azure File Share** `modelcache` em `/root/.cache/torch/hub/checkpoints/` para evitar redownload dos modelos (450 MB+).

---

### 🔥 C. O Cozinheiro  
**(Worker - Azure Container Instance: `meu-processador-ia`)**

**Função:** executar o processamento pesado de IA.  
**Tecnologia:** contêiner Docker (`meu-processador-ia:v4`) executado sob demanda via ACI.  

**Arquivos principais:**  
- `process.py (v4)`  
- `Dockerfile`

**Lógica (process.py):**
1. Lê variáveis de ambiente (`JOB_ID`, `STORAGE_ACCOUNT_NAME`, `STORAGE_ACCOUNT_KEY`).  
2. Conecta-se ao Blob e Table Storage.  
3. Atualiza status para `"PROCESSANDO"`.  
4. Baixa as imagens de `uploads/[jobId]`.  
5. Carrega modelos de IA do cache.  
6. Roda o **MegaDetectorV5** (CPU-only para evitar cotas de GPU).  
7. Salva `resultados.json` em `resultados/[jobId]`.  
8. Atualiza status para `"CONCLUIDO"`.  
9. Contêiner encerra (`restartPolicy: "Never"`) → cobrança finalizada.

---

## 🔄 Fluxo de Dados Completo

1. Usuário acessa `page.tsx`.  
2. **(Passo 1)** `POST /api/jobs/create` → cria job `"PENDENTE"`.  
   - Usuário faz upload do arquivo `.png` para `uploads/[jobId]`.  
3. **(Passo 2)** `POST /api/jobs/start` → status `"NA_FILA"` + mensagem na fila.  
   - `page.tsx` inicia polling e timer.  
4. **(Passo 3)** `StartJobProcessor` (Gerente) é acionado → inicia o contêiner do Cozinheiro.  
5. **(Passo 4)** `process.py` (Cozinheiro) executa:  
   - Atualiza `"PROCESSANDO"`.  
   - Baixa arquivos, roda IA e salva `resultados.json`.  
   - Atualiza `"CONCLUIDO"`.  
   - Encerra contêiner (custo zero após término).  
6. **(Passo 5)** `page.tsx` detecta `"CONCLUIDO"` → gera SAS URL de download → exibe link ao usuário.

---

## 🚀 Próximos Passos (Otimizações do MVP)

### 🖼️ Upload Múltiplo
**Objetivo:** permitir envio de até **100 imagens** em um único job.  
**Ação:**  
- Adicionar `multiple` no `<input type="file">`.  
- Atualizar `handleUpload` para fazer `Promise.all()` com `e.target.files`.


