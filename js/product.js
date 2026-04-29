const params = new URLSearchParams(window.location.search);
const productId = params.get('id');
let currentProduct = null;

async function loadProduct() {
  try {
    const response = await fetch('http://localhost:3000/api/products/' + productId);
    const product = await response.json();
    currentProduct = product;

    document.title = product.name + ' — SILKILINEN';

    document.getElementById('productDetail').innerHTML = `
  <div class="product-detail-inner">
    <div class="product-detail-img">
      <div class="product-detail-placeholder"></div>
    </div>
    <div class="product-detail-info">
      <a href="shop.html" class="back-link">← Back to shop</a>
      <h1>${product.name}</h1>
      <p class="product-detail-price">€${product.price}.00</p>
      <p class="product-detail-desc">${product.description}</p>

      <div class="colour-picker">
        <p>Colour</p>
        <div class="colours">
          ${product.colours.map(function(colour) {
            return `<button class="colour-btn" onclick="selectColour(this)">${colour}</button>`;
          }).join('')}
        </div>
      </div>

      <div class="size-picker">
        <p>Size</p>
        <div class="sizes">
          ${product.sizes.map(function(size) {
            return `<button class="size-btn" onclick="selectSize(this)">${size}</button>`;
          }).join('')}
        </div>
      </div>

      <button class="add-to-cart-btn" onclick="addToCartWithOptions()">Add to cart</button>
    </div>
  </div>
`;

  } catch (err) {
    document.getElementById('productDetail').innerHTML = '<p>Product not found.</p>';
    console.log('Error:', err);
  }
}
function selectColour(btn) {
  document.querySelectorAll('.colour-btn').forEach(function(b) {
    b.classList.remove('active');
  });
  btn.classList.add('active');
}

function selectSize(btn) {
  document.querySelectorAll('.size-btn').forEach(function(b) {
    b.classList.remove('active');
  });
  btn.classList.add('active');
}
function addToCartWithOptions() {
  const selectedColour = document.querySelector('.colour-btn.active');
  const selectedSize = document.querySelector('.size-btn.active');
  
  const colour = selectedColour ? selectedColour.textContent : '';
  const size = selectedSize ? selectedSize.textContent : '';
  
  addToCart(currentProduct.name + ' — ' + colour + ' / ' + size, currentProduct.price);
}

loadProduct();