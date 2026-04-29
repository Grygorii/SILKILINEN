async function loadProducts(filter = 'all') {
  try {
    const response = await fetch('http://localhost:3000/api/products');
    const products = await response.json();

    const filtered = filter === 'all'
      ? products
      : products.filter(function(p) { return p.category === filter; });

    renderProducts(filtered);
  } catch (err) {
    console.log('Error loading products:', err);
  }
}

function renderProducts(products) {
  const grid = document.getElementById('productsGrid');

  grid.innerHTML = products.map(function(product) {
    return `
      <div class="product-card">
        <a href="product.html?id=${product._id}">
          <div class="product-img"></div>
        </a>
        <div class="product-info">
          <a href="product.html?id=${product._id}"><h3>${product.name}</h3></a>
          <div class="product-colours">
            ${product.colours.map(function(colour) {
              return `<span class="colour-dot" title="${colour}"></span>`;
            }).join('')}
          </div>
          <span>€${product.price}.00</span>
          <button class="add-to-cart" onclick="addToCart('${product.name}', ${product.price})">Add to cart</button>
        </div>
      </div>
    `;
  }).join('');
}

function filterProducts(category, btn) {
  document.querySelectorAll('.filter-btn').forEach(function(b) {
    b.classList.remove('active');
  });
  btn.classList.add('active');
  loadProducts(category);
}

loadProducts();