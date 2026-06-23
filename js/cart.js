let cart =
JSON.parse(
localStorage.getItem("cart")
) || [];

const cartItems =
document.getElementById("cartItems");

const cartTotal =
document.getElementById("cartTotal");

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
onerror="this.src='https://via.placeholder.com/120'">

<div class="info">

<h3>
${item.name || ""}
</h3>

<p>
${item.description || ""}
</p>

<p>
SKU : ${item.code || ""}
</p>

<div>

<button onclick="decreaseQty('${item.id}')">
➖
</button>

<span>
${item.qty}
</span>

<button onclick="increaseQty('${item.id}')">
➕
</button>

</div>

</div>

<button onclick="deleteItem('${item.id}')">
🗑
</button>

</div>

`;

});

cartTotal.textContent =
totalProducts;

localStorage.setItem(
"cart",
JSON.stringify(cart)
);

}

/* ==========================
QUANTITY
========================== */

window.increaseQty =
function(id){

const item =
cart.find(
p => p.id === id
);

if(item){

item.qty++;

renderCart();

}

};

window.decreaseQty =
function(id){

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

renderCart();

};

window.deleteItem =
function(id){

cart =
cart.filter(
p => p.id !== id
);

renderCart();

};

/* ==========================
WHATSAPP
========================== */

document
.getElementById("whatsappBtn")
.addEventListener(
"click",
()=>{

window.open(
"https://wa.me/966538647362",
"_blank"
);

});
/* ==========================
CREATE PDF
========================== */

document
.getElementById("createInvoice")
.addEventListener(
"click",
async()=>{

if(cart.length===0){

alert("السلة فارغة");

return;

}

const invoiceNo =

"INV-" +

Math.floor(
1000 +
Math.random()*9000
);

document
.getElementById("invoiceNo")
.textContent =
invoiceNo;

document
.getElementById("invoiceDate")
.textContent =
new Date().toLocaleString();

document
.getElementById("invoiceCustomer")
.textContent =

document
.getElementById("customerName")
.value ||

"WALK-IN";

const invoiceBody =
document.getElementById(
"invoiceBody"
);

invoiceBody.innerHTML = "";

let total = 0;

cart.forEach(item=>{

total += item.qty;

let productImage =
"images/noimg.jpg";

try{

if(

item.image &&
typeof item.image === "string" &&
item.image.trim() !== ""

){

productImage =
item.image;

}

}catch(e){

productImage =
"images/noimg.jpg";

}

invoiceBody.innerHTML += `

<tr>

<td class="img-cell">

<img
src="${productImage}"
crossorigin="anonymous"
referrerpolicy="no-referrer"
onerror="this.onerror=null;this.src='images/noimg.jpg';">

</td>

<td>

${item.code || ""}

</td>

<td>

<strong>

${item.name || ""}

</strong>

<br>

${item.description || ""}

</td>

<td>

${item.qty}

</td>

</tr>

`;

});

document
.getElementById("invoiceTotal")
.textContent =
total;

const invoice =
document.getElementById(
"invoiceTemplate"
);

/* إصلاح الصور قبل إنشاء PDF */

invoice
.querySelectorAll("img")
.forEach(img=>{

if(
!img.src ||
img.src === ""
){

img.src =
"images/noimg.jpg";

}

});

const images =
invoice.querySelectorAll("img");

await Promise.all(

Array.from(images).map(img=>{

return new Promise(resolve=>{

if(img.complete){

resolve();

return;

}

img.onload = ()=>resolve();

img.onerror = ()=>{

img.src =
"images/noimg.jpg";

resolve();

};

setTimeout(
resolve,
2000
);

});

})

);

const canvas =
await html2canvas(
invoice,
{
scale:2,
useCORS:true,
backgroundColor:"#ffffff"
}
);

const imgData =
canvas.toDataURL(
"image/png"
);

const pdf =
new window.jspdf.jsPDF(
"P",
"mm",
"A4"
);

const pageWidth = 210;

const pageHeight =
(canvas.height * pageWidth)
/ canvas.width;

pdf.addImage(
imgData,
"PNG",
0,
0,
pageWidth,
pageHeight
);

pdf.save(
invoiceNo + ".pdf"
);

});
