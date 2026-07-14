import { db } from "./firebase.js";

import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

let allProducts = [];

let cart = JSON.parse(localStorage.getItem("cart")) || [];

let activeModalProductId = null;
let modalSelectedQty = 1;

const productsDiv = document.getElementById("products");
const searchInput = document.getElementById("search");
const cartCount = document.getElementById("cartCount");

const productModal = document.getElementById("productModal");
const closeProductModalButton = document.getElementById("closeProductModal");
const modalProductImage = document.getElementById("modalProductImage");
const modalProductCategory = document.getElementById("modalProductCategory");
const modalProductName = document.getElementById("modalProductName");
const modalProductDescription = document.getElementById("modalProductDescription");
const modalProductCode = document.getElementById("modalProductCode");
const modalProductCategoryText = document.getElementById("modalProductCategoryText");
const modalAddToCartButton = document.getElementById("modalAddToCart");
const modalQtyDecreaseButton = document.getElementById("modalQtyDecrease");
const modalQtyIncreaseButton = document.getElementById("modalQtyIncrease");
const modalQtyValue = document.getElementById("modalQtyValue");

const addButtonTimers = new WeakMap();
const ADD_FEEDBACK_TIME = 1300;

/* ==========================
HELPERS
========================== */

function escapeHTML(value){
  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function getItemQty(item){
  const qty = parseInt(item.qty,10);
  return isNaN(qty) || qty < 1 ? 1 : qty;
}

function getProductImage(product){
  if(product.image && typeof product.image === "string" && product.image.trim() !== ""){
    return product.image;
  }

  return "images/noimg.jpg";
}

function getCartTotalQty(){
  return cart.reduce((sum,item)=>sum + getItemQty(item),0);
}

function findProduct(id){
  return allProducts.find(product=>String(product.id) === String(id));
}

function setModalQty(value){
  const qty = parseInt(value,10);

  modalSelectedQty = isNaN(qty) || qty < 1 ? 1 : qty;

  if(modalQtyValue){
    modalQtyValue.textContent = modalSelectedQty;
  }
}

/* ==========================
LOAD PRODUCTS
========================== */
productsDiv.innerHTML = `<div class="products-loading">جاري تحميل المنتجات...</div>`;
async function loadProducts(){
  const querySnapshot = await getDocs(collection(db,"products"));

  allProducts = [];

  querySnapshot.forEach(doc=>{
    allProducts.push({
      id: doc.id,
      ...doc.data()
    });
  });

  renderProducts(allProducts);
}

/* ==========================
RENDER PRODUCTS
========================== */

function renderProducts(products){
  if(!productsDiv) return;

  productsDiv.innerHTML = "";

  products.forEach(product=>{
    productsDiv.insertAdjacentHTML("beforeend",`
      <div class="product">
        <div class="product-image-wrap">
          <img
  src="${escapeHTML(getProductImage(product))}"
  alt="${escapeHTML(product.name || "Product")}"
  loading="lazy"
  decoding="async"
  onerror="this.src='images/noimg.jpg'">

          <button
            class="product-view-btn"
            type="button"
            data-id="${escapeHTML(product.id)}"
            aria-label="عرض تفاصيل المنتج">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2.25 12s3.5-6.25 9.75-6.25S21.75 12 21.75 12s-3.5 6.25-9.75 6.25S2.25 12 2.25 12Z"></path>
              <circle cx="12" cy="12" r="2.75"></circle>
            </svg>
          </button>
        </div>

        <div class="product-content">
          <h3>${escapeHTML(product.name || "")}</h3>

          <p>${escapeHTML(product.description || "")}</p>

          <p class="sku">
            SKU| ${escapeHTML(product.code || "")}
          </p>
        </div>

        <button class="cart-btn" data-id="${escapeHTML(product.id)}" type="button">
          <span class="cart-btn-icon" aria-hidden="true">+</span>
          <span class="cart-btn-label">
            <span>Add To Cart</span>
            <span>إضافة للسلة</span>
          </span>
        </button>
      </div>
    `);
  });
}

/* ==========================
BUTTON FEEDBACK
========================== */

function resetAddButton(button){
  if(!button) return;

  const label = button.querySelector(".cart-btn-label");
  const icon = button.querySelector(".cart-btn-icon");

  button.classList.remove("is-added");

  if(icon){
    icon.textContent = "+";
  }

  if(label){
    label.innerHTML = `
      <span>Add To Cart</span>
      <span>إضافة للسلة</span>
    `;
  }
}

function showAddButtonFeedback(button){
  if(!button) return;

  const label = button.querySelector(".cart-btn-label");
  const icon = button.querySelector(".cart-btn-icon");

  if(addButtonTimers.has(button)){
    clearTimeout(addButtonTimers.get(button));
  }

  button.classList.add("is-added");

  if(icon){
    icon.textContent = "✓";
  }

  if(label){
    label.innerHTML = `
      <span>Added</span>
      <span>تمت الإضافة</span>
    `;
  }

  const timer = setTimeout(()=>{
    resetAddButton(button);
    addButtonTimers.delete(button);
  },ADD_FEEDBACK_TIME);

  addButtonTimers.set(button,timer);
}

/* ==========================
PRODUCT MODAL
========================== */

function openProductModal(id){
  const product = findProduct(id);

  if(!product || !productModal){
    return;
  }

  activeModalProductId = product.id;
  setModalQty(1);

  if(modalProductImage){
    modalProductImage.src = getProductImage(product);
    modalProductImage.alt = product.name || "Product Image";
  }

  if(modalProductCategory){
    modalProductCategory.textContent = product.category || "Product";
  }

  if(modalProductName){
    modalProductName.textContent = product.name || "";
  }

  if(modalProductDescription){
    modalProductDescription.textContent = product.description || "";
  }

  if(modalProductCode){
    modalProductCode.textContent = product.code || "";
  }

  if(modalProductCategoryText){
    modalProductCategoryText.textContent = product.category || "";
  }

  if(modalAddToCartButton){
    modalAddToCartButton.dataset.id = product.id;
    resetAddButton(modalAddToCartButton);
  }

  productModal.hidden = false;
  productModal.setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");

  requestAnimationFrame(()=>{
    productModal.classList.add("active");
  });
}

function closeProductModal(){
  if(!productModal) return;

  productModal.classList.remove("active");
  productModal.setAttribute("aria-hidden","true");
  document.body.classList.remove("modal-open");

  setTimeout(()=>{
    productModal.hidden = true;
    activeModalProductId = null;
  },200);
}

/* ==========================
CART FUNCTIONS
========================== */

function addToCart(id,quantity = 1){
  const product = findProduct(id);

  if(!product) return;

  const addQty = parseInt(quantity,10);
  const finalQty = isNaN(addQty) || addQty < 1 ? 1 : addQty;

  const existing = cart.find(item=>String(item.id) === String(id));

  if(existing){
    existing.qty = getItemQty(existing) + finalQty;
  }else{
    cart.push({
      id: product.id,
      name: product.name || "",
      description: product.description || "",
      code: product.code || "",
      category: product.category || "",
      image: product.image || "images/noimg.jpg",
      qty: finalQty
    });
  }

  updateCartCount();
}

function increaseQty(id){
  const item = cart.find(product=>String(product.id) === String(id));

  if(item){
    item.qty = getItemQty(item) + 1;
    updateCartCount();
  }
}

function decreaseQty(id){
  const item = cart.find(product=>String(product.id) === String(id));

  if(!item) return;

  item.qty = getItemQty(item) - 1;

  if(item.qty <= 0){
    cart = cart.filter(product=>String(product.id) !== String(id));
  }

  updateCartCount();
}

function deleteItem(id){
  cart = cart.filter(product=>String(product.id) !== String(id));
  updateCartCount();
}

/* ==========================
GLOBAL
========================== */

window.increaseQty = increaseQty;
window.decreaseQty = decreaseQty;
window.deleteItem = deleteItem;

/* ==========================
PRODUCT ACTIONS
========================== */

if(productsDiv){
  productsDiv.addEventListener("click",event=>{
    const viewButton = event.target.closest(".product-view-btn");
    const cartButton = event.target.closest(".cart-btn");

    if(viewButton){
      openProductModal(viewButton.dataset.id);
      return;
    }

    if(cartButton){
      addToCart(cartButton.dataset.id,1);
      showAddButtonFeedback(cartButton);
    }
  });
}

if(modalAddToCartButton){
  modalAddToCartButton.addEventListener("click",()=>{
    const id = modalAddToCartButton.dataset.id || activeModalProductId;

    addToCart(id,modalSelectedQty);
    showAddButtonFeedback(modalAddToCartButton);
  });
}

if(modalQtyDecreaseButton){
  modalQtyDecreaseButton.addEventListener("click",()=>{
    setModalQty(modalSelectedQty - 1);
  });
}

if(modalQtyIncreaseButton){
  modalQtyIncreaseButton.addEventListener("click",()=>{
    setModalQty(modalSelectedQty + 1);
  });
}

if(closeProductModalButton){
  closeProductModalButton.addEventListener("click",closeProductModal);
}

if(productModal){
  productModal.addEventListener("click",event=>{
    if(event.target === productModal){
      closeProductModal();
    }
  });
}

document.addEventListener("keydown",event=>{
  if(event.key === "Escape" && productModal && productModal.classList.contains("active")){
    closeProductModal();
  }
});

/* ==========================
SEARCH
========================== */

if(searchInput){
  searchInput.addEventListener("input",()=>{
    const value = searchInput.value.trim().toLowerCase();

    const filtered = allProducts.filter(product=>{
      const productText = `
        ${product.name || ""}
        ${product.description || ""}
        ${product.code || ""}
        ${product.category || ""}
      `.toLowerCase();

      return productText.includes(value);
    });

    renderProducts(filtered);
  });
}

/* ==========================
CATEGORY FILTER
========================== */

document.querySelectorAll(".cat-btn").forEach(button=>{
  button.addEventListener("click",()=>{
    const category = button.dataset.cat;

    if(category === "all"){
      renderProducts(allProducts);
      return;
    }

    const filtered = allProducts.filter(product=>
      (product.category || "")
        .toLowerCase()
        .includes(category.toLowerCase())
    );

    renderProducts(filtered);
  });
});

/* ==========================
CART COUNT
========================== */

function updateCartCount(){
  if(cartCount){
    cartCount.textContent = getCartTotalQty();
  }

  localStorage.setItem("cart",JSON.stringify(cart));
}

/* ==========================
START
========================== */

updateCartCount();
loadProducts();
