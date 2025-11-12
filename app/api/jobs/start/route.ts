// Arquivo: /app/api/jobs/start/route.ts (Aprimorado)

import { NextResponse } from 'next/server';
// Importa os clientes centralizados da nossa nova lib
import { queueClient, tableClient } from '@/lib/azureClients';

// Exporta a função POST
export async function POST(request: Request) {
  try {
    // 1. Pega o jobId do corpo da requisição
    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json({ message: "jobId é obrigatório" }, { status: 400 });
    }

    // 2. Cria a mensagem (o que o worker precisa saber)
    // Usamos Base64 para garantir que a mensagem é uma string segura
    const message = Buffer.from(JSON.stringify({ jobId: jobId })).toString('base64');
    
    // 3. Envia a mensagem para a fila "trabalhos-pendentes"
    await queueClient.sendMessage(message);

    // 4. (APRIMORAMENTO) Atualiza o status na Tabela para "NA_FILA"
    const jobStatusUpdate = {
      partitionKey: "jobs",
      rowKey: jobId,
      status: "NA_FILA" // <-- A MUDANÇA
    };
    
    // Usamos 'updateEntity' com modo 'Merge' para atualizar o status
    await tableClient.updateEntity(jobStatusUpdate, "Merge");

    // 5. Responde ao usuário
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