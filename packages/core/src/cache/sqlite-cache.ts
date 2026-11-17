import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import type { CacheStore } from './cache-store.ts'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS verification_cache (
  url_hash    TEXT NOT NULL,
  config_hash TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (url_hash, config_hash)
);
CREATE TABLE IF NOT EXISTS llm_cache (
  prompt_hash   TEXT NOT NULL,
  model         TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  PRIMARY KEY (prompt_hash, model)
);
`

interface JsonRow {
  json: string
}

/**
 * Cache em SQLite local. A tabela `llm_cache` guarda respostas do LLM
 * (`model` = nome do modelo) e também de busca e extração (`model` = `serper`, `jina`...).
 */
export class SqliteCacheStore implements CacheStore {
  private readonly db: Database.Database
  private readonly now: () => Date

  /** `path` = ':memory:' para testes. */
  constructor(path: string, now: () => Date = () => new Date()) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.db = new Database(path)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(SCHEMA)
    this.now = now
  }

  async getVerification(urlHash: string, configHash: string): Promise<unknown> {
    const row = this.db
      .prepare<[string, string], JsonRow>(
        'SELECT result_json AS json FROM verification_cache WHERE url_hash = ? AND config_hash = ?',
      )
      .get(urlHash, configHash)
    return row ? JSON.parse(row.json) : undefined
  }

  async setVerification(urlHash: string, configHash: string, result: unknown): Promise<void> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO verification_cache (url_hash, config_hash, result_json, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(urlHash, configHash, JSON.stringify(result), this.now().toISOString())
  }

  async getResponse(namespace: string, key: string): Promise<unknown> {
    const row = this.db
      .prepare<[string, string], JsonRow>(
        'SELECT response_json AS json FROM llm_cache WHERE prompt_hash = ? AND model = ?',
      )
      .get(key, namespace)
    return row ? JSON.parse(row.json) : undefined
  }

  async setResponse(namespace: string, key: string, value: unknown): Promise<void> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO llm_cache (prompt_hash, model, response_json, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(key, namespace, JSON.stringify(value), this.now().toISOString())
  }

  async close(): Promise<void> {
    this.db.close()
  }
}
