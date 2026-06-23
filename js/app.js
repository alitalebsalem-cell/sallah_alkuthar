import { db } from "./firebase.js";

import {
collection,
getDocs
}
from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

let allProducts = [];

let cart =
JSON.parse(
localStorage.getItem("cart")
) || [];

const productsDiv =
document.getElementById("products");

const searchInput =
document.getElementById("search");

const cartItems =
document.getElementById("cartItems");

const cartCount =
document.getElementById("cartCount");

const cartTotal =
document.getElementById("cartTotal");

/* ==========================
LOAD PRODUCTS
========================== */

async function loadProducts(){

const querySnapshot =
await getDocs(
collection(db,"products")
);

allProducts = [];

querySnapshot.forEach(doc=>{

allProducts.push({
id:doc.id,
...doc.data()
});

});

renderProducts(allProducts);

}

/* ==========================
RENDER PRODUCTS
========================== */
function renderProducts(products){

productsDiv.innerHTML = "";

products.forEach(p=>{

productsDiv.innerHTML += `

<div class="product">

<img
src="${p.image}"
onerror="this.src='https://via.placeholder.com/300'">

<h3>${p.name}</h3>

<p>${p.description || ""}</p>

<p class="sku">

SKU /

${p.code}

</p>
<button
class="cart-btn"
data-id="${p.id}">

🛒 Add To Cart
<br>
إضافة للسلة

</button>

</div>

`;

});

document
.querySelectorAll(".cart-btn")
.forEach(btn=>{

btn.addEventListener("click",()=>{

addToCart(
btn.dataset.id
);

});

});

}

/* ==========================
CART FUNCTIONS
========================== */

function addToCart(id){

const product =
allProducts.find(
p => p.id === id
);

if(!product) return;

const existing =
cart.find(
p => p.id === id
);

if(existing){

existing.qty++;

}else{

cart.push({
...product,
qty:1
});

}

saveCart();

}

function increaseQty(id){

const item =
cart.find(
p => p.id === id
);

if(item){

item.qty++;

saveCart();

}

}

function decreaseQty(id){

const item =
cart.find(
p => p.id === id
);

if(!item) return;

item.qty--;

if(item.qty <= 0){

cart =
cart.filter(
p => p.id !== id
);

}

saveCart();

}

function deleteItem(id){

cart =
cart.filter(
p => p.id !== id
);

saveCart();

}

function saveCart(){

localStorage.setItem(
"cart",
JSON.stringify(cart)
);

renderCart();

}

/* ==========================
RENDER CART
========================== */

function renderCart(){

cartItems.innerHTML = "";

let totalProducts = 0;

cart.forEach(item=>{

totalProducts += item.qty;

cartItems.innerHTML += `

<div class="cart-item">

<img
src="${item.image}"
style="
width:60px;
height:60px;
object-fit:contain;
">

<h4>

${item.name}

</h4>

<p>

Code / الكود:
${item.code}

</p>

<div>

<button
onclick="decreaseQty('${item.id}')">

➖

</button>

<span>

${item.qty}

</span>

<button
onclick="increaseQty('${item.id}')">

➕

</button>

</div>

<button
onclick="deleteItem('${item.id}')">

🗑 Delete / حذف

</button>

</div>

`;

});

cartCount.textContent =
cart.length;

cartTotal.textContent =
totalProducts;

}

/* ==========================
GLOBAL
========================== */

window.increaseQty =
increaseQty;

window.decreaseQty =
decreaseQty;

window.deleteItem =
deleteItem;

/* ==========================
CLEAR CART
========================== */

/* ==========================
SEARCH
========================== */

searchInput
.addEventListener("input",()=>{

const value =
searchInput.value.toLowerCase();

const filtered =
allProducts.filter(p=>

p.name
.toLowerCase()
.includes(value)

);

renderProducts(filtered);

});

/* ==========================
CATEGORY FILTER
========================== */
document
.querySelectorAll(".cat-btn")
.forEach(btn=>{

btn.addEventListener("click",()=>{

const cat =
btn.dataset.cat;

if(cat === "all"){

renderProducts(allProducts);

return;

}

const filtered =
allProducts.filter(product =>

(product.category || "")
.toLowerCase()
.includes(
cat.toLowerCase()
)

);

renderProducts(filtered);

});

});

/* ==========================
OPEN CART
========================== */

const cartToggle =
document.getElementById(
"cartToggle"
);

const cartSidebar =
document.getElementById(
"cartSidebar"
);

const closeCart =
document.getElementById(
"closeCart"
);

if(cartToggle && cartSidebar){

cartToggle.addEventListener(
"click",
(e)=>{

e.preventDefault();

cartSidebar.classList.add(
"active"
);

});

}

if(closeCart && cartSidebar){

closeCart.addEventListener(
"click",
()=>{

cartSidebar.classList.remove(
"active"
);

});

}

/* اغلاق عند الضغط خارج السلة */

document.addEventListener(
"click",
(event)=>{

if(

cartSidebar.classList.contains(
"active"
)

&&

!cartSidebar.contains(
event.target
)

&&

!cartToggle.contains(
event.target
)

){

cartSidebar.classList.remove(
"active"
);

}

});
/* ==========================
INVOICE
========================== */

document
.getElementById("createInvoice")
.addEventListener(
"click",
async ()=>{

alert(
"Invoice Button Works ✅"
);

});
renderCart();

loadProducts();
