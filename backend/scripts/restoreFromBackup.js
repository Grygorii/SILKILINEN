/**
 * SILKILINEN backup restore — read an R2 archive back into Mongo.
 *
 * Pairs with backupToR2.js. DOES NOT touch production by default: you must
 * pass --target with a non-production MONGODB URI (e.g. a fresh free-tier
 * cluster, or mongodb://localhost). The first practice restore should go
 * into a throwaway test database — a backup you've never restored is just
 * hope, not insurance.
 *
 * Usage:
 *   # list available backups
 *   node backend/scripts/restoreFromBackup.js --list
 *
 *   # restore the latest backup into a TEST database (recommended for drill)
 *   node backend/scripts/restoreFromBackup.js \
 *     --target "mongodb+srv://test-cluster.../silkilinen-restore-test" \
 *     --latest
 *
 *   # restore a specific archive
 *   node backend/scripts/restoreFromBackup.js \
 *     --target "mongodb://localhost:27017/silkilinen-restore-test" \
 *     --key "silkilinen-2026-06-13T03-00-00Z.json.gz"
 *
 *   # PRODUCTION restore — only when you actually need it. Requires the
 *   # explicit --i-mean-it flag so you can't run this by accident.
 *   node backend/scripts/restoreFromBackup.js \
 *     --target "<PRODUCTION MONGODB_URI>" \
 *     --latest --i-mean-it
 *
 * Behaviour: each collection in the archive REPLACES the target collection
 * (drop + insert). Target collections not in the archive are left alone.
 *
 * Required env vars (or pass on CLI):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const zlib = require('zlib');
const { MongoClient, ObjectId } = require('mongodb');
const {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');

function parseArgs() {
  const args = { _: [] };
  const av = process.argv.slice(2);
  for (let i = 0; i < av.length; i++) {
    const a = av[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = av[i + 1];
      if (next && !next.startsWith('--')) { args[key] = next; i++; }
      else args[key] = true;
    } else args._.push(a);
  }
  return args;
}

function requireEnv(name) {
  if (!process.env[name]) throw new Error(`${name} is required`);
  return process.env[name];
}

function r2Client() {
  const accountId = requireEnv('R2_ACCOUNT_ID');
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    },
  });
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function listBackups(s3, bucket) {
  const items = [];
  let token;
  do {
    const page = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: 'silkilinen-',
      ContinuationToken: token,
    }));
    for (const obj of page.Contents || []) items.push(obj);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  items.sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));
  return items;
}

async function fetchArchive(s3, bucket, key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const gz = await streamToBuffer(res.Body);
  const json = zlib.gunzipSync(gz).toString('utf8');
  return JSON.parse(json);
}

// Walk the parsed JSON and re-hydrate values that serialised as plain
// objects: ObjectId-shaped strings, ISO date strings. Conservative — only
// known-safe patterns, never guesses.
const OID_RE = /^[a-f0-9]{24}$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
function reviveValue(v) {
  if (v === null || typeof v !== 'object') {
    if (typeof v === 'string') {
      if (ISO_RE.test(v)) {
        const d = new Date(v);
        if (!Number.isNaN(d.getTime())) return d;
      }
    }
    return v;
  }
  if (Array.isArray(v)) return v.map(reviveValue);
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    if (k === '_id' && typeof val === 'string' && OID_RE.test(val)) {
      out._id = new ObjectId(val);
    } else if (typeof val === 'string' && OID_RE.test(val) && /id$/i.test(k)) {
      // Foreign-key fields ending in "Id" stored as ObjectId strings.
      try { out[k] = new ObjectId(val); } catch { out[k] = val; }
    } else {
      out[k] = reviveValue(val);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const bucket = requireEnv('R2_BUCKET');
  const s3 = r2Client();

  if (args.list) {
    const items = await listBackups(s3, bucket);
    console.log(`${items.length} backup(s) in bucket "${bucket}":`);
    for (const it of items) {
      console.log(`  ${it.LastModified.toISOString()}  ${(it.Size / 1024).toFixed(0).padStart(7)} KB  ${it.Key}`);
    }
    return;
  }

  if (!args.target) {
    throw new Error('Pass --target "<MONGODB URI>" (use a TEST database for the drill — not production).');
  }
  // Production guardrail. We can't reliably auto-detect the prod URI, but we
  // can refuse silently-wide actions: require --i-mean-it when the URI looks
  // like prod (silkilinen, not test/restore in the path).
  const looksProd = /silkilinen/i.test(args.target) && !/(test|restore|staging|local)/i.test(args.target);
  if (looksProd && !args['i-mean-it']) {
    throw new Error('Target URI looks like production. Refusing without --i-mean-it. If this is the drill, restore into a TEST database first.');
  }

  let key;
  if (args.key) {
    key = args.key;
  } else if (args.latest) {
    const items = await listBackups(s3, bucket);
    if (!items.length) throw new Error('No backups in bucket.');
    key = items[0].Key;
  } else {
    throw new Error('Pass either --latest or --key "<archive name>".');
  }

  console.log(`[restore] Fetching ${key}…`);
  const archive = await fetchArchive(s3, bucket, key);
  const colls = Object.keys(archive.collections || {});
  console.log(`[restore] Archive: db=${archive.meta?.database || '(unknown)'}, ${colls.length} collections, taken at ${archive.meta?.createdAt}`);

  const client = new MongoClient(args.target);
  await client.connect();
  try {
    const db = client.db();
    console.log(`[restore] Target db: ${db.databaseName}`);
    for (const name of colls) {
      const docs = (archive.collections[name] || []).map(reviveValue);
      await db.collection(name).drop().catch(() => {}); // ok if doesn't exist
      if (docs.length) {
        // Batches of 1000 to keep memory + wire size sensible.
        for (let i = 0; i < docs.length; i += 1000) {
          await db.collection(name).insertMany(docs.slice(i, i + 1000), { ordered: false });
        }
      }
      console.log(`  ${name.padEnd(28)} ${docs.length} docs`);
    }
    console.log('[restore] Done.');
  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error('[restore] FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
});
