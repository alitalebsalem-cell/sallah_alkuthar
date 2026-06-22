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
document
.getElementById("createInvoice")
.addEventListener("click", createInvoice);

function createInvoice(){

const customerName =
document.getElementById("customerName").value || "غير محدد";

if(cart.length === 0){

alert("السلة فارغة");

return;

}

let invoiceNo =
"INV-" +
Date.now();

let date =
new Date()
.toLocaleString("ar-SA");

let total = 0;

let productsRows = "";

cart.forEach(item=>{

const lineTotal =
item.price * item.qty;

total += lineTotal;

productsRows += `

<tr>

<td>${item.name}</td>

<td>${item.code}</td>

<td>${item.qty}</td>

<td>${item.price}</td>

<td>${lineTotal.toFixed(2)}</td>

</tr>

`;

});

const invoiceWindow =
window.open("","_blank");

invoiceWindow.document.write(`

<html dir="rtl">

<head>

<title>فاتورة</title>

<style>

body{
font-family:tahoma;
padding:30px;
}

.header{
text-align:center;
margin-bottom:20px;
}

.logo{
width:120px;
}

.info{
display:flex;
justify-content:space-between;
margin:20px 0;
}

table{
width:100%;
border-collapse:collapse;
margin-top:20px;
}

th,td{
border:1px solid #ddd;
padding:10px;
text-align:center;
}

th{
background:#0a8f5a;
color:white;
}

.total{
margin-top:20px;
font-size:24px;
font-weight:bold;
text-align:left;
}

.qr{
margin-top:20px;
text-align:center;
}

</style>

</head>

<body>

<div class="header">

<img
src="images/logo.png"
class="logo">

<h1>
تموينات سلة الكوثر
</h1>

</div>

<div class="info">

<div>
رقم الفاتورة:
<br>
${invoiceNo}
</div>

<div>
التاريخ:
<br>
${date}
</div>

<div>
العميل:
<br>
${customerName}
</div>

</div>

<div class="qr">

<img
src="images/whatsapp-qr.png"
width="120">

<br>

966538647362+

</div>

<table>

<tr>

<th>المنتج</th>

<th>الكود</th>

<th>الكمية</th>

<th>السعر</th>

<th>الإجمالي</th>

</tr>

${productsRows}

</table>

<div class="total">

الإجمالي:
${total.toFixed(2)}
ريال

</div>

</body>

</html>

`);

invoiceWindow.document.close();

invoiceWindow.print();

}
renderCart();

loadProducts();
