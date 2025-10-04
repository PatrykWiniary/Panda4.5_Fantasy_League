import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', 'data', 'app.db');
const INIT_SQL = path.join(__dirname, 'init.sql');

fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });

const db = new Database(DB_PATH);
const initSql = fs.readFileSync(INIT_SQL, 'utf8');
db.exec(initSql);

export function getAllItems() {
  const stmt = db.prepare('SELECT id, name, qty FROM items');
  return stmt.all();
}

export function addItem(name: string, qty = 0) {
  const stmt = db.prepare('INSERT INTO items (name, qty) VALUES (?, ?)');
  const info = stmt.run(name, qty);
  return { id: info.lastInsertRowid, name, qty };
}
