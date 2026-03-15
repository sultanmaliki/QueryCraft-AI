// controllers/dbController.js
const path = require('path');
const fs = require('fs');
const jsonfile = require('jsonfile');
const { randomUUID } = require('crypto');
const tmp = require('tmp');
const csv = require('csv-parser');
const Database = require('better-sqlite3');
const { Client: PgClient } = require('pg');
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const neo4j = require('neo4j-driver');

const FILES_DB = path.join(__dirname, '..', 'db_files.json');

console.log(">>> USING UPDATED DBCONTROLLER WITH NEO4J SUPPORT <<<");

// fetch: prefer global fetch (Node 18+), else try node-fetch
let fetchFn = globalThis && globalThis.fetch;
if (!fetchFn) {
  try {
    // eslint-disable-next-line node/no-extraneous-require
    fetchFn = require('node-fetch');
  } catch {
    fetchFn = null;
  }
}

/* -------------------- file index helpers -------------------- */
function loadFilesIndex() {
  try {
    return jsonfile.readFileSync(FILES_DB);
  } catch {
    return {};
  }
}
function saveFilesIndex(obj) {
  jsonfile.writeFileSync(FILES_DB, obj, { spaces: 2 });
}

/* -------------------- Neo4j HTTP helper -------------------- */
async function runQueryOnNeo4jHttp(connectionString, query, maxRows = 1000, user, password, database = 'neo4j') {
  if (!fetchFn) throw new Error('fetch_not_available');

  // parse connectionString to extract host and optional creds if not provided
  let u;
  try {
    u = new URL(connectionString);
  } catch (e) {
    throw new Error('invalid_neo4j_http_uri');
  }

  // pull creds from URI if payload didn't provide
  if (!user || !password) {
    if (u.username) user = decodeURIComponent(u.username);
    if (u.password) password = decodeURIComponent(u.password);
  }

  if (!user || !password) {
    throw new Error('neo4j_http_auth_required');
  }

  // Normalize to HTTPS origin (fetch can't use neo4j+*/bolt* schemes)
  const origin = `https://${u.host}`;

  // Build endpoint: prefer explicit /db/<db>/tx/commit if present in path, else use provided database
  let endpoint;
  if (u.pathname && u.pathname.startsWith('/db/')) {
    const parts = u.pathname.split('/').filter(Boolean);
    const dbIndex = parts.indexOf('db');
    if (dbIndex !== -1 && parts.length > dbIndex + 1) {
      const dbName = parts[dbIndex + 1];
      endpoint = `${origin}/db/${dbName}/tx/commit`;
    } else {
      endpoint = `${origin}/db/${database}/tx/commit`;
    }
  } else {
    endpoint = `${origin}/db/${database}/tx/commit`;
  }

  const payload = { statements: [{ statement: query }] };

  const resp = await fetchFn(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json; charset=UTF-8',
      'Authorization': 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64')
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Neo4j HTTP ${resp.status}: ${txt}`);
  }

  const j = await resp.json();
  const result = j.results && j.results[0] ? j.results[0] : { columns: [], data: [] };
  const columns = result.columns || [];
  const rows = (result.data || []).map(d => {
    const obj = {};
    (d.row || []).forEach((val, i) => { obj[columns[i]] = val; });
    return obj;
  }).slice(0, maxRows);

  return { source: 'neo4j-http', rows, columns, rowCount: rows.length };
}

/* -------------------- Neo4j Bolt driver helper with auto-fallback -------------------- */
/**
 * Attempts Bolt first. If Bolt fails due to routing/network/HTTP-on-Bolt,
 * falls back to HTTP transactional endpoint.
 *
 * connectionString: any of neo4j://, neo4j+s://, neo4j+ssc://, bolt://, bolt+s://, http(s)://
 * authUser/authPass: optional; will attempt to extract from URI if omitted.
 * database: optional database name (defaults to 'neo4j')
 */
async function runQueryOnNeo4j(connectionString, query, maxRows = 1000, authUser, authPass, database = 'neo4j') {
  let uri = connectionString.trim();
  let user = authUser;
  let pass = authPass;

  // extract creds from URI if present; remove them from uri for the driver
  try {
    const maybe = new URL(uri);
    if (!user && maybe.username) user = decodeURIComponent(maybe.username);
    if (!pass && maybe.password) pass = decodeURIComponent(maybe.password);
    if (maybe.username || maybe.password) {
      maybe.username = '';
      maybe.password = '';
      uri = maybe.toString();
    }
  } catch {
    // ignore parse failures
  }

  // Determine whether to try Bolt driver first
  const looksLikeBolt = /^(neo4j|bolt)(\+s|\+ssc)?:\/\//i.test(connectionString.trim());
  if (looksLikeBolt) {
    // If missing creds, try HTTP fallback (HTTP helper can extract creds from URI)
    if (!user || !pass) {
      return await runQueryOnNeo4jHttp(connectionString, query, maxRows, user, pass, database);
    }

    let driver;
    try {
      driver = neo4j.driver(uri, neo4j.auth.basic(user, pass), { disableLosslessIntegers: false });
      const session = driver.session({ defaultAccessMode: neo4j.session.READ, database });

      function normalizeValue(v) {
        try {
          if (neo4j.isInt && neo4j.isInt(v)) return v.toNumber();
        } catch { /* ignore */ }

        if (Array.isArray(v)) return v.map(normalizeValue);

        if (v && typeof v === 'object' && v.identity && v.labels && v.properties) {
          const out = { id: v.identity ? String(v.identity) : undefined, labels: v.labels };
          for (const k of Object.keys(v.properties || {})) out[k] = normalizeValue(v.properties[k]);
          return out;
        }

        if (v && typeof v === 'object' && v.start && v.end && v.type && v.properties) {
          const out = { id: v.identity ? String(v.identity) : undefined, type: v.type, start: String(v.start), end: String(v.end) };
          out.properties = {};
          for (const k of Object.keys(v.properties || {})) out.properties[k] = normalizeValue(v.properties[k]);
          return out;
        }

        if (v instanceof Date) return v.toISOString();
        if (v && typeof v === 'object') {
          const r = {};
          for (const k of Object.keys(v)) r[k] = normalizeValue(v[k]);
          return r;
        }
        return v;
      }

      try {
        const result = await session.run(query);
        const records = result.records || [];
        const rows = records.map(rec => {
          const out = {};
          for (const key of rec.keys) {
            out[key] = normalizeValue(rec.get(key));
          }
          return out;
        }).slice(0, maxRows);

        const columns = rows[0] ? Object.keys(rows[0]) : [];
        await session.close();
        await driver.close();
        return { source: 'neo4j', rows, columns, rowCount: rows.length };
      } catch (err) {
        const msg = (err && err.message) ? String(err.message).toLowerCase() : '';
        const shouldFallback = msg.includes('server responded http') ||
          msg.includes('could not perform discovery') ||
          msg.includes('no routing') ||
          msg.includes('failed to fetch routing table') ||
          msg.includes('connect') || msg.includes('econnrefused') || msg.includes('enetunreach');

        try { await session.close(); } catch { /* ignore */ }
        try { await driver.close(); } catch { /* ignore */ }

        if (shouldFallback) {
          return await runQueryOnNeo4jHttp(connectionString, query, maxRows, user, pass, database);
        }
        throw err;
      }
    } catch (err) {
      const msg = (err && err.message) ? String(err.message).toLowerCase() : '';
      const allowFallback = msg.includes('server responded http') || msg.includes('could not perform discovery') || msg.includes('no routing') || msg.includes('failed to fetch routing table') || msg.includes('econnrefused') || msg.includes('enetunreach');
      if (allowFallback) {
        try {
          return await runQueryOnNeo4jHttp(connectionString, query, maxRows, user, pass, database);
        } catch (err2) {
          throw new Error(`bolt_error: ${err.message}; http_fallback_error: ${err2.message}`);
        }
      }
      try {
        return await runQueryOnNeo4jHttp(connectionString, query, maxRows, user, pass, database);
      } catch {
        throw err;
      }
    }
  } else {
    // Not a bolt-style URI: go straight to HTTP helper
    return await runQueryOnNeo4jHttp(connectionString, query, maxRows, user, pass, database);
  }
}

/* -------------------- file upload helper -------------------- */
/**
 * Save metadata for uploaded file
 * multer file object expected
 */
async function handleUpload(file) {
  const filesIdx = loadFilesIndex();
  const id = randomUUID();
  const ext = path.extname(file.originalname).toLowerCase();
  const type =
    ext === '.csv' ? 'csv'
      : ext === '.json' ? 'json'
      : (ext === '.sqlite' || ext === '.db') ? 'sqlite'
      : ext === '.sql' ? 'sql'
      : 'unknown';

  const meta = {
    id,
    originalName: file.originalname,
    path: file.path,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    ext,
    type
  };
  filesIdx[id] = meta;
  saveFilesIndex(filesIdx);
  return { success: true, file: meta };
}

/* -------------------- core executeQuery -------------------- */
/**
 * Main entry: execute a SQL query against a file or a connection string,
 * or a Mongo structured query when connectionString points to Mongo.
 *
 * payload: {
 *   sourceType: 'file'|'connection',
 *   fileId?,
 *   connectionString?,
 *   user?, password?, database?,
 *   query?,       // SQL query string for SQL engines or imported files OR Cypher when using Neo4j
 *   mongo?,       // { collection, filter?, projection?, limit? } for MongoDB
 *   maxRows?
 * }
 */
async function executeQuery(payload) {
  if (!payload) throw new Error('empty_payload');

  const hasSQLQuery = !!(payload.query && String(payload.query).trim());
  const hasMongoQuery = !!(payload.mongo && payload.mongo.collection);

  if (!hasSQLQuery && !hasMongoQuery) {
    throw new Error('empty_query_or_mongo');
  }

  const maxRows = Number(payload.maxRows || 1000);
  const sourceType = payload.sourceType || (payload.fileId ? 'file' : 'connection');

  if (sourceType === 'file') {
    const filesIdx = loadFilesIndex();
    const meta = filesIdx[payload.fileId];
    if (!meta) throw new Error('file_not_found');
    if (meta.type === 'sqlite') {
      if (!hasSQLQuery) throw new Error('empty_query_for_sqlite_file');
      return runQueryOnSqliteFile(meta.path, payload.query, maxRows);
    } else {
      if (!hasSQLQuery) throw new Error('empty_query_for_file_import');
      return runQueryOnImportedFile(meta, payload.query, maxRows);
    }
  } else if (sourceType === 'connection') {
    if (!payload.connectionString) throw new Error('connectionString_required');
    const cs = payload.connectionString.trim();

    // Detect Mongo URIs
    if (cs.startsWith('mongodb://') || cs.startsWith('mongodb+srv://')) {
      if (!hasMongoQuery) throw new Error('mongo_query_required_for_mongodb');
      return runQueryOnMongo(cs, payload.mongo || {}, maxRows);
    }

    // Postgres
    if (cs.startsWith('postgres://') || cs.startsWith('postgresql://')) {
      if (!hasSQLQuery) throw new Error('sql_query_required_for_postgres');
      return runQueryOnPostgres(cs, payload.query, maxRows);
    }

    // MySQL / MariaDB
    if (cs.startsWith('mysql://') || cs.startsWith('mariadb://')) {
      if (!hasSQLQuery) throw new Error('sql_query_required_for_mysql');
      return runQueryOnMySQL(cs, payload.query, maxRows);
    }

    // Neo4j (supports neo4j://, neo4j+s://, neo4j+ssc://, bolt://, bolt+s://, http(s)://)
    if (
      /^(neo4j|bolt)(\+s|\+ssc)?:\/\//i.test(cs) ||
      /^https?:\/\//i.test(cs)
    ) {
      if (!hasSQLQuery) throw new Error('cypher_query_required_for_neo4j');
      return runQueryOnNeo4j(cs, payload.query, maxRows, payload.user, payload.password, payload.database || 'neo4j');
    }

    throw new Error('unsupported_connection_type');
  } else {
    throw new Error('invalid_sourceType');
  }
}

/* -------------------- helpers for SQL / file imports -------------------- */

function runQueryOnSqliteFile(filePath, query, maxRows) {
  const db = new Database(filePath, { readonly: true, fileMustExist: true, timeout: 5000 });
  try {
    const stmt = db.prepare(query);
    const rows = stmt.all();
    const sliced = Array.isArray(rows) ? rows.slice(0, maxRows) : [];
    const columns = sliced[0] ? Object.keys(sliced[0]) : [];
    return { source: 'sqlite-file', rows: sliced, columns, rowCount: sliced.length };
  } finally {
    db.close();
  }
}

async function runQueryOnImportedFile(meta, query, maxRows) {
  const tmpobj = tmp.fileSync({ postfix: '.sqlite' });
  const tmpDbPath = tmpobj.name;
  const db = new Database(tmpDbPath);
  try {
    if (meta.type === 'csv') {
      await importCsvToSqlite(meta.path, db, 'imported_csv');
    } else if (meta.type === 'json') {
      await importJsonToSqlite(meta.path, db, 'imported_json');
    } else if (meta.type === 'sql') {
      const sqlText = fs.readFileSync(meta.path, 'utf8');
      db.exec(sqlText);
    } else {
      const txt = fs.readFileSync(meta.path, 'utf8').trim();
      if (txt.startsWith('[')) {
        await importJsonToSqlite(meta.path, db, 'imported_json');
      } else {
        await importCsvToSqlite(meta.path, db, 'imported_csv');
      }
    }
    const stmt = db.prepare(query);
    const rows = stmt.all();
    const sliced = Array.isArray(rows) ? rows.slice(0, maxRows) : [];
    const columns = sliced[0] ? Object.keys(sliced[0]) : [];
    return { source: 'temp-sqlite-import', rows: sliced, columns, rowCount: sliced.length };
  } finally {
    db.close();
    try { tmpobj.removeCallback(); } catch { /* ignore */ }
  }
}

function importCsvToSqlite(csvPath, db, tableName) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(csvPath);
    const parser = csv();
    let headersCreated = false;
    const rowsBatch = [];
    stream.pipe(parser)
      .on('headers', (headers) => {
        const cols = headers.map(h => `"${h.replace(/"/g, '""')}" TEXT`);
        const createSQL = `CREATE TABLE IF NOT EXISTS "${tableName}" (${cols.join(',')});`;
        db.exec(createSQL);
        headersCreated = true;
      })
      .on('data', (data) => {
        rowsBatch.push(data);
        if (rowsBatch.length >= 500) {
          insertRows(db, tableName, rowsBatch.splice(0, rowsBatch.length));
        }
      })
      .on('end', () => {
        if (rowsBatch.length) insertRows(db, tableName, rowsBatch);
        resolve();
      })
      .on('error', (err) => reject(err));
  });
}

