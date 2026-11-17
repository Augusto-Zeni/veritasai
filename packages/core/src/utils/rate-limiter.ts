import pLimit, { type LimitFunction } from 'p-limit'
import { LlmQuotaError } from '../errors.ts'
import { realSleep, type Sleep } from './retry.ts'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

export interface RateLimiterOptions {
  /** Requisições por minuto (janela deslizante). */
  rpm: number
  /** Requisições por dia (janela deslizante de 24 h, contada só neste processo). */
  rpd: number
  /** Chamadas simultâneas (padrão 1). */
  concurrency?: number
  now?: () => number
  sleep?: Sleep
}

/**
 * Fila que respeita RPM e RPD. Acima do RPM, espera a janela liberar;
 * acima do RPD, falha com `LlmQuotaError` (não adianta esperar um dia inteiro).
 */
export class RateLimiter {
  private readonly rpm: number
  private readonly rpd: number
  private readonly now: () => number
  private readonly sleep: Sleep
  private readonly limit: LimitFunction
  private readonly minuteWindow: number[] = []
  private readonly dayWindow: number[] = []

  constructor(options: RateLimiterOptions) {
    this.rpm = options.rpm
    this.rpd = options.rpd
    this.now = options.now ?? Date.now
    this.sleep = options.sleep ?? realSleep
    this.limit = pLimit(options.concurrency ?? 1)
  }

  schedule<T>(fn: () => Promise<T>): Promise<T> {
    return this.limit(async () => {
      await this.acquire()
      return fn()
    })
  }

  /** Requisições usadas nas últimas 24 h. */
  get usedToday(): number {
    this.prune(this.now())
    return this.dayWindow.length
  }

  private prune(now: number): void {
    while (this.minuteWindow.length > 0 && now - this.minuteWindow[0]! >= MINUTE)
      this.minuteWindow.shift()
    while (this.dayWindow.length > 0 && now - this.dayWindow[0]! >= DAY) this.dayWindow.shift()
  }

  private async acquire(): Promise<void> {
    for (;;) {
      const now = this.now()
      this.prune(now)
      if (this.dayWindow.length >= this.rpd) {
        throw new LlmQuotaError(`Limite local de ${this.rpd} requisições/dia (LLM_RPD) atingido`)
      }
      if (this.minuteWindow.length < this.rpm) {
        this.minuteWindow.push(now)
        this.dayWindow.push(now)
        return
      }
      await this.sleep(this.minuteWindow[0]! + MINUTE - now)
    }
  }
}
