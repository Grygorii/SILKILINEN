'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { colourToHex } from '@/lib/colours';
import styles from './ProductGrid.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type ProductImage = { url: string; isPrimary?: boolean; alt?: string };
type Category = { slug: string; label: string; count: number };

type Product = {
  _id: string;
  name: string;
  price: number;
  category: string;
  colours: string[];
  sizes: string[];
  description: string;
  materialComposition?: string;
  createdAt?: string;
  images?: ProductImage[];
  image?: string;
};

const NEW_DAYS = 30;

function getMaterialSub(mat?: string): string {
  if (!mat) return '';
  const m = mat.toLowerCase();
  if (m.includes('mulberry silk')) return 'in Mulberry Silk';
  if (m.includes('silk satin')) return 'in Silk Satin';
  if (m.includes('silk') && m.includes('linen')) return 'in Silk & Linen';
  if (m.includes('silk')) return 'in Pure Silk';
  if (m.includes('linen')) return 'in Pure Linen';
  return '';
}

function isNew(createdAt?: string): boolean {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() < NEW_DAYS * 86_400_000;
}

export default function ProductGrid({
  products,
  currentCategory = 'all',
}: {
  products: Product[];
  currentCategory?: string;
}) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [addedId, setAddedId] = useState<string | null>(null);
  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const { addToCart } = useCart();
  const { toggle, isWished } = useWishlist();

  useEffect(() => {
    fetch(`${API}/api/categories`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Category[]) => setCategories(data.filter(c => c.count > 0)))
      .catch(() => {});
  }, []);

  function selectCategory(slug: string) {
    if (slug === 'all') {
      router.push('/shop');
    } else {
      router.push(`/shop?category=${slug}`);
    }
  }

  function handleAdd(e: React.MouseEvent, product: Product) {
    e.preventDefault();
    e.stopPropagation();
    const hasSizes = product.sizes?.length > 0;
    if (hasSizes) {
      window.location.href = `/product/${product._id}`;
      return;
    }
    addToCart({
      name: product.name,
      price: product.price,
      colour: product.colours?.[0] ?? '',
      size: '',
      quantity: 1,
    });
    setAddedId(product._id);
    setTimeout(() => setAddedId(null), 1500);
  }

  function handleHeart(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    toggle(id);
    setAnimatingId(id);
    setTimeout(() => setAnimatingId(null), 300);
  }

  return (
    <div>
      <div className={styles.filters}>
        <button
          className={`${styles.filterBtn} ${currentCategory === 'all' ? styles.active : ''}`}
          onClick={() => selectCategory('all')}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat.slug}
            className={`${styles.filterBtn} ${currentCategory === cat.slug ? styles.active : ''}`}
            onClick={() => selectCategory(cat.slug)}
          >
            {cat.label.toUpperCase()}
          </button>
        ))}
      </div>

      {products.length === 0 ? (
        <p className={styles.emptyState}>
          No products in this category yet — check back soon.
        </p>
      ) : (
        <div className={styles.grid}>
          {products.map(product => {
            const hasSizes = product.sizes?.length > 0;
            const isAdded = addedId === product._id;
            const wished = isWished(product._id);
            const animating = animatingId === product._id;
            const materialSub = getMaterialSub(product.materialComposition);
            const showNew = isNew(product.createdAt);

            const primaryImg = product.images?.find(i => i.isPrimary)
              ?? product.images?.[0]
              ?? null;
            const secondImg = product.images?.find(i => !i.isPrimary && i !== primaryImg)
              ?? (product.images && product.images.length > 1 ? product.images[1] : null);
            const heroUrl = primaryImg?.url ?? product.image ?? null;
            const heroAlt = primaryImg?.alt ?? product.name;

            return (
              <div key={product._id} className={styles.card}>
                <button
                  className={`${styles.heartBtn} ${animating ? styles.heartAnimating : ''}`}
                  onClick={e => handleHeart(e, product._id)}
                  aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
                >
                  <Heart
                    size={22}
                    strokeWidth={1.5}
                    fill={wished ? 'currentColor' : 'none'}
                    className={wished ? styles.heartFilled : ''}
                  />
                </button>

                <Link href={`/product/${product._id}`} className={styles.cardLink}>
                  <div className={styles.cardImg}>
                    {heroUrl && (
                      <img src={heroUrl} alt={heroAlt} className={styles.img} />
                    )}
                    {secondImg?.url && (
                      <img src={secondImg.url} alt={heroAlt} className={`${styles.img} ${styles.imgHover}`} />
                    )}
                    {showNew && <span className={styles.newBadge}>new</span>}
                  </div>
                  <div className={styles.cardInfo}>
                    <h3 className={styles.cardName}>{product.name}</h3>
                    {materialSub && <p className={styles.materialSub}>{materialSub}</p>}
                    <div className={styles.colours}>
                      {product.colours?.map(colour => {
                        const hex = colourToHex(colour);
                        return (
                          <span
                            key={colour}
                            className={styles.colourDot}
                            title={colour}
                            style={hex ? { background: hex, borderColor: hex === '#ffffff' ? '#e0ddd7' : 'transparent' } : undefined}
                          />
                        );
                      })}
                    </div>
                  </div>
                </Link>

                <div className={styles.cardBottom}>
                  <span className={styles.price}>€{Number(product.price).toFixed(2)}</span>
                  <button
                    className={`${styles.plusBtn} ${isAdded ? styles.plusAdded : ''}`}
                    onClick={e => handleAdd(e, product)}
                    aria-label={isAdded ? 'Added to bag' : hasSizes ? 'Select size' : 'Add to bag'}
                  >
                    {isAdded ? '✓' : '+'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
