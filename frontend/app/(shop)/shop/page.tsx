import ProductGrid from '@/components/ProductGrid';

async function getProducts() {
  const res = await fetch('https://silkilinen-production.up.railway.app/api/products');
  const products = await res.json();
  return products;
}

export default async function ShopPage() {
  const products = await getProducts();

  return (
    <main style={{ padding: '60px 6%' }}>
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: '36px', fontWeight: 400, letterSpacing: '2px' }}>All products</h1>
        <p style={{ fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--muted)' }}>Handpicked silk & linen pieces</p>
      </div>
      <ProductGrid products={products} />
    </main>
  );
}