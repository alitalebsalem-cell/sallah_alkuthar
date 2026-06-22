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
onclick="addToCart('${p.id}')">

🛒 إضافة للسلة

</button>

</div>

`;

});

}

window.addToCart =
function(id){

const product =
allProducts.find(
p => p.id === id
);

if(!product) return;

cart.push(product);

localStorage.setItem(
"cart",
JSON.stringify(cart)
);

renderCart();

};

function renderCart(){

cartItems.innerHTML = "";

cartCount.textContent =
cart.length;

cart.forEach(item=>{

cartItems.innerHTML += `

<div class="cart-item">

<h4>
${item.name}
</h4>

<p>
${item.price} ريال
</p>

</div>

`;

});

}

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
