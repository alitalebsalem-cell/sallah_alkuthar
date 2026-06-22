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

<p>الكود: ${p.code}</p>

<div class="price">
${p.price} ريال
</div>

<button
class="cart-btn"
data-id="${p.id}">

🛒 إضافة للسلة

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

function addToCart(id){

const product =
allProducts.find(
p => p.id === id
);

if(!product) return;

const existing =
cart.find(
item => item.id === id
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

function saveCart(){

localStorage.setItem(
"cart",
JSON.stringify(cart)
);

renderCart();

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

function renderCart(){

cartItems.innerHTML = "";

let total = 0;

cart.forEach(item=>{

total +=
item.price *
item.qty;

cartItems.innerHTML += `

<div class="cart-item">

<h4>
${item.name}
</h4>

<p>
${item.price} ريال
</p>

<p>

<button onclick="decreaseQty('${item.id}')">
➖
</button>

${item.qty}

<button onclick="increaseQty('${item.id}')">
➕
</button>

</p>

<button
onclick="deleteItem('${item.id}')">

🗑 حذف

</button>

</div>

`;

});

cartCount.textContent =
cart.length;

cartTotal.textContent =
total.toFixed(2);

}

window.increaseQty =
increaseQty;

window.decreaseQty =
decreaseQty;

window.deleteItem =
deleteItem;

document
.getElementById("clearCart")
.addEventListener("click",()=>{

cart = [];

saveCart();

});

document
.querySelectorAll(".cat-btn")
.forEach(btn=>{

btn.addEventListener("click",()=>{

const cat =
btn.dataset.cat;

if(cat==="الكل"){

renderProducts(allProducts);

return;

}

const filtered =
allProducts.filter(
p => p.category === cat
);

renderProducts(filtered);

});

});

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

renderCart();

loadProducts();
