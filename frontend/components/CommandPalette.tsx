'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './CommandPalette.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type SearchResult = {
  type: 'product' | 'order' | 'customer';
  id: string;
  label: string;
  sub: string;
  href: string;
};

type Row = {
  key: string;
  type: string;
  label: string;
  sub?: string;
  href: string;
};

const NAV_ITEMS: { label: string; href: string }[] = [
  { label: 'Dashboard',   href: '/admin' },
  { label: 'Orders',      href: '/admin/orders' },
  { label: 'Products',    href: '/admin/products' },
  { label: 'Inventory',   href: '/admin/inventory' },
  { label: 'Customers',   href: '/admin/customers' },
  { label: 'Reviews',     href: '/admin/reviews' },
  { label: 'Marketing',   href: '/admin/marketing' },
  { label: 'Finance',     href: '/admin/finance' },
  { label: 'Settings',    href: '/admin/settings' },
  { label: 'Ask AI',      href: '/admin/analyst' },
  { label: 'New order',   href: '/admin/orders/new' },
  { label: 'New product', href: '/admin/products/new' },
];

const TYPE_BADGE: Record<string, string> = {
  product: 'Product',
  order: 'Order',
  customer: 'Customer',
  nav: 'Page',
};

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  const searching = trimmed.length >= 2;

  // Open on Cmd+K / Ctrl+K, close on Escape, open on custom event (sidebar button)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('open-command-palette', onOpenEvent);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('open-command-palette', onOpenEvent);
    };
  }, []);

  // Reset state each time the palette opens
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setLoading(false);
      setSelected(0);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open || !searching) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API}/api/admin/search?q=${encodeURIComponent(trimmed)}`,
          { credentials: 'include' },
        );
        const data = await res.json();
        if (!cancelled) setResults(Array.isArray(data.results) ? data.results : []);
      } catch {
        if (!cancelled) setResults([]);
      }
      if (!cancelled) setLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, searching, trimmed]);

  // Reset selection when the list changes
  useEffect(() => {
    setSelected(0);
  }, [trimmed, results]);

  // Keep the selected row visible
  useEffect(() => {
    listRef.current
      ?.querySelector('[data-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open) return null;

  // Build grouped rows
  const navMatches = searching
    ? NAV_ITEMS.filter(n => n.label.toLowerCase().includes(trimmed.toLowerCase()))
    : NAV_ITEMS;

  const groups: { heading: string; rows: Row[] }[] = [];
  if (searching) {
    const byType: [string, SearchResult['type']][] = [
      ['Products', 'product'],
      ['Orders', 'order'],
      ['Customers', 'customer'],
    ];
    for (const [heading, type] of byType) {
      const rows = results
        .filter(r => r.type === type)
        .map(r => ({ key: `${r.type}-${r.id}`, type: r.type, label: r.label, sub: r.sub, href: r.href }));
      if (rows.length) groups.push({ heading, rows });
    }
  }
  if (navMatches.length) {
    groups.push({
      heading: 'Go to',
      rows: navMatches.map(n => ({ key: `nav-${n.href}`, type: 'nav', label: n.label, href: n.href })),
    });
  }
  const flat = groups.flatMap(g => g.rows);

  function navigate(row: Row | undefined) {
    if (!row) return;
    setOpen(false);
    router.push(row.href);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(s => Math.min(s + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(s => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      navigate(flat[selected]);
    }
  }

  let rowIndex = -1;

  return (
    <div className={styles.backdrop} onClick={() => setOpen(false)}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <input
          className={styles.input}
          type="text"
          placeholder="Search products, orders, customers…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onInputKeyDown}
          autoFocus
          spellCheck={false}
        />
        <div className={styles.list} ref={listRef}>
          {searching && loading && (
            <p className={styles.status}>Searching…</p>
          )}
          {searching && !loading && flat.length === 0 && (
            <p className={styles.status}>No matches</p>
          )}
          {!(searching && loading) && groups.map(group => (
            <div key={group.heading}>
              <p className={styles.groupHeading}>{group.heading}</p>
              {group.rows.map(row => {
                rowIndex += 1;
                const i = rowIndex;
                const isSelected = i === selected;
                return (
                  <div
                    key={row.key}
                    className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}
                    data-selected={isSelected || undefined}
                    onMouseEnter={() => setSelected(i)}
                    onClick={() => navigate(row)}
                  >
                    <span className={styles.rowLabel}>{row.label}</span>
                    {row.sub && <span className={styles.rowSub}>{row.sub}</span>}
                    <span className={styles.badge}>{TYPE_BADGE[row.type] || row.type}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className={styles.footer}>↑↓ navigate · ↵ open · esc close</div>
      </div>
    </div>
  );
}
