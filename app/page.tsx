// Arquivo: /app/page.tsx (Aprimorado com Timer)

"use client"; 

import { useState, useRef } from 'react';

type JobInfo = {
  jobId: string;
  uploadContainerUrl: string;
  jobStoragePath: string;
};

type JobStatus = "PRONTO" | "CRIANDO" | "ENVIANDO" | "PROCESSANDO" | "CONCLUIDO" | "FALHA";

export default function Home() {
  const [job, setJob] = useState<JobInfo | null>(null);
  const [file, setFile] = useState<File | null>(null);
  
  const [statusMessage, setStatusMessage] = useState("Pronto.");
  const [jobStatus, setJobStatus] = useState<JobStatus>("PRONTO");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  
  // --- NOVOS ESTADOS E REFS PARA O TIMER ---
  const [elapsedTime, setElapsedTime] = useState<string | null>(null); // Guarda o tempo "00:30"
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null); 
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null); // Ref para o timer
  const processingStartTimeRef = useRef<number | null>(null); // Ref para o tempo de início
  // ------------------------------------------

  // Função para limpar TODOS os timers
  const clearAllIntervals = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  // PASSO 1: Chama a API para criar o trabalho
  const handleCreateJob = async () => {
    setStatusMessage("Criando trabalho na Azure...");
    setJobStatus("CRIANDO");
    setJob(null);
    setFile(null);
    setDownloadUrl(null);
    setElapsedTime(null); // Reseta o timer
    clearAllIntervals(); // Para qualquer polling ou timer antigo

    try {
      const response = await fetch('/api/jobs/create', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Falha ao criar trabalho");

      setJob(data);
      setStatusMessage(`Trabalho ${data.jobId} criado! Selecione um arquivo.`);
      setJobStatus("PRONTO");
    } catch (error: any) {
      setStatusMessage(`Erro: ${error.message}`);
      setJobStatus("FALHA");
    }
  };

  // PASSO 2: Faz o upload do arquivo
  const handleUpload = async () => {
    if (!file || !job) {
      setStatusMessage("Selecione um trabalho e um arquivo primeiro.");
      return;
    }
    setStatusMessage(`Enviando ${file.name} para o job ${job.jobId}...`);
    setJobStatus("ENVIANDO");

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
      setJobStatus("PRONTO");
      
    } catch (error: any) {
      setStatusMessage(`Erro no upload: ${error.message}`);
      setJobStatus("FALHA");
    }
  };
  
  // PASSO 3: Inicia o job
  const handleStartJob = async () => {
    if (!job) {
      setStatusMessage("Nenhum trabalho ativo.");
      return;
    }
    
    const jobId = job.jobId;
    
    setStatusMessage(`Enviando job ${jobId} para a fila...`);
    setJobStatus("PROCESSANDO"); // Mudamos para "PROCESSANDO" imediatamente
    setJob(null);
    setFile(null);

    try {
      const startResponse = await fetch('/api/jobs/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: jobId })
      });
      
      const startData = await startResponse.json();
      if (!startResponse.ok) throw new Error(startData.message || "Falha ao enfileirar trabalho");

      setStatusMessage(startData.message); 
      startPolling(jobId); // Inicia o polling

    } catch (error: any) {
      setStatusMessage(`Erro ao iniciar: ${error.message}`);
      setJobStatus("FALHA");
    }
  };

  // Função de Polling (Agora com lógica de timer)
  const startPolling = (jobId: string) => {
    
    clearAllIntervals(); // Limpa qualquer timer ou polling anterior

    // Define o polling de STATUS
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const statusResponse = await fetch(`/api/jobs/${jobId}/status`);
        const data = await statusResponse.json();

        if (!statusResponse.ok) {
          throw new Error(data.message || "Falha ao buscar status");
        }

        const currentStatus = data.status.toUpperCase();
        setStatusMessage(`Status do Job: ${currentStatus}`);
        
        // --- LÓGICA DO TIMER ---
        if (currentStatus === "PROCESSANDO" && !timerIntervalRef.current) {
          // O status mudou para PROCESSANDO, inicie o timer!
          setJobStatus("PROCESSANDO");
          processingStartTimeRef.current = Date.now();
          
          timerIntervalRef.current = setInterval(() => {
            const now = Date.now();
            const start = processingStartTimeRef.current || now;
            const diffInSeconds = Math.floor((now - start) / 1000);
            
            // Formata para MM:SS
            const minutes = Math.floor(diffInSeconds / 60).toString().padStart(2, '0');
            const seconds = (diffInSeconds % 60).toString().padStart(2, '0');
            
            setElapsedTime(`${minutes}:${seconds}`);
          }, 1000); // Atualiza o timer a cada segundo
        }
        // --- FIM DA LÓGICA DO TIMER ---

        if (currentStatus === "CONCLUIDO") {
          clearAllIntervals(); // Para o polling e o timer
          setStatusMessage("Trabalho Concluído!");
          setDownloadUrl(data.downloadUrl);
          setJobStatus("CONCLUIDO");
        
        } else if (currentStatus === "FALHA") {
          clearAllIntervals(); // Para o polling e o timer
          setStatusMessage(`Trabalho Falhou. (Verifique os logs do worker)`);
          setElapsedTime(null); // Limpa o timer
          setJobStatus("FALHA");
        }
        
      } catch (error: any) {
        setStatusMessage(`Erro no polling: ${error.message}`);
        clearAllIntervals(); // Para tudo em caso de erro
        setJobStatus("FALHA");
      }
    }, 5000); // Pergunta o status a cada 5 segundos
  };
  
  const isStep1Disabled = jobStatus === "CRIANDO" || jobStatus === "ENVIANDO" || jobStatus === "PROCESSANDO";
  const isStep2Disabled = !file || !job || jobStatus !== "PRONTO";
  // O uploadDone (Passo 2) deve ser concluído antes de iniciar (Passo 3)
  // Assumimos que o usuário faz o upload e o status volta para "PRONTO"
  const isStep3Disabled = !job || jobStatus !== "PRONTO"; 

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Biotrack MVP - Teste de Upload</h1>
      
      <button onClick={handleCreateJob} disabled={isStep1Disabled}>
        1. Criar Novo Trabalho
      </button>
      
      <hr style={{ margin: '20px 0' }} />

      <input 
        type="file" 
        onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
        disabled={!job || isStep1Disabled}
      />
      <button onClick={handleUpload} disabled={isStep2Disabled}>
        2. Fazer Upload do Arquivo
      </button>
      
      <hr style={{ margin: '20px 0' }} />

      <button 
        onClick={handleStartJob} 
        disabled={isStep3Disabled}
        style={{ fontWeight: 'bold' }}
      >
        3. Iniciar Processamento (Colocar na Fila)
      </button>

      <hr style={{ margin: '20px 0' }} />

      <h2>Status:</h2>
      <pre style={{ background: '#f4f4f4', padding: '10px' }}>
        {statusMessage}
        {/* --- MOSTRAR O TIMER AQUI --- */}
        {elapsedTime && (
          <span style={{ fontWeight: 'bold', marginLeft: '10px' }}>
            (Tempo: {elapsedTime})
          </span>
        )}
      </pre>

      {jobStatus === "CONCLUIDO" && downloadUrl && (
        <div style={{ background: '#e0ffe0', padding: '10px', marginTop: '10px' }}>
          <h3>Download Pronto!</h3>
          <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
            Baixar resultados.json
          </a>
        </div>
      )}

      {jobStatus === "FALHA" && (
        <div style={{ background: '#ffe0e0', padding: '10px', marginTop: '10px' }}>
          <h3>Ocorreu um Erro</h3>
          <p>Por favor, verifique a mensagem de status acima e os logs do ACI no portal.</p>
        </div>
      )}
    </div>
  );
}