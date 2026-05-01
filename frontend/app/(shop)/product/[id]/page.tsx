import type { Metadata } from 'next';
import styles from './page.module.css';
import ProductOptions from '@/components/ProductOptions';

const API = process.env.NEXT_PUBLIC_API_URL;

async function getProduct(id: string) {
  try {
    const res = await fetch(`${API}/api/products/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return { title: 'Product Not Found — SILKILINEN' };
  return {
    title: `${product.name} — SILKILINEN`,
    description: product.description
      ? product.description.slice(0, 155)
      : `Shop ${product.name} at SILKILINEN. Pure silk and linen intimates, shipped worldwide from Dublin.`,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    return (
      <main className={styles.page}>
        <div className={styles.notFound}>
          <p>This product could not be found.</p>
          <a href="/shop" className={styles.back}>← Back to shop</a>
        </div>
      </main>
    );
  }

  const hasSizes = Array.isArray(product.sizes) && product.sizes.length > 0;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || '',
    brand: { '@type': 'Brand', name: 'SILKILINEN' },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'EUR',
      price: Number(product.price).toFixed(2),
      availability: 'https://schema.org/InStock',
      url: `https://silkilinen.vercel.app/product/${id}`,
    },
  };

  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className={styles.inner}>
        <div className={styles.image}>
          <div className={styles.placeholder}></div>
        </div>
        <div className={styles.info}>
          <a href="/shop" className={styles.back}>← Back to shop</a>
          <h1>{product.name}</h1>
          <p className={styles.price}>
            €{Number(product.price).toFixed(2)}
            <span className={styles.vatNote}>incl. VAT</span>
          </p>
          <p className={styles.description}>{product.description}</p>
          {hasSizes && (
            <a href="/size-guide" className={styles.sizeGuideLink} target="_blank" rel="noopener noreferrer">
              Size guide →
            </a>
          )}
          <ProductOptions
            colours={product.colours ?? []}
            sizes={product.sizes ?? []}
            productName={product.name}
            price={product.price}
          />
        </div>
      </div>
    </main>
  );
}
