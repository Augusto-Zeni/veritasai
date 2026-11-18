/**
 * Acompanha uma verificação pelo SSE. O EventSource reconecta sozinho (com
 * Last-Event-ID) se a conexão cair; ao chegar `result` ou `error` a conexão é fechada
 * para o navegador não reconectar à toa.
 */
import { useEffect, useReducer } from 'react'
import { ApiError, getVerification, JOB_EVENT_TYPES, streamUrl, type JobEvent } from '@/lib/api.ts'
import {
  initialVerificationState,
  verificationReducer,
  type VerificationState,
} from '@/lib/verification-state.ts'

export function useVerification(id: string): VerificationState {
  const [state, dispatch] = useReducer(verificationReducer, initialVerificationState)

  useEffect(() => {
    let closed = false
    const source = new EventSource(streamUrl(id))

    const close = () => {
      closed = true
      source.close()
    }

    const onMessage = (e: MessageEvent<string>) => {
      let event: JobEvent
      try {
        event = JSON.parse(e.data) as JobEvent
      } catch {
        return
      }
      dispatch({ type: 'event', id: Number(e.lastEventId) || 0, event })
      if (event.type === 'result' || event.type === 'error') close()
    }
    for (const type of JOB_EVENT_TYPES) source.addEventListener(type, onMessage)

    source.onopen = () => dispatch({ type: 'connection', status: 'open' })
    source.onerror = () => {
      if (closed) return
      if (source.readyState === EventSource.CONNECTING) {
        dispatch({ type: 'connection', status: 'reconnecting' })
        return
      }
      // Fechou de vez (ex.: 404 porque expirou): consulta o estado por HTTP.
      close()
      getVerification(id)
        .then((job) => dispatch({ type: 'snapshot', job }))
        .catch((err: unknown) => {
          if (err instanceof ApiError && err.status === 404) dispatch({ type: 'not-found' })
          else
            dispatch({
              type: 'failed',
              error: {
                code: err instanceof ApiError ? err.code : 'NETWORK',
                message:
                  err instanceof ApiError
                    ? err.message
                    : 'Não foi possível acompanhar a verificação.',
              },
            })
        })
    }

    return close
  }, [id])

  return state
}
