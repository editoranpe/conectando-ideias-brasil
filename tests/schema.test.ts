import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_SCHEMA_SQL } from '../functions/_lib/schema.ts';

test('schema inicial contém todas as tabelas principais do CIB', () => {
  for (const table of ['users', 'members', 'sessions', 'login_attempts', 'invitations', 'settings', 'applications', 'charges', 'payment_reports', 'transactions', 'audit_logs']) {
    assert.ok(INITIAL_SCHEMA_SQL.includes('CREATE TABLE IF NOT EXISTS ' + table + ' ('), 'Tabela ausente: ' + table);
  }
  assert.ok(!INITIAL_SCHEMA_SQL.includes('DROP TABLE'));
  assert.ok(!INITIAL_SCHEMA_SQL.includes('DELETE FROM'));
});
