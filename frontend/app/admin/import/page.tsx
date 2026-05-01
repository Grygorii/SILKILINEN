'use client';

import { useState, useRef, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Platform = 'generic' | 'etsy' | 'shopify' | 'woocommerce';

type PreviewRow = {
  name: string;
  price: string;
  category: string;
  colours: string;
  sizes: string;
};

type ImportResult = {
  name: string;
  status: 'imported' | 'skipped' | 'error';
  reason?: string;
};

// ── CSV parser ─────────────────────────────────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
      else { field += ch; }
    }
  }
  if (field || row.length > 0) { row.push(field); rows.push(row); }
  if (rows.length === 0) return [];

  const headers = rows[0].map(h => h.trim());
  return rows.slice(1)
    .filter(r => r.some(c => c.trim()))
    .map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] || '').trim()])));
}

// ── Column mapping ─────────────────────────────────────────────────────────────

function splitVal(str: string): string {
  return str.split(/[,|]/).map(s => s.trim()).filter(Boolean).join(', ');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function mapRows(records: Record<string, string>[], platform: Platform): PreviewRow[] {
  if (platform === 'shopify') {
    const products = new Map<string, PreviewRow & { cs: Set<string>; ss: Set<string> }>();
    let last = '';
    for (const row of records) {
      const title = row['Title'] || row['title'];
      if (title) {
        last = title;
        products.set(title, {
          name: title,
          price: row['Variant Price'] || row['Price'] || '',
          category: row['Type'] || row['Product Type'] || '',
          colours: '',
          sizes: '',
          cs: new Set(),
          ss: new Set(),
        });
      }
      if (last && products.has(last)) {
        const p = products.get(last)!;
        const o1 = (row['Option1 Value'] || '').trim();
        const o2 = (row['Option2 Value'] || '').trim();
        if (o1 && o1 !== 'Default Title') p.cs.add(o1);
        if (o2 && o2 !== 'Default Title') p.ss.add(o2);
      }
    }
    return [...products.values()].map(({ cs, ss, ...p }) => ({
      ...p, colours: [...cs].join(', '), sizes: [...ss].join(', '),
    }));
  }

  return records.map(row => {
    if (platform === 'etsy') {
      const tags = (row['TAGS'] || '').split(',').map(t => t.trim()).filter(Boolean);
      let colours = '';
      let sizes = '';
      try {
        const vars = JSON.parse(row['VARIATIONS'] || '[]');
        for (const v of vars) {
          const n = (v.formattedName || '').toLowerCase();
          const vals = (v.values || []).map((x: { value: string }) => x.value).filter(Boolean).join(', ');
          if (n.includes('color') || n.includes('colour')) colours = vals;
          else if (n.includes('size')) sizes = vals;
        }
      } catch { /* not JSON */ }
      return { name: row['TITLE'] || '', price: row['PRICE'] || '', category: tags[0] || '', colours, sizes };
    }

    if (platform === 'woocommerce') {
      const cats = (row['Categories'] || '').split(',').map(c => c.trim()).filter(Boolean);
      return {
        name: row['Name'] || '',
        price: row['Regular price'] || row['Sale price'] || '',
        category: cats[0] || '',
        colours: splitVal(row['Attribute 1 value(s)'] || row['Attribute 1 values'] || ''),
        sizes: splitVal(row['Attribute 2 value(s)'] || row['Attribute 2 values'] || ''),
      };
    }

    // Generic
    return {
      name: row['name'] || '',
      price: row['price'] || '',
      category: row['category'] || '',
      colours: splitVal(row['colours'] || row['colors'] || ''),
      sizes: splitVal(row['sizes'] || ''),
    };
  }).filter(r => r.name);
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const [platform, setPlatform] = useState<Platform>('generic');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [summary, setSummary] = useState<{ imported: number; skipped: number } | null>(null);
  const [parseError, setParseError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function processFile(f: File) {
    setFile(f);
    setResults(null);
    setSummary(null);
    setParseError('');
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const records = parseCSV(e.target?.result as string);
        const rows = mapRows(records, platform);
        if (rows.length === 0) {
          setParseError('No products found. Check the file and platform selection.');
          setPreview([]);
        } else {
          setPreview(rows);
        }
      } catch {
        setParseError('Could not parse this file. Make sure it is a valid CSV.');
        setPreview([]);
      }
    };
    reader.readAsText(f);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);

  function handlePlatformChange(p: Platform) {
    setPlatform(p);
    if (file) {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const records = parseCSV(e.target?.result as string);
          setPreview(mapRows(records, p));
        } catch { /* ignore */ }
      };
      reader.readAsText(file);
    }
  }

  function handleCancel() {
    setFile(null);
    setPreview([]);
    setResults(null);
    setSummary(null);
    setParseError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleImport() {
    if (!file || preview.length === 0) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.append('csv', file);
      form.append('platform', platform);
      const res = await fetch(`${API}/api/products/import`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setResults(data.results);
      setSummary({ imported: data.imported, skipped: data.skipped });
      setPreview([]);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  const showPreview = preview.length > 0 && !results;

  return (
    <AdminLayout active="import">
      <div className={styles.header}>
        <h2>Import products</h2>
      </div>

      {/* Platform selector */}
      <section className={styles.section}>
        <label className={styles.fieldLabel}>Source platform</label>
        <div className={styles.platformGrid}>
          {(['generic', 'etsy', 'shopify', 'woocommerce'] as Platform[]).map(p => (
            <button
              key={p}
              className={`${styles.platformBtn} ${platform === p ? styles.platformActive : ''}`}
              onClick={() => handlePlatformChange(p)}
            >
              {p === 'generic' ? 'Generic CSV' : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        <p className={styles.hint}>
          {platform === 'etsy' && 'Export from Etsy → Shop Manager → Listings → Download CSV'}
          {platform === 'shopify' && 'Export from Shopify → Products → Export → All products'}
          {platform === 'woocommerce' && 'Export from WooCommerce → Products → Export'}
          {platform === 'generic' && 'Columns: name, price, description, category, colours, sizes'}
        </p>
      </section>

      {/* Drop zone */}
      {!showPreview && !results && (
        <section className={styles.section}>
          <div
            className={`${styles.dropzone} ${isDragging ? styles.dropzoneDrag : ''} ${file ? styles.dropzoneHasFile : ''}`}
            onDragEnter={e => { e.preventDefault(); setIsDragging(true); }}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className={styles.fileInput}
              onChange={handleFileChange}
            />
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            <p className={styles.dropText}>
              {file ? file.name : 'Drop your CSV here or click to browse'}
            </p>
            {!file && <p className={styles.dropSub}>Accepts .csv files up to 5 MB</p>}
          </div>
          {parseError && <p className={styles.error}>{parseError}</p>}
        </section>
      )}

      {/* Preview table */}
      {showPreview && (
        <section className={styles.section}>
          <div className={styles.previewHeader}>
            <p className={styles.previewCount}>
              <strong>{preview.length}</strong> product{preview.length !== 1 ? 's' : ''} ready to import
              {preview.length > 50 && ' (showing first 50)'}
            </p>
            <button className={styles.changeBtn} onClick={handleCancel}>Change file</button>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Category</th>
                  <th>Colours</th>
                  <th>Sizes</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 50).map((row, i) => (
                  <tr key={i}>
                    <td>{row.name || <span className={styles.empty}>—</span>}</td>
                    <td>{row.price ? `€${parseFloat(row.price).toFixed(2)}` : <span className={styles.empty}>—</span>}</td>
                    <td>{row.category || <span className={styles.empty}>—</span>}</td>
                    <td className={styles.tagsCell}>{row.colours || <span className={styles.empty}>—</span>}</td>
                    <td className={styles.tagsCell}>{row.sizes || <span className={styles.empty}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {parseError && <p className={styles.error}>{parseError}</p>}

          <div className={styles.actions}>
            <button className={styles.importBtn} onClick={handleImport} disabled={importing}>
              {importing ? 'Importing…' : `Import ${preview.length} product${preview.length !== 1 ? 's' : ''}`}
            </button>
            <button className={styles.cancelBtn} onClick={handleCancel} disabled={importing}>
              Cancel
            </button>
          </div>
        </section>
      )}

      {/* Results */}
      {results && summary && (
        <section className={styles.section}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryImported}>{summary.imported} imported</span>
            {summary.skipped > 0 && (
              <span className={styles.summarySkipped}>{summary.skipped} skipped</span>
            )}
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Status</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td>{r.name}</td>
                    <td>
                      <span className={`${styles.badge} ${
                        r.status === 'imported' ? styles.badgeImported
                          : r.status === 'skipped' ? styles.badgeSkipped
                            : styles.badgeError
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className={styles.reason}>{r.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.actions}>
            <button className={styles.cancelBtn} onClick={handleCancel}>Import another file</button>
            <a href="/admin/products" className={styles.viewBtn}>View products →</a>
          </div>
        </section>
      )}
    </AdminLayout>
  );
}
