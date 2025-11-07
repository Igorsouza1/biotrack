// Arquivo: /app/page.tsx (ou page.js)

"use client"; 

import { useState } from 'react';

type JobInfo = {
  jobId: string;
  uploadContainerUrl: string;
  jobStoragePath: string;
};

export default function Home() {
  const [job, setJob] = useState<JobInfo | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState("Pronto.");
  const [uploadDone, setUploadDone] = useState(false);

  // PASSO 1: Chama a API para criar o trabalho
  const handleCreateJob = async () => {
    setStatusMessage("Criando trabalho na Azure...");
    setJob(null);
    setFile(null);
    setUploadDone(false);

    try {
      const response = await fetch('/api/jobs/create', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Falha ao criar trabalho");

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
    setUploadDone(false);

    try {
      const [baseUrl, sasToken] = job.uploadContainerUrl.split('?');
      const blobPath = `${job.jobStoragePath}/${file.name}`;
      const uploadUrl = `${baseUrl}/${blobPath}?${sasToken}`;
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': file.type },
      });

      if (!uploadResponse.ok) throw new Error("Falha no upload para o Blob Storage.");

      setStatusMessage(`Arquivo ${file.name} enviado! Pronto para iniciar.`);
      setUploadDone(true); // Habilita o Passo 3
      
    } catch (error: any) {
      setStatusMessage(`Erro no upload: ${error.message}`);
    }
  };

  // --- NOVO PASSO 3 ---
  // Envia o trabalho para a fila
  const handleStartJob = async () => {
    if (!job) {
      setStatusMessage("Nenhum trabalho ativo.");
      return;
    }
    setStatusMessage(`Enviando job ${job.jobId} para a fila de processamento...`);

    try {
      const response = await fetch('/api/jobs/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.jobId }) // Envia o jobId
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Falha ao enfileirar trabalho");

      setStatusMessage(data.message);
      setJob(null); // Reseta a UI para um novo trabalho

    } catch (error: any) {
      setStatusMessage(`Erro ao iniciar: ${error.message}`);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Biotrack MVP - Teste de Upload</h1>
      
      <button onClick={handleCreateJob}>1. Criar Novo Trabalho</button>
      
      <hr style={{ margin: '20px 0' }} />

      <input 
        type="file" 
        onChange={(e) => {
          setFile(e.target.files ? e.target.files[0] : null);
          setUploadDone(false); // Reseta se trocar o arquivo
        }}
        disabled={!job}
      />
      <button onClick={handleUpload} disabled={!file || !job}>
        2. Fazer Upload do Arquivo
      </button>
      
      <hr style={{ margin: '20px 0' }} />

      {/* --- NOVO BOTÃO --- */}
      <button 
        onClick={handleStartJob} 
        disabled={!uploadDone || !job} // Habilita só após o upload
        style={{ fontWeight: 'bold' }}
      >
        3. Iniciar Processamento (Colocar na Fila)
      </button>

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