function insertRows(db, tableName, rows) {
  if (!rows || rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const placeholders = cols.map(_ => '?').join(',');
  const insertSQL = `INSERT INTO "${tableName}" (${cols.map(c => `"${c}"`).join(',')}) VALUES (${placeholders})`;
  const insert = db.prepare(insertSQL);
  const insertMany = db.transaction((data) => {
    for (const r of data) {
      const vals = cols.map(c => r[c] == null ? null : String(r[c]));
      insert.run(vals);
    }
  });
  insertMany(rows);
}

function importJsonToSqlite(jsonPath, db, tableName) {
  return new Promise((resolve, reject) => {
    try {
      const txt = fs.readFileSync(jsonPath, 'utf8');
      let arr = JSON.parse(txt);
      if (!Array.isArray(arr)) arr = [arr];
      if (arr.length === 0) return resolve();
      const cols = Array.from(new Set(arr.flatMap(o => Object.keys(o))));
      const colsDef = cols.map(c => `"${c}" TEXT`);
      db.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" (${colsDef.join(',')});`);
      const normRows = arr.map(o => {
        const row = {};
        for (const c of cols) row[c] = o[c] == null ? null : String(o[c]);
        return row;
      });
      insertRows(db, tableName, normRows);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

/* -------------------- Postgres / MySQL helpers -------------------- */

async function runQueryOnPostgres(connectionString, query, maxRows) {
  const client = new PgClient({ connectionString, statement_timeout: 10000 });
  await client.connect();
  try {
    const res = await client.query({ text: query });
    const columns = res.fields ? res.fields.map(f => f.name) : [];
    const rows = res.rows.slice(0, maxRows);
    return { source: 'postgres', rows, columns, rowCount: rows.length };
  } finally {
    await client.end();
  }
}

async function runQueryOnMySQL(connectionString, query, maxRows) {
  const conn = await mysql.createConnection(connectionString);
  try {
    const [rows, fields] = await conn.execute({ sql: query });
    const resultRows = Array.isArray(rows) ? rows.slice(0, maxRows) : [];
    const columns = fields ? fields.map(f => f.name) : (resultRows[0] ? Object.keys(resultRows[0]) : []);
    return { source: 'mysql', rows: resultRows, columns, rowCount: resultRows.length };
  } finally {
    await conn.end();
  }
}

/* -------------------- MongoDB support -------------------- */

async function runQueryOnMongo(connectionString, mongoQuery = {}, maxRows = 1000) {
  if (!mongoQuery || !mongoQuery.collection) {
    throw new Error('mongo.query_missing_collection');
  }

  const limit = Math.min(Number(mongoQuery.limit || maxRows || 1000), maxRows);
  const client = new MongoClient(connectionString, { serverSelectionTimeoutMS: 10000 });

  await client.connect();
  try {
    const db = client.db();
    const coll = db.collection(mongoQuery.collection);

    const filter = (mongoQuery.filter && typeof mongoQuery.filter === 'object') ? mongoQuery.filter : {};
    const projection = (mongoQuery.projection && typeof mongoQuery.projection === 'object') ? mongoQuery.projection : undefined;

    const cursor = coll.find(filter, projection ? { projection } : {}).limit(limit);
    const docs = await cursor.toArray();

    const normalized = docs.map(doc => {
      const out = {};
      for (const k of Object.keys(doc)) {
        const v = doc[k];
        if (v && typeof v === 'object') {
          if (v._bsontype === 'ObjectID' && typeof v.toString === 'function') {
            out[k] = String(v);
            continue;
          }
          if (v instanceof Date) {
            out[k] = v.toISOString();
            continue;
          }
        }
        out[k] = v;
      }
      return out;
    });

    const columns = normalized.length ? Object.keys(normalized[0]) : [];
    return { source: 'mongodb', rows: normalized, columns, rowCount: normalized.length };
  } finally {
    await client.close();
  }
}

module.exports = {
  handleUpload,
  executeQuery
};
