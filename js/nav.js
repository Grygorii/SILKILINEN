.cart-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  z-index: 200;
}

.cart-panel {
  position: fixed;
  top: 0;
  right: -420px;
  width: 380px;
  height: 100%;
  background: var(--warm-white);
  z-index: 300;
  transition: right 0.3s ease;
  display: flex;
  flex-direction: column;
}

.cart-panel.open {
  right: 0;
}

.cart-overlay.open {
  display: block;
}

.cart-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 28px;
  border-bottom: 1px solid var(--border);
}

.cart-panel-header h3 {
  font-family: var(--serif);
  font-size: 20px;
  font-weight: 400;
  letter-spacing: 2px;
}

.cart-close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: var(--dark);
}

.cart-items {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px;
}

.cart-footer {
  padding: 24px 28px;
  border-top: 1px solid var(--border);
}

.cart-total {
  display: flex;
  justify-content: space-between;
  font-size: 15px;
  margin-bottom: 20px;
}

.cart-checkout {
  width: 100%;
  padding: 14px;
  background: var(--dark);
  color: var(--warm-white);
  border: none;
  font-family: var(--sans);
  font-size: 11px;
  letter-spacing: 3px;
  text-transform: uppercase;
  cursor: pointer;
  transition: opacity 0.3s ease;
}

.cart-checkout:hover {
  opacity: 0.8;
}