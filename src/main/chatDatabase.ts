//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';
import type { ChatMessage, Conversation, ToolCall } from '../shared/chatTypes';

let db: Database.Database | null = null;

/**
 * Initialize the SQLite database
 */
export function initDatabase(): void {
  const dbPath = path.join(app.getPath('userData'), 'chat.db');
  db = new Database(dbPath);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT UNIQUE NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      compacted_summary TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
      content TEXT NOT NULL,
      tool_calls TEXT,
      tool_call_id TEXT,
      timestamp INTEGER NOT NULL,
      is_compacted INTEGER DEFAULT 0,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_file_path ON conversations(file_path);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
  `);
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Get or create a conversation for a file
 */
function getOrCreateConversation(filePath: string): number {
  if (!db) throw new Error('Database not initialized');

  const now = Date.now();

  // Try to get existing conversation
  const existing = db.prepare(
    'SELECT id FROM conversations WHERE file_path = ?'
  ).get(filePath) as { id: number } | undefined;

  if (existing) {
    return existing.id;
  }

  // Create new conversation
  const result = db.prepare(
    'INSERT INTO conversations (file_path, created_at, updated_at) VALUES (?, ?, ?)'
  ).run(filePath, now, now);

  return result.lastInsertRowid as number;
}

/**
 * Get a conversation with all its messages
 */
export function getConversation(filePath: string): Conversation | null {
  if (!db) throw new Error('Database not initialized');

  const conv = db.prepare(
    'SELECT id, file_path, created_at, updated_at, compacted_summary FROM conversations WHERE file_path = ?'
  ).get(filePath) as {
    id: number;
    file_path: string;
    created_at: number;
    updated_at: number;
    compacted_summary: string | null;
  } | undefined;

  if (!conv) {
    return null;
  }

  // Get non-compacted messages
  const messages = db.prepare(
    'SELECT id, role, content, tool_calls, tool_call_id, timestamp, is_compacted FROM messages WHERE conversation_id = ? AND is_compacted = 0 ORDER BY timestamp ASC'
  ).all(conv.id) as Array<{
    id: number;
    role: string;
    content: string;
    tool_calls: string | null;
    tool_call_id: string | null;
    timestamp: number;
    is_compacted: number;
  }>;

  return {
    id: conv.id,
    filePath: conv.file_path,
    createdAt: conv.created_at,
    updatedAt: conv.updated_at,
    compactedSummary: conv.compacted_summary || undefined,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role as ChatMessage['role'],
      content: m.content,
      toolCalls: m.tool_calls ? JSON.parse(m.tool_calls) : undefined,
      toolCallId: m.tool_call_id || undefined,
      timestamp: m.timestamp,
      isCompacted: m.is_compacted === 1,
    })),
  };
}

/**
 * Save a message to a conversation
 */
export function saveMessage(filePath: string, message: ChatMessage): number {
  if (!db) throw new Error('Database not initialized');

  const conversationId = getOrCreateConversation(filePath);
  const now = Date.now();

  // Insert message
  const result = db.prepare(
    'INSERT INTO messages (conversation_id, role, content, tool_calls, tool_call_id, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    conversationId,
    message.role,
    message.content,
    message.toolCalls ? JSON.stringify(message.toolCalls) : null,
    message.toolCallId || null,
    message.timestamp
  );

  // Update conversation timestamp
  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(
    now,
    conversationId
  );

  return result.lastInsertRowid as number;
}

/**
 * Clear all messages in a conversation
 */
export function clearConversation(filePath: string): void {
  if (!db) throw new Error('Database not initialized');

  const conv = db.prepare(
    'SELECT id FROM conversations WHERE file_path = ?'
  ).get(filePath) as { id: number } | undefined;

  if (!conv) return;

  db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(conv.id);
  db.prepare(
    'UPDATE conversations SET compacted_summary = NULL, updated_at = ? WHERE id = ?'
  ).run(Date.now(), conv.id);
}

/**
 * Delete a conversation entirely
 */
export function deleteConversation(filePath: string): void {
  if (!db) throw new Error('Database not initialized');

  db.prepare('DELETE FROM conversations WHERE file_path = ?').run(filePath);
}

/**
 * Compact a conversation by marking older messages as compacted and storing a summary
 */
export function compactConversation(
  filePath: string,
  summary: string,
  keepRecentCount: number = 10
): void {
  if (!db) throw new Error('Database not initialized');

  const conv = db.prepare(
    'SELECT id FROM conversations WHERE file_path = ?'
  ).get(filePath) as { id: number } | undefined;

  if (!conv) return;

  // Get all message IDs ordered by timestamp
  const messages = db.prepare(
    'SELECT id FROM messages WHERE conversation_id = ? AND is_compacted = 0 ORDER BY timestamp ASC'
  ).all(conv.id) as Array<{ id: number }>;

  if (messages.length <= keepRecentCount) {
    return; // Nothing to compact
  }

  // Mark older messages as compacted
  const toCompactCount = messages.length - keepRecentCount;
  const toCompactIds = messages.slice(0, toCompactCount).map((m) => m.id);

  if (toCompactIds.length > 0) {
    const placeholders = toCompactIds.map(() => '?').join(',');
    db.prepare(
      `UPDATE messages SET is_compacted = 1 WHERE id IN (${placeholders})`
    ).run(...toCompactIds);
  }

  // Update conversation with summary
  db.prepare(
    'UPDATE conversations SET compacted_summary = ?, updated_at = ? WHERE id = ?'
  ).run(summary, Date.now(), conv.id);
}

/**
 * Get message count for a conversation
 */
export function getMessageCount(filePath: string): number {
  if (!db) throw new Error('Database not initialized');

  const result = db.prepare(`
    SELECT COUNT(*) as count FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE c.file_path = ? AND m.is_compacted = 0
  `).get(filePath) as { count: number } | undefined;

  return result?.count || 0;
}

/**
 * Check if compaction is needed based on message count
 */
export function needsCompaction(
  filePath: string,
  threshold: number
): boolean {
  return getMessageCount(filePath) > threshold;
}

/**
 * Get all compacted messages for generating a new summary
 */
export function getCompactedMessages(filePath: string): ChatMessage[] {
  if (!db) throw new Error('Database not initialized');

  const conv = db.prepare(
    'SELECT id FROM conversations WHERE file_path = ?'
  ).get(filePath) as { id: number } | undefined;

  if (!conv) return [];

  const messages = db.prepare(
    'SELECT id, role, content, tool_calls, tool_call_id, timestamp FROM messages WHERE conversation_id = ? AND is_compacted = 1 ORDER BY timestamp ASC'
  ).all(conv.id) as Array<{
    id: number;
    role: string;
    content: string;
    tool_calls: string | null;
    tool_call_id: string | null;
    timestamp: number;
  }>;

  return messages.map((m) => ({
    id: m.id,
    role: m.role as ChatMessage['role'],
    content: m.content,
    toolCalls: m.tool_calls ? JSON.parse(m.tool_calls) : undefined,
    toolCallId: m.tool_call_id || undefined,
    timestamp: m.timestamp,
    isCompacted: true,
  }));
}

/**
 * Update the file path for a conversation (for file rename/move)
 */
export function updateConversationFilePath(
  oldPath: string,
  newPath: string
): void {
  if (!db) throw new Error('Database not initialized');

  db.prepare(
    'UPDATE conversations SET file_path = ?, updated_at = ? WHERE file_path = ?'
  ).run(newPath, Date.now(), oldPath);
}

/**
 * Get all conversations (for cleanup/management)
 */
export function getAllConversations(): Array<{
  id: number;
  filePath: string;
  messageCount: number;
  updatedAt: number;
}> {
  if (!db) throw new Error('Database not initialized');

  return db.prepare(`
    SELECT c.id, c.file_path as filePath, c.updated_at as updatedAt,
           (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND is_compacted = 0) as messageCount
    FROM conversations c
    ORDER BY c.updated_at DESC
  `).all() as Array<{
    id: number;
    filePath: string;
    messageCount: number;
    updatedAt: number;
  }>;
}

/**
 * Clean up orphaned conversations (files that no longer exist)
 */
export function cleanupOrphanedConversations(
  existingFiles: string[]
): number {
  if (!db) throw new Error('Database not initialized');

  const allConvs = getAllConversations();
  const existingSet = new Set(existingFiles);
  let deletedCount = 0;

  for (const conv of allConvs) {
    if (!existingSet.has(conv.filePath)) {
      deleteConversation(conv.filePath);
      deletedCount++;
    }
  }

  return deletedCount;
}
