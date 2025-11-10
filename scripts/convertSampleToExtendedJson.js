const fs = require('fs');
const path = require('path');

// Fields that should be treated as ObjectId
const OBJECT_ID_FIELDS = new Set([
  '_id',
  'venueId',
  'organizer',
  'buyer',
  'event',
  'order',
  'owner',
]);

// Arrays that contain ObjectId strings
const OBJECT_ID_ARRAY_FIELDS = new Set([
  'ticketRefs',
]);

function asOid(value) {
  if (typeof value !== 'string') return value;
  // Only wrap if it matches 24-hex
  if (/^[a-fA-F0-9]{24}$/.test(value)) {
    return { $oid: value };
  }
  return value;
}

function convertDocument(doc) {
  const out = Array.isArray(doc) ? [] : {};

  const entries = Array.isArray(doc) ? doc.entries?.() ?? doc : Object.entries(doc);
  if (Array.isArray(doc)) {
    // Array of primitives/objects
    return doc.map((item) => {
      if (typeof item === 'string') return asOid(item);
      if (Array.isArray(item) || (item && typeof item === 'object')) return convertDocument(item);
      return item;
    });
  }

  for (const [key, value] of entries) {
    if (OBJECT_ID_FIELDS.has(key)) {
      out[key] = asOid(value);
    } else if (OBJECT_ID_ARRAY_FIELDS.has(key) && Array.isArray(value)) {
      out[key] = value.map(asOid);
    } else if (Array.isArray(value)) {
      out[key] = value.map((v) => (v && typeof v === 'object' ? convertDocument(v) : v));
    } else if (value && typeof value === 'object') {
      out[key] = convertDocument(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function convertFile(srcPath, dstPath) {
  const raw = fs.readFileSync(srcPath, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error(`Expected an array in ${srcPath}`);
  }
  const converted = data.map(convertDocument);
  fs.mkdirSync(path.dirname(dstPath), { recursive: true });
  fs.writeFileSync(dstPath, JSON.stringify(converted, null, 2), 'utf8');
  console.log(`Converted ${path.basename(srcPath)} → ${path.relative(process.cwd(), dstPath)}`);
}

function main() {
  const srcDir = path.resolve(__dirname, '..', 'data', 'sample_json');
  const outDir = path.resolve(__dirname, '..', 'data', 'sample_json_extended');
  const files = ['users.json', 'venues.json', 'events.json', 'orders.json', 'tickets.json'];

  for (const f of files) {
    const src = path.join(srcDir, f);
    const dst = path.join(outDir, f);
    if (!fs.existsSync(src)) {
      console.warn(`Skip missing ${src}`);
      continue;
    }
    convertFile(src, dst);
  }

  console.log('\nDone. Import these to MongoDB to get true ObjectId types.');
  console.log(`Output directory: ${outDir}`);
}

if (require.main === module) {
  main();
}



