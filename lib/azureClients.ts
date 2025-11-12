// Arquivo: /lib/azureClients.ts (Corrigido)

import { TableClient, AzureNamedKeyCredential } from "@azure/data-tables";
import { 
  BlobServiceClient, 
  StorageSharedKeyCredential as BlobSharedKeyCredential // 1. Renomeie a importação do Blob
} from "@azure/storage-blob";
import { 
  QueueServiceClient, 
  StorageSharedKeyCredential as QueueSharedKeyCredential // 2. Importe a credencial da Fila
} from "@azure/storage-queue";

// Puxa os segredos do arquivo .env
const accountName = process.env.STORAGE_ACCOUNT_NAME;
const accountKey = process.env.STORAGE_ACCOUNT_KEY;

if (!accountName || !accountKey) {
  throw new Error("Variáveis de ambiente STORAGE_ACCOUNT_NAME ou STORAGE_ACCOUNT_KEY não configuradas.");
}

// --- Credenciais ---
// 3. Crie credenciais separadas para cada tipo
const blobCredential = new BlobSharedKeyCredential(accountName, accountKey);
const queueCredential = new QueueSharedKeyCredential(accountName, accountKey);
const tableCredential = new AzureNamedKeyCredential(accountName, accountKey);

// --- Clientes Pré-configurados ---

// Cliente do Table Storage
export const tableClient = new TableClient(
  `https://${accountName}.table.core.windows.net`,
  "statustrabalhos",
  tableCredential
);

// Cliente do Blob Service
export const blobServiceClient = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`,
  blobCredential // 4. Use a credencial do Blob
);

// Cliente da Fila
export const queueClient = new QueueServiceClient(
  `https://${accountName}.queue.core.windows.net`,
  queueCredential // 5. Use a credencial da Fila
).getQueueClient("trabalhos-pendentes");