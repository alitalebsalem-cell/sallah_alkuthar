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

<p>

الكود:

${p.code}

</p>

<div class="price">

${p.price}

⃁

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

let total = 0;

cart.forEach(item=>{

const itemTotal =
item.price *
item.qty;

total += itemTotal;

cartItems.innerHTML += `

<div class="cart-item">

<h4>

${item.name}

</h4>

<p>

${item.code}

</p>

<p>

${item.price} ⃁

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

<p>

${itemTotal.toFixed(2)} ⃁

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

document
.getElementById("clearCart")
.addEventListener("click",()=>{

cart = [];

saveCart();

});

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

if(cat==="الكل"){

renderProducts(
allProducts
);

return;

}

const filtered =
allProducts.filter(
p => p.category === cat
);

renderProducts(
filtered
);

});

});

/* ==========================
OPEN CART
========================== */

document
.getElementById("cartToggle")
.addEventListener("click",()=>{

document
.getElementById("cartSidebar")
.classList
.add("active");

});

document
.getElementById("closeCart")
.addEventListener("click",()=>{

document
.getElementById("cartSidebar")
.classList
.remove("active");

});

/* ==========================
INVOICE
========================== */

document
.getElementById("createInvoice")
.addEventListener("click",
async ()=>{

if(cart.length===0){

alert(
"السلة فارغة"
);

return;

}

const customerName =

document
.getElementById(
"customerName"
)
.value ||

"WALK-IN";

const invoiceNo =

"INV-" +

Math.floor(
1000 +
Math.random()*9000
);

const invoiceDate =

new Date()
.toLocaleString();

document
.getElementById(
"invoiceNo"
)
.textContent =
invoiceNo;

document
.getElementById(
"invoiceDate"
)
.textContent =
invoiceDate;

document
.getElementById(
"invoiceCustomer"
)
.textContent =
customerName;

const invoiceBody =

document
.getElementById(
"invoiceBody"
);

invoiceBody.innerHTML = "";

let total = 0;

cart.forEach(item=>{

const lineTotal =

item.price *
item.qty;

total += lineTotal;

invoiceBody.innerHTML += `

<tr>

<td>

${item.code}

</td>

<td>

<b>

${item.name}

</b>

<br>

<small>

${item.description || ""}

</small>

</td>

<td>

${item.qty}.00

</td>

<td>

${item.price} ⃁

</td>

<td>

${lineTotal.toFixed(2)} ⃁

</td>

</tr>

`;

});

document
.getElementById(
"invoiceTotal"
)
.textContent =

total.toFixed(2);

const invoice =

document
.getElementById(
"invoiceTemplate"
);

invoice.style.display =
"block";

const canvas =
await html2canvas(
invoice,
{
scale:3,
useCORS:true
}
);

const imgData =
canvas.toDataURL(
"image/png"
);

const { jsPDF } =
window.jspdf;

const pdf =
new jsPDF(
"P",
"mm",
"A4"
);

const imgWidth = 190;

const imgHeight =

(canvas.height *
imgWidth)
/
canvas.width;

pdf.addImage(
imgData,
"PNG",
10,
10,
imgWidth,
imgHeight
);

pdf.save(
`${invoiceNo}.pdf`
);

invoice.style.display =
"none";

});

/* ==========================
START
========================== */

renderCart();

loadProducts();
