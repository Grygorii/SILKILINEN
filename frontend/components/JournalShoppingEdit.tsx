import Link from 'next/link';
import ProductCard, { type ProductCardData } from './ProductCard';
import { apiList } from '@/lib/apiFetch';
import styles from './JournalShoppingEdit.module.css';

// Target the article that already attracts search visitors; leave other articles alone.
export default async function JournalShoppingEdit({ slug }: { slug: string }) {
  if (slug !== 'how-to-pack-silk-for-travel-wrinkle-free-tips') return null;
  const products = await apiList<ProductCardData & { status?: string; inStock?: boolean }>(`${process.env.NEXT_PUBLIC_API_URL}/api/products`, { next: { revalidate: 300 } });
  const chosen: ProductCardData[] = [];
  for (const pattern of [/boxer/i, /pillowcase/i, /eyemask|eye mask/i]) {
    const product = products.find(p => p.status === 'active' && p.inStock !== false && pattern.test(p.name) && !chosen.some(x => x._id === p._id));
    if (product) chosen.push(product);
  }
  if (!chosen.length) return null;
  return (
    <section className={styles.section} aria-labelledby="journal-shopping-edit" data-track="journal_shopping_edit" data-journal-article={slug}>
      <p className={styles.eyebrow}>Take a little silk with you</p>
      <h2 id="journal-shopping-edit">For your next journey</h2>
      <p className={styles.intro}>Explore silk pieces for the journey and the slow mornings that follow.</p>
      <div className={styles.grid}>{chosen.map(product => <ProductCard key={product._id} product={product} showHeart={false} />)}</div>
      <Link href="/shop" className={styles.link} data-track="journal_shop_collection">Explore the collection</Link>
    </section>
  );
}
