# Sequência — verificação pela API (SSE)

```mermaid
sequenceDiagram
  autonumber
  actor U as Navegador
  participant A as API Fastify
  participant J as JobManager (memória)
  participant P as VerificationPipeline

  U->>A: POST /verify { url }
  A->>A: valida a URL (http/https, sem IP nem rede local)
  A->>J: create(url)
  alt mesma URL já em andamento
    J-->>A: job existente (reused = true)
  else fila cheia
    A-->>U: 503 + Retry-After
  else
    J->>J: enfileira (evento queued)
  end
  A-->>U: 202 { id, streamUrl }

  U->>A: GET /verify/:id/stream (EventSource)
  A-->>U: histórico de eventos já emitidos
  J->>P: run(url, onEvent)
  loop cada etapa / afirmação
    P-->>J: evento (stage, article, claims, claim-done)
    J-->>A: evento com id sequencial
    A-->>U: id / event / data
  end
  P-->>J: VerificationResult (ou erro)
  J-->>A: result (ou error com mensagem pública)
  A-->>U: event: result e fecha o stream

  Note over U,A: Se a conexão cair, o EventSource reconecta com Last-Event-ID<br/>e recebe só os eventos que faltaram.
  Note over J: Jobs terminados expiram após API_JOB_TTL_MS;<br/>o resultado continua no cache SQLite por URL.
```
