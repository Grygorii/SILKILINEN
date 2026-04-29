const params = new URLSearchParams(window.location.search);
const productId = parseInt(params.get('id'));
const products = [
  { id: 1, name: 'Silk brief', price: 38, category: 'briefs', colour: 'Ivory', description: 'Delicately crafted from 100% pure mulberry silk. Soft, breathable and luxurious against the skin.' },
  { id: 2, name: 'Lace trim thong', price: 34, category: 'briefs', colour: 'Blush', description: 'A delicate lace trim finish on pure silk. Lightweight and barely-there comfort.' },
  { id: 3, name: 'High waist brief', price: 42, category: 'briefs', colour: 'Midnight', description: 'High waisted silk brief with a smooth, flattering fit. Pure comfort all day.' },
  { id: 4, name: 'Silk bralette set', price: 78, category: 'sets', colour: 'Ivory', description: 'Matching bralette and brief set in pure silk. Effortlessly elegant.' },
  { id: 5, name: 'Camisole set', price: 92, category: 'sets', colour: 'Blush', description: 'Silk camisole and shorts set. Perfect for sleeping or lounging in luxury.' },
  { id: 6, name: 'Silk sleep shirt', price: 110, category: 'nightwear', colour: 'Ivory', description: 'Oversized silk sleep shirt. The most comfortable thing you will ever wear to bed.' },
  { id: 7, name: 'Slip dress', price: 128, category: 'nightwear', colour: 'Champagne', description: 'A classic silk slip dress. Wear it to bed or out — it works both ways.' },
  { id: 8, name: 'Silk eye mask', price: 24, category: 'accessories', colour: 'Ivory', description: 'Pure silk eye mask. Gentle on skin and hair while you sleep.' },
];

const product = products.find(function(p) { return p.id === productId; });
if (product) {
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
            <button class="size-btn" onclick="selectSize(this)">XS</button>
            <button class="size-btn" onclick="selectSize(this)">S</button>
            <button class="size-btn" onclick="selectSize(this)">M</button>
            <button class="size-btn" onclick="selectSize(this)">L</button>
            <button class="size-btn" onclick="selectSize(this)">XL</button>
          </div>
        </div>

        <button class="add-to-cart-btn" onclick="addToCart('${product.name}', ${product.price})">Add to cart</button>
      </div>
    </div>
  `;
} else {
  document.getElementById('productDetail').innerHTML = '<p>Product not found.</p>';
}

function selectSize(btn) {
  document.querySelectorAll('.size-btn').forEach(function(b) {
    b.classList.remove('active');
  });
  btn.classList.add('active');
}