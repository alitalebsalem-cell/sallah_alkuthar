import { db } from "./firebase.js";

import {
collection,
getDocs
}
from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const productsDiv =
document.getElementById("products");

async function loadProducts(){

productsDiv.innerHTML = "";

const querySnapshot =
await getDocs(
collection(db,"products")
);

querySnapshot.forEach(doc=>{

const p = doc.data();

productsDiv.innerHTML += `

<div class="product">

<img
src="${p.image}"
onerror="this.src='https://via.placeholder.com/300x300?text=No+Image'">

<h3>${p.name}</h3>

<p>${p.description || ""}</p>

<p>الكود: ${p.code || ""}</p>

<div class="price">

${p.price} ريال

</div>

<button class="cart-btn">

🛒 إضافة للسلة

</button>

</div>

`;

});

}

loadProducts();
