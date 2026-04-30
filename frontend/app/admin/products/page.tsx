'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import styles from './page.module.css';

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
    fetch('https://silkilinen-production.up.railway.app/api/products')
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
        <table className={styles.table}>
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
                    <div className={styles.noImage}>No image</div>
                  )}
                </td>
                <td>{product.name}</td>
                <td>{product.category}</td>
                <td>€{product.price}</td>
                <td>{product.colours.join(', ')}</td>
                <td>
                  <a href={`/admin/products/${product._id}`} className={styles.editBtn}>Edit</a>
                  <button
                    className={styles.deleteBtn}
                    onClick={async () => {
                      if (confirm('Delete this product?')) {
                        await fetch(`https://silkilinen-production.up.railway.app/api/products/${product._id}`, {
                          method: 'DELETE'
                        });
                        setProducts(products.filter(p => p._id !== product._id));
                      }
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminLayout>
  );
}