import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

/**
 * Click-to-sort for simple tables.
 *   const { rows: sorted, sortBy, dir, toggle } = useSort(rows, 'name');
 *   <SortTh k="name" sort={{ sortBy, dir, toggle }}>Customer</SortTh>
 * Strings sort with Marathi/English collation, numbers numerically.
 */
export function useSort(rows, initialKey = null, initialDir = 'asc') {
  const [sortBy, setSortBy] = useState(initialKey);
  const [dir, setDir] = useState(initialDir);

  const sorted = useMemo(() => {
    if (!sortBy || !rows) return rows || [];
    const coll = new Intl.Collator(['mr', 'en'], { numeric: true, sensitivity: 'base' });
    const out = [...rows].sort((a, b) => {
      const x = typeof sortBy === 'function' ? sortBy(a) : a[sortBy];
      const y = typeof sortBy === 'function' ? sortBy(b) : b[sortBy];
      if (typeof x === 'number' && typeof y === 'number') return x - y;
      return coll.compare(String(x ?? ''), String(y ?? ''));
    });
    return dir === 'desc' ? out.reverse() : out;
  }, [rows, sortBy, dir]);

  const toggle = (key) => {
    if (sortBy === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setDir(typeof rows?.[0]?.[key] === 'number' ? 'desc' : 'asc');
    }
  };

  return { rows: sorted, sortBy, dir, toggle };
}

/** Sortable <th>. Pass num for right-aligned numeric columns. */
export function SortTh({ k, sort, num = false, children }) {
  const active = sort.sortBy === k;
  const Arrow = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className={num ? 'num' : ''} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => sort.toggle(k)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide transition hover:text-ink ${num ? 'flex-row-reverse' : ''} ${active ? 'text-ink' : ''}`}
      >
        {children}
        <Arrow size={12} className={active ? '' : 'opacity-40'} />
      </button>
    </th>
  );
}
