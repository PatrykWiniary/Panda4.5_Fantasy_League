import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { User } from './Types';

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

export function addUser({name, mail, password, currency}:User){ 
  const stmt = db.prepare('INSERT INTO users (name, mail, password, currency) VALUES (?, ?, ?, ?)');
  const info = stmt.run(name, mail, password, currency);
  return { id: info.lastInsertRowid, name, mail, password, currency};
}

export function getAllUsers() {
  const stmt = db.prepare('SELECT * FROM users');
  return stmt.all();
}

export function clearUsers(){
  const stmt = db.prepare('DROP TABLE users');
  return stmt.run();
}
