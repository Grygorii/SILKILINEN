'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, Plus, Check } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { isValidImageUrl } from '@/lib/imageUtils';
import ProductImage from './products/ProductImage';
import styles from './ProductGrid.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type ProductImageData = { url: string; isPrimary?: boolean; alt?: string; order?: number };
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
  images?: ProductImageData[];
  image?: string;
};

const NEW_DAYS = 30;

function getMaterialSub(mat?: string): string {
  if (!mat) return '';
  const m = mat.toLowerCase();
  if (m.includes('mulberry silk')) return 'in mulberry silk';
  if (m.includes('silk satin')) return 'in silk satin';
  if (m.includes('silk') && m.includes('linen')) return 'in silk & linen';
  if (m.includes('silk')) return 'in pure silk';
  if (m.includes('linen')) return 'in pure linen';
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
      productId: product._id,
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
        <div className={styles.emptyState}>
          <p className={styles.emptyStateText}>
            No products in this category yet — check back soon.
          </p>
          <button
            className={styles.emptyStateBtn}
            onClick={() => selectCategory('all')}
          >
            Browse all products
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {products.map(product => {
            const hasSizes = product.sizes?.length > 0;
            const isAdded = addedId === product._id;
            const wished = isWished(product._id);
            const animating = animatingId === product._id;
            const materialSub = getMaterialSub(product.materialComposition);
            const showNew = isNew(product.createdAt);

            const validImages = product.images?.filter(i => isValidImageUrl(i.url)) ?? [];
            const primaryImg = validImages.find(i => i.isPrimary) ?? validImages[0] ?? null;
            const heroUrl = primaryImg?.url ?? (isValidImageUrl(product.image) ? product.image : null);
            const heroAlt = primaryImg?.alt ?? product.name;

            return (
              <div key={product._id} className={styles.card}>
                <button
                  className={`${styles.heartBtn} ${animating ? styles.heartAnimating : ''}`}
                  onClick={e => handleHeart(e, product._id)}
                  aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
                >
                  <Heart
                    size={18}
                    strokeWidth={1.5}
                    fill={wished ? 'currentColor' : 'none'}
                    className={wished ? styles.heartFilled : ''}
                  />
                </button>

                <Link href={`/product/${product._id}`} className={styles.cardLink}>
                  <div className={styles.cardImg}>
                    <ProductImage
                      src={heroUrl}
                      alt={heroAlt}
                      variant="card"
                    />
                    {showNew && <span className={styles.newBadge}>new</span>}
                  </div>
                </Link>

                <div className={styles.caption}>
                  <h3 className={styles.cardName} title={product.name}>{product.name}</h3>
                  {materialSub && <p className={styles.materialSub}>{materialSub}</p>}
                  <div className={styles.priceRow}>
                    <span className={styles.price}>€{Number(product.price).toFixed(2)}</span>
                    <button
                      className={styles.plusIconBtn}
                      onClick={e => handleAdd(e, product)}
                      aria-label={isAdded ? 'Added to bag' : hasSizes ? 'Select size' : 'Add to bag'}
                    >
                      {isAdded
                        ? <Check size={18} strokeWidth={1.5} />
                        : <Plus size={18} strokeWidth={1.5} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
