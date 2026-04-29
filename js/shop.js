const products = [
  { id: 1, name: 'Silk brief', price: 38, category: 'briefs', colour: 'Ivory' },
  { id: 2, name: 'Lace trim thong', price: 34, category: 'briefs', colour: 'Blush' },
  { id: 3, name: 'High waist brief', price: 42, category: 'briefs', colour: 'Midnight' },
  { id: 4, name: 'Silk bralette set', price: 78, category: 'sets', colour: 'Ivory' },
  { id: 5, name: 'Camisole set', price: 92, category: 'sets', colour: 'Blush' },
  { id: 6, name: 'Silk sleep shirt', price: 110, category: 'nightwear', colour: 'Ivory' },
  { id: 7, name: 'Slip dress', price: 128, category: 'nightwear', colour: 'Champagne' },
  { id: 8, name: 'Silk eye mask', price: 24, category: 'accessories', colour: 'Ivory' },
];
function renderProducts(filter) {
  const grid = document.getElementById('productsGrid');
  
  const filtered = filter === 'all' 
    ? products 
    : products.filter(function(p) { return p.category === filter; });

  grid.innerHTML = filtered.map(function(product) {
    return `
  <div class="product-card">
    <a href="product.html?id=${product.id}">
      <div class="product-img"></div>
    </a>
    <div class="product-info">
      <a href="product.html?id=${product.id}"><h3>${product.name}</h3></a>
      <p>${product.colour} · XS–XL</p>
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
  renderProducts(category);
}

renderProducts('all');