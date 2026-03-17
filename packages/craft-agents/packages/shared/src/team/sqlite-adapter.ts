import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import initSqlJs, {
  type Database as SqlJsDatabase,
  type SqlJsStatic,
} from 'sql.js'

export interface Statement {
  get(...params: unknown[]): Record<string, unknown> | undefined
  all(...params: unknown[]): Record<string, unknown>[]
  run(...params: unknown[]): { changes: number }
}

export interface DatabaseAdapter {
  prepare(sql: string): Statement
  exec(sql: string): void
  pragma(directive: string): void
  close(): void
}

let SQL: SqlJsStatic | null = null

export async function initDatabaseEngine(wasmPath?: string): Promise<void> {
  if (SQL) return

  let resolvedWasmPath = wasmPath
  if (!resolvedWasmPath) {
    try {
      // sql.js is external in esbuild, so require.resolve works at runtime
      const sqlJsPath = require.resolve('sql.js')
      resolvedWasmPath = join(dirname(sqlJsPath), 'sql-wasm.wasm')
    } catch {
      // Fallback: let sql.js handle it
    }
  }

  const locateFile = resolvedWasmPath ? () => resolvedWasmPath! : undefined

  SQL = await initSqlJs({ locateFile })
}

function ensureEngine(): SqlJsStatic {
  if (!SQL) {
    throw new Error(
      'sql.js not initialized. Call initDatabaseEngine() before using the database.',
    )
  }
  return SQL
}

function persist(db: SqlJsDatabase, dbPath: string): void {
  const data = db.export()
  writeFileSync(dbPath, Buffer.from(data))
}

export function createDatabase(dbPath: string): DatabaseAdapter {
  const sqljs = ensureEngine()

  let db: SqlJsDatabase
  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath)
    db = new sqljs.Database(buffer)
  } else {
    db = new sqljs.Database()
  }

  const adapter: DatabaseAdapter = {
    prepare(sql: string): Statement {
      return {
        get(...params: unknown[]): Record<string, unknown> | undefined {
          const stmt = db.prepare(sql)
          try {
            stmt.bind(params.length > 0 ? params : undefined)
            if (stmt.step()) {
              const columns = stmt.getColumnNames()
              const values = stmt.get()
              const row: Record<string, unknown> = {}
              for (let i = 0; i < columns.length; i++) {
                row[columns[i]] = values[i]
              }
              return row
            }
            return undefined
          } finally {
            stmt.free()
          }
        },

        all(...params: unknown[]): Record<string, unknown>[] {
          const stmt = db.prepare(sql)
          try {
            stmt.bind(params.length > 0 ? params : undefined)
            const results: Record<string, unknown>[] = []
            while (stmt.step()) {
              const columns = stmt.getColumnNames()
              const values = stmt.get()
              const row: Record<string, unknown> = {}
              for (let i = 0; i < columns.length; i++) {
                row[columns[i]] = values[i]
              }
              results.push(row)
            }
            return results
          } finally {
            stmt.free()
          }
        },

        run(...params: unknown[]): { changes: number } {
          db.run(sql, params.length > 0 ? params : undefined)
          const changes = db.getRowsModified()
          persist(db, dbPath)
          return { changes }
        },
      }
    },

    exec(sql: string): void {
      db.run(sql)
      persist(db, dbPath)
    },

    pragma(directive: string): void {
      db.run(`PRAGMA ${directive}`)
    },

    close(): void {
      persist(db, dbPath)
      db.close()
    },
  }

  return adapter
}
