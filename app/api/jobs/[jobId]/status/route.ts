// Arquivo: /app/api/jobs/[jobId]/status/route.ts (Corrigido com 'await params')

import { NextResponse, type NextRequest } from 'next/server';
import { TableClient, AzureNamedKeyCredential } from "@azure/data-tables";
import { 
  BlobServiceClient, 
  StorageSharedKeyCredential, 
  BlobSASPermissions 
} from "@azure/storage-blob";

// --- Configuração dos Clientes Azure ---
const accountName = process.env.STORAGE_ACCOUNT_NAME;
const accountKey = process.env.STORAGE_ACCOUNT_KEY;

if (!accountName || !accountKey) {
  throw new Error("Variáveis de ambiente Azure Storage não configuradas.");
}

const tableClient = new TableClient(
  `https://${accountName}.table.core.windows.net`,
  "statustrabalhos",
  new AzureNamedKeyCredential(accountName, accountKey)
);

const blobServiceClient = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`,
  new StorageSharedKeyCredential(accountName, accountKey)
);

// --- O Handler da API (GET) ---

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } } // O 'async' está aqui (correto)
) {
  
  // --- A CORREÇÃO ESTÁ AQUI ---
  // Nós precisamos "esperar" (await) a Promise 'params' ser resolvida
  const { jobId } = await params;
  // --------------------------

  if (!jobId) {
    return NextResponse.json({ message: "jobId é obrigatório" }, { status: 400 });
  }

  try {
    // 1. Consultar o status na Tabela
    let entity;
    try {
      entity = await tableClient.getEntity("jobs", jobId);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return NextResponse.json({ message: "Trabalho não encontrado" }, { status: 404 });
      }
      throw error; 
    }

    const status = entity.status;

    // 2. Se NÃO estiver concluído, apenas retorne o status
    if (status !== "CONCLUIDO") {
      return NextResponse.json({ 
        status: status,
        jobId: jobId
      });
    }

    // 3. Se ESTIVER CONCLUÍDO, gere uma SAS URL de Download
    const resultBlobName = `${jobId}/resultados.json`;
    
    const containerClient = blobServiceClient.getContainerClient("resultados");
    const blobClient = containerClient.getBlobClient(resultBlobName);
    
    const sasPermissions = new BlobSASPermissions();
    sasPermissions.read = true; 
    
    const sasUrl = await blobClient.generateSasUrl({
      permissions: sasPermissions,
      expiresOn: new Date(new Date().valueOf() + 15 * 60 * 1000), // 15 minutos
    });

    // 4. Retorne o status E a URL de download
    return NextResponse.json({
      status: status,
      jobId: jobId,
      downloadUrl: sasUrl 
    });

  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json(
      { message: "Erro ao consultar status", error: errorMessage }, 
      { status: 500 }
    );
  }
}