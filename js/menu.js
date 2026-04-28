console.log('menu.js loaded');

const hamburger = document.getElementById('hamburger');
const sideMenu = document.getElementById('sideMenu');
const menuOverlay = document.getElementById('menuOverlay');
const menuClose = document.getElementById('menuClose');

hamburger.addEventListener('click', function() {
  sideMenu.style.left = '';
  sideMenu.classList.toggle('open');
  menuOverlay.classList.toggle('open');
});

menuClose.addEventListener('click', function() {
  sideMenu.style.left = '';
  sideMenu.classList.remove('open');
  menuOverlay.classList.remove('open');
});
menuOverlay.addEventListener('click', function() {
  sideMenu.classList.remove('open');
  menuOverlay.classList.remove('open');
});