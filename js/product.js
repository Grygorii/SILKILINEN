const params = new URLSearchParams(window.location.search);
const productId = params.get('id');

async function loadProduct() {
  try {
    const response = await fetch('http://localhost:3000/api/products/' + productId);
    const product = await response.json();

    document.title = product.name + ' — SILKILINEN';

    document.getElementById('productDetail').innerHTML = `
      <div class="product-detail-inner">
        <div class="product-detail-img">
          <div class="product-detail-placeholder"></div>
        </div>
        <div class="product-detail-info">
          <a href="shop.html" class="back-link">← Back to shop</a>
          <h1>${product.name}</h1>
          <p class="product-detail-colour">${product.colour}</p>
          <p class="product-detail-price">€${product.price}.00</p>
          <p class="product-detail-desc">${product.description}</p>
          <div class="size-picker">
            <p>Size</p>
            <div class="sizes">
              ${product.sizes.map(function(size) {
                return `<button class="size-btn" onclick="selectSize(this)">${size}</button>`;
              }).join('')}
            </div>
          </div>
          <button class="add-to-cart-btn" onclick="addToCart('${product.name}', ${product.price})">Add to cart</button>
        </div>
      </div>
    `;
  } catch (err) {
    document.getElementById('productDetail').innerHTML = '<p>Product not found.</p>';
    console.log('Error:', err);
  }
}

function selectSize(btn) {
  document.querySelectorAll('.size-btn').forEach(function(b) {
    b.classList.remove('active');
  });
  btn.classList.add('active');
}

loadProduct();