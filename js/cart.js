let cart = [];
const cartCount = document.querySelector('.nav-cart p');

function updateCartCount() {
  cartCount.textContent = 'Cart (' + cart.length + ')';
}
function addToCart(name, price) {
  const existing = cart.find(function(item) {
    return item.name === name;
  });

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ name: name, price: price, quantity: 1 });
  }

  updateCartCount();
}
const cartPanel = document.getElementById('cartPanel');
const cartOverlay = document.getElementById('cartOverlay');
const cartClose = document.getElementById('cartClose');
const cartItemsEl = document.getElementById('cartItems');
const cartTotalEl = document.getElementById('cartTotal');

document.querySelector('.nav-cart').addEventListener('click', function() {
  cartPanel.classList.add('open');
  cartOverlay.classList.add('open');
  renderCart();
});

cartClose.addEventListener('click', function() {
  cartPanel.classList.remove('open');
  cartOverlay.classList.remove('open');
});

cartOverlay.addEventListener('click', function() {
  cartPanel.classList.remove('open');
  cartOverlay.classList.remove('open');
});
function renderCart() {
  cartItemsEl.innerHTML = '';
  
if (cart.length === 0) {
  cartItemsEl.innerHTML = `
    <div class="cart-empty">
      <p>Your cart is empty.</p>
      <p>Discover our collection and find something you love.</p>
      <button onclick="document.getElementById('cartPanel').classList.remove('open'); document.getElementById('cartOverlay').classList.remove('open');" class="cart-empty-btn">Shop now</button>
    </div>
  `;
  cartTotalEl.textContent = '€0.00';
  return;
}


  let total = 0;

  cart.forEach(function(item) {
    total += item.price * item.quantity;
    cartItemsEl.innerHTML += `
  <div class="cart-item">
    <div class="cart-item-img"></div>
    <div class="cart-item-info">
      <p class="cart-item-name">${item.name}</p>
      <p class="cart-item-price">€${item.price * item.quantity}.00</p>
      <div class="cart-item-qty">
        <button onclick="changeQty('${item.name}', -1)">−</button>
        <span>${item.quantity}</span>
        <button onclick="changeQty('${item.name}', 1)">+</button>
      </div>
    </div>
    <button class="cart-item-remove" onclick="removeFromCart(${cart.indexOf(item)})">✕</button>
  </div>
`;
  });

  cartTotalEl.textContent = '€' + total + '.00';
}
  function removeFromCart(index) {
  cart.splice(index, 1);
  updateCartCount();
  renderCart();
}
function changeQty(name, change) {
  const item = cart.find(function(i) { return i.name === name; });
  item.quantity += change;
  if (item.quantity === 0) {
    cart.splice(cart.indexOf(item), 1);
  }
  updateCartCount();
  renderCart();
}