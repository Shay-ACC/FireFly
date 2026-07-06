import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

/**
 * 记忆存储模块 —— SQLite 持久化 + 向量检索
 *
 * 表结构：
 *   memories(
 *     id          INTEGER PRIMARY KEY,
 *     content     TEXT,         -- 记忆内容（如「开拓者喜欢甜食」）
 *     embedding   TEXT,         -- 向量，JSON 字符串
 *     created_at  INTEGER       -- 创建时间戳
 *   )
 *
 * 向量检索：余弦相似度（cosine similarity）找 Top-K 最相关记忆。
 */

let db: Database.Database | null = null

/** 初始化数据库（应用启动时调用一次） */
export function initMemoryStore(): void {
  if (db) return
  const userDataDir = app.getPath('userData')
  const dbPath = join(userDataDir, 'firefly-memory.db')
  console.log('[Memory] 数据库路径:', dbPath)

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      content     TEXT NOT NULL,
      embedding   TEXT NOT NULL,
      created_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC);
  `)
}

/** 一条记忆记录 */
export interface MemoryRecord {
  id: number
  content: string
  embedding: number[]
  createdAt: number
}

/** 存入一条记忆 */
export function saveMemory(content: string, embedding: number[]): number {
  if (!db) throw new Error('记忆库未初始化')
  const stmt = db.prepare(
    'INSERT INTO memories (content, embedding, created_at) VALUES (?, ?, ?)'
  )
  const result = stmt.run(content, JSON.stringify(embedding), Date.now())
  console.log('[Memory] 已保存记忆 #' + result.lastInsertRowid + ':', content.slice(0, 40))
  return Number(result.lastInsertRowid)
}

/** 获取所有记忆（按时间倒序，调试用） */
export function getAllMemories(): MemoryRecord[] {
  if (!db) return []
  const rows = db.prepare('SELECT * FROM memories ORDER BY created_at DESC').all() as any[]
  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    embedding: JSON.parse(r.embedding),
    createdAt: r.created_at
  }))
}

/**
 * 语义检索：找出与查询向量最相似的 Top-K 记忆。
 * 使用余弦相似度（cosine similarity）。
 */
export function searchMemories(queryEmbedding: number[], topK = 5): MemoryRecord[] {
  if (!db) return []
  const rows = db.prepare('SELECT * FROM memories ORDER BY created_at DESC').all() as any[]
  if (rows.length === 0) return []

  const scored = rows.map((r) => {
    const emb: number[] = JSON.parse(r.embedding)
    const sim = cosineSimilarity(queryEmbedding, emb)
    return {
      record: {
        id: r.id,
        content: r.content,
        embedding: emb,
        createdAt: r.created_at
      } as MemoryRecord,
      score: sim
    }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topK).map((s) => s.record)
}

/** 删除指定记忆 */
export function deleteMemory(id: number): void {
  if (!db) return
  db.prepare('DELETE FROM memories WHERE id = ?').run(id)
}

/** 清空所有记忆 */
export function clearAllMemories(): void {
  if (!db) return
  db.prepare('DELETE FROM memories').run()
  console.log('[Memory] 已清空所有记忆')
}

/** 记忆总数 */
export function getMemoryCount(): number {
  if (!db) return 0
  const row = db.prepare('SELECT COUNT(*) as count FROM memories').get() as any
  return row?.count ?? 0
}

/**
 * 余弦相似度：衡量两个向量的方向相似程度。
 * 返回 0~1（越接近 1 越相似）。
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  if (denom === 0) return 0
  return dot / denom
}

/** 关闭数据库（应用退出时调用） */
export function closeMemoryStore(): void {
  try {
    db?.close()
  } catch {}
  db = null
}
