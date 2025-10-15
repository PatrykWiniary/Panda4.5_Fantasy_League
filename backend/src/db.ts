import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { User } from './Types';

const DB_PATH = path.join(__dirname, '..', 'data', 'app.db');
const INIT_SQL = path.join(__dirname, 'init.sql');

fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });

const db = new Database(DB_PATH);
const initSql = fs.readFileSync(INIT_SQL, 'utf8');
db.exec(initSql);

const PASSWORD_SALT_BYTES = 16;
const PASSWORD_HASH_BYTES = 32;
const PASSWORD_ITERATIONS = 310000;
const PASSWORD_DIGEST = 'sha256';

type DbUserRow = {
  id: number;
  name: string;
  mail: string;
  password: string;
  currency: number;
};

function hashPassword(password: string) {
  const salt = crypto.randomBytes(PASSWORD_SALT_BYTES).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_HASH_BYTES, PASSWORD_DIGEST)
    .toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) {
    return false;
  }
  const expectedHash = Buffer.from(hash, 'hex');
  const derivedHash = crypto
    .pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, expectedHash.length, PASSWORD_DIGEST);
  if (expectedHash.length !== derivedHash.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedHash, derivedHash);
}

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
  const hashedPassword = hashPassword(password);
  const stmt = db.prepare('INSERT INTO users (name, mail, password, currency) VALUES (?, ?, ?, ?)');
  const info = stmt.run(name, mail, hashedPassword, currency);
  return { id: Number(info.lastInsertRowid), name, mail, password: hashedPassword, currency};
}

export function getAllUsers() {
  const stmt = db.prepare('SELECT * FROM users');
  return stmt.all();
}

export function clearUsers(){
  const stmt = db.prepare('DELETE FROM users');
  return stmt.run();
}

export function registerUser(user: User) {
  const existingUser = db
    .prepare('SELECT id FROM users WHERE mail = ?')
    .get(user.mail) as { id: number } | undefined;

  if (existingUser) {
    throw new Error('USER_ALREADY_EXISTS');
  }

  const insertedUser = addUser(user);
  const { password, ...safeUser } = insertedUser;
  return safeUser;
}

export function loginUser(mail: string, password: string) {
  const storedUser = db
    .prepare('SELECT id, name, mail, password, currency FROM users WHERE mail = ?')
    .get(mail) as DbUserRow | undefined;

  if (!storedUser) {
    throw new Error('INVALID_CREDENTIALS');
  }

  if (!verifyPassword(password, storedUser.password)) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const { password: _password, ...safeUser } = storedUser;
  return safeUser;
}
