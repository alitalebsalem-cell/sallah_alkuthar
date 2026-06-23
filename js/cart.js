let cart =
JSON.parse(
localStorage.getItem("cart")
) || [];

const cartItems =
document.getElementById(
"cartItems"
);

const cartTotal =
document.getElementById(
"cartTotal"
);

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
${item.name}
</h3>

<p>
${item.description || ""}
</p>

<p>
SKU / ${item.code}
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

</div>

<button
onclick="deleteItem('${item.id}')">

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
PDF
========================== */

document
.getElementById("createInvoice")
.addEventListener(
"click",
()=>{

if(cart.length===0){

alert(
"Cart Empty"
);

return;

}

const { jsPDF } =
window.jspdf;

const pdf =
new jsPDF(
"P",
"mm",
"A4"
);

const invoiceNo =

"INV-" +

Math.floor(
1000 +
Math.random()*9000
);

const customer =

document
.getElementById(
"customerName"
)
.value ||

"WALK-IN";

const date =
new Date()
.toLocaleString();

/* بيانات الفاتورة */

pdf.setFontSize(14);

pdf.text(
"Al Kawthar Store",
70,
20
);

pdf.setFontSize(11);

pdf.text(
`Invoice No: ${invoiceNo}`,
14,
35
);

pdf.text(
`Date: ${date}`,
14,
43
);

pdf.text(
`Customer: ${customer}`,
14,
51
);

/* الجدول */

const rows = [];

let total = 0;

cart.forEach(item=>{

total += item.qty;

rows.push([

item.code || "",

item.name || "",

item.description || "",

item.qty || 1

]);

});

pdf.autoTable({

startY:60,

head:[[
"SKU",
"Arabic Name",
"English Name",
"Qty"
]],

body:rows,

styles:{

fontSize:9,

halign:"center"

},

headStyles:{

fillColor:[10,143,90]

}

});

const finalY =

pdf.lastAutoTable.finalY
+ 10;

pdf.setFontSize(12);

pdf.text(

`Items: ${total}`,

14,

finalY

);

pdf.save(
`${invoiceNo}.pdf`
);

});

renderCart();
