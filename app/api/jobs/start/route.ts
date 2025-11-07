// Arquivo: /app/api/jobs/start/route.ts

import { NextResponse } from 'next/server';
import { QueueServiceClient, StorageSharedKeyCredential } from "@azure/storage-queue";

// Puxa os segredos do arquivo .env.local
const accountName = process.env.STORAGE_ACCOUNT_NAME;
const accountKey = process.env.STORAGE_ACCOUNT_KEY;

// Verifica se as variáveis de ambiente estão carregadas
if (!accountName || !accountKey) {
  throw new Error("Variáveis de ambiente STORAGE_ACCOUNT_NAME ou STORAGE_ACCOUNT_KEY não configuradas.");
}

// Configura o "cliente" da Fila
const credential = new StorageSharedKeyCredential(accountName, accountKey);
const queueServiceClient = new QueueServiceClient(
  `https://${accountName}.queue.core.windows.net`,
  credential
);

const queueClient = queueServiceClient.getQueueClient("trabalhos-pendentes");

// Exporta a função POST
export async function POST(request: Request) {
  try {
    // Pega o jobId do corpo da requisição
    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json({ message: "jobId é obrigatório" }, { status: 400 });
    }

    // 1. Cria a mensagem (o que o worker precisa saber)
    // Usamos Base64 para garantir que a mensagem é uma string segura
    const message = Buffer.from(JSON.stringify({ jobId: jobId })).toString('base64');
    
    // 2. Envia a mensagem para a fila "trabalhos-pendentes"
    await queueClient.sendMessage(message);

    // 3. Responde ao usuário
    return NextResponse.json({ 
      message: `Trabalho ${jobId} enviado para a fila com sucesso!`
    }, { status: 202 }); // 202 = Accepted (Aceito)

  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json(
      { message: "Erro ao enfileirar trabalho", error: errorMessage }, 
      { status: 500 }
    );
  }
}