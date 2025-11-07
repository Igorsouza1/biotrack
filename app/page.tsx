// Arquivo: /app/page.tsx (ou page.js)

"use client"; // Necessário para usar hooks como o useState

import { useState } from 'react';

// Estado para guardar as informações do trabalho e o arquivo
type JobInfo = {
  jobId: string;
  uploadContainerUrl: string;
  jobStoragePath: string;
};

export default function Home() {
  const [job, setJob] = useState<JobInfo | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState("Pronto.");

  // PASSO 1: Chama a API que acabamos de criar
  const handleCreateJob = async () => {
    setStatusMessage("Criando trabalho na Azure...");
    try {
      const response = await fetch('/api/jobs/create', { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Falha ao criar trabalho");
      }

      setJob(data);
      setStatusMessage(`Trabalho ${data.jobId} criado! Selecione um arquivo.`);
    } catch (error: any) {
      setStatusMessage(`Erro: ${error.message}`);
    }
  };

  // PASSO 2: Faz o upload do arquivo para o Blob Storage
  const handleUpload = async () => {
    if (!file || !job) {
      setStatusMessage("Selecione um trabalho e um arquivo primeiro.");
      return;
    }

    setStatusMessage(`Enviando ${file.name} para o job ${job.jobId}...`);

    try {
      // 1. "Quebra" a URL SAS que recebemos
      //    BaseURL: https://stbiotrack.blob.core.windows.net/uploads
      //    sasToken: ?sv=2025-11-05&se=...
      const [baseUrl, sasToken] = job.uploadContainerUrl.split('?');

      // 2. Define o caminho completo do novo arquivo na nuvem
      const blobPath = `${job.jobStoragePath}/${file.name}`;
      
      // 3. Monta a URL final para o comando PUT
      const uploadUrl = `${baseUrl}/${blobPath}?${sasToken}`;
      
      // 4. Envia o arquivo!
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file, // O corpo da requisição é o próprio arquivo
        headers: {
          'x-ms-blob-type': 'BlockBlob', // Informa à Azure que é um upload de "bloco"
          'Content-Type': file.type, // Opcional, mas boa prática
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Falha no upload para o Blob Storage.");
      }

      setStatusMessage(`Arquivo ${file.name} enviado com sucesso!`);
      // O próximo passo (que faremos depois) é enfileirar este job
      
    } catch (error: any) {
      setStatusMessage(`Erro no upload: ${error.message}`);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Biotrack MVP - Teste de Upload</h1>
      
      <button onClick={handleCreateJob}>1. Criar Novo Trabalho</button>
      
      <hr style={{ margin: '20px 0' }} />

      <input 
        type="file" 
        onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
        disabled={!job} // Habilita somente após criar o trabalho
      />
      <button onClick={handleUpload} disabled={!file}>2. Fazer Upload do Arquivo</button>
      
      <hr style={{ margin: '20px 0' }} />

      <h2>Status:</h2>
      <pre style={{ background: '#f4f4f4', padding: '10px' }}>
        {statusMessage}
      </pre>

      {job && (
        <pre style={{ background: '#eee', padding: '10px', fontSize: '12px' }}>
          {JSON.stringify(job, null, 2)}
        </pre>
      )}
    </div>
  );
}