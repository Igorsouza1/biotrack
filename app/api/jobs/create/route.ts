// Arquivo: /app/api/jobs/create/route.ts

import { NextResponse } from 'next/server';
import { TableClient, AzureNamedKeyCredential } from "@azure/data-tables";
import { BlobServiceClient, StorageSharedKeyCredential, ContainerSASPermissions } from "@azure/storage-blob";

// Puxa os segredos do arquivo .env.local
const accountName = process.env.STORAGE_ACCOUNT_NAME;
const accountKey = process.env.STORAGE_ACCOUNT_KEY;

// Verifica se as variáveis de ambiente estão carregadas
if (!accountName || !accountKey) {
  throw new Error("Variáveis de ambiente STORAGE_ACCOUNT_NAME ou STORAGE_ACCOUNT_KEY não configuradas.");
}

// Configura os "clientes" da Azure
const credential = new StorageSharedKeyCredential(accountName, accountKey);

const tableClient = new TableClient(
  `https://${accountName}.table.core.windows.net`, // Nome dinâmico
  "statustrabalhos",
  new AzureNamedKeyCredential(accountName, accountKey)
);

const blobServiceClient = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`, // Nome dinâmico
  credential
);

// --- ESTA É A MUDANÇA PRINCIPAL ---
// Exportamos uma função 'POST' em vez de um 'handler' padrão
export async function POST(request: Request) {
  
  // No App Router, o 'POST' já garante que o método é POST.
  // Não precisamos mais do 'if (req.method !== 'POST')'

  try {
    // 1. Gerar um ID de trabalho único
    const jobId = `job-${Date.now()}`;
    
    // 2. Salvar o status inicial no Azure Table Storage
    const jobStatus = {
      partitionKey: "jobs", // Agrupa todos os trabalhos
      rowKey: jobId,
      status: "PENDENTE",
      criadoEm: new Date().toISOString(),
    };
    await tableClient.createEntity(jobStatus);

    // 3. Gerar uma URL de Upload Segura (SAS) para o usuário
    const containerClient = blobServiceClient.getContainerClient("uploads");
    
    const containerSASPermissions = new ContainerSASPermissions();
    containerSASPermissions.create = true;
    containerSASPermissions.write = true;
    
    const sasUrl = await containerClient.generateSasUrl({
      permissions: containerSASPermissions,
      expiresOn: new Date(new Date().valueOf() + 3600 * 1000), // Expira em 1 hora
    });

    // 4. Responder ao usuário (usando NextResponse)
    return NextResponse.json({ 
      message: "Trabalho criado com sucesso!",
      jobId: jobId,
      uploadContainerUrl: sasUrl,
      jobStoragePath: `uploads/${jobId}`
    }, { status: 201 }); // Status 201 = Created

  } catch (error) {
    console.error(error);
    
    // Responder com erro (usando NextResponse)
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json(
      { message: "Erro ao criar trabalho", error: errorMessage }, 
      { status: 500 }
    );
  }
}