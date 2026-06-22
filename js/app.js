import { db } from "./firebase.js";

import {
collection,
getDocs
}
from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

let allProducts = [];

const productsDiv =
document.getElementById("products");

const searchInput =
document.getElementById("search");

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

<p>${p.description}</p>

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
p=>p.category===cat
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

loadProducts();
