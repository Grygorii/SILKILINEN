'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL;

type Category = { slug: string; label: string; count: number };

export default function FooterShopLinks() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetch(`${API}/api/categories`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Category[]) => setCategories(data.filter(c => c.count > 0)))
      .catch(() => {});
  }, []);

  return (
    <>
      {categories.map(cat => (
        <a key={cat.slug} href={`/shop?category=${cat.slug}`}>{cat.label}</a>
      ))}
    </>
  );
}
