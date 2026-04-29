let cart = [];
const cartCount = document.querySelector('.nav-cart p');

function updateCartCount() {
  cartCount.textContent = 'Cart (' + cart.length + ')';
}
function addToCart(name, price) {
  cart.push({ name: name, price: price });
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
    cartItemsEl.innerHTML = '<p style="color: var(--muted); font-size: 13px;">Your cart is empty.</p>';
    cartTotalEl.textContent = '€0.00';
    return;
  }


  let total = 0;

  cart.forEach(function(item) {
    total += item.price;
    cartItemsEl.innerHTML += `
  <div class="cart-item">
    <div class="cart-item-img"></div>
    <div class="cart-item-info">
      <p class="cart-item-name">${item.name}</p>
      <p class="cart-item-price">€${item.price}.00</p>
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