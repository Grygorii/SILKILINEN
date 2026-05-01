'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type Product = {
  _id: string;
  name: string;
  price: number;
  category: string;
  colours: string[];
  image: string;
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/products`)
      .then(res => res.json())
      .then(data => {
        setProducts(data);
        setLoading(false);
      });
  }, []);

  return (
    <AdminLayout active="products">
      <div className={styles.header}>
        <h2>Products</h2>
        <a href="/admin/products/new" className={styles.addBtn}>+ Add product</a>
      </div>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <colgroup>
              <col /><col /><col /><col /><col /><col />
            </colgroup>
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Colours</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product._id}>
                  <td>
                    {product.image ? (
                      <img src={product.image} alt={product.name} className={styles.thumbnail} />
                    ) : (
                      <div className={styles.noImage}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                      </div>
                    )}
                  </td>
                  <td>{product.name}</td>
                  <td>{product.category}</td>
                  <td>€{product.price}</td>
                  <td>
                    <div className={styles.colourTags}>
                      {product.colours.map(c => (
                        <span key={c} className={styles.colourTag}>{c}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <a href={`/admin/products/${product._id}`} className={styles.editBtn}>Edit</a>
                      <button
                        className={styles.deleteBtn}
                        onClick={async () => {
                          if (confirm('Delete this product?')) {
                            await fetch(`${API}/api/products/${product._id}`, {
                              method: 'DELETE',
                              credentials: 'include',
                            });
                            setProducts(products.filter(p => p._id !== product._id));
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
