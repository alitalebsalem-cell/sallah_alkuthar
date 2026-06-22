import { db } from "./firebase.js";

import {
collection,
addDoc,
getDocs,
deleteDoc,
updateDoc,
doc
}
from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

let editingId = null;
let allProducts = [];

const productsTable =
document.getElementById("productsTable");

/* =========================
LOAD PRODUCTS
========================= */

async function loadProducts(){

const snapshot =
await getDocs(
collection(db,"products")
);

allProducts = [];

snapshot.forEach(item=>{

allProducts.push({
id:item.id,
...item.data()
});

});

renderProducts(allProducts);

}

/* =========================
RENDER PRODUCTS
========================= */

function renderProducts(products){

productsTable.innerHTML = "";

products.forEach(product=>{

productsTable.innerHTML += `

<div style="
background:white;
padding:15px;
margin:10px 0;
border-radius:12px;
border:1px solid #ddd;
">

<img
src="${product.image}"
width="120"
style="
height:120px;
object-fit:contain;
display:block;
margin:auto;
">

<h3>

${product.name}

</h3>

<p>

${product.description || ""}

</p>

<p>

<b>
Code / الكود:
</b>

${product.code}

</p>

<p>

<b>
Category / القسم:
</b>

${product.category}

</p>

<button
onclick="editProduct('${product.id}')">

✏️ Edit / تعديل

</button>

<button
onclick="deleteProduct('${product.id}')">

🗑 Delete / حذف

</button>

</div>

`;

});

}

/* =========================
CLEAR FORM
========================= */

function clearForm(){

document.getElementById("name").value = "";

document.getElementById("description").value = "";

document.getElementById("code").value = "";

document.getElementById("image").value = "";

document.getElementById("previewImage").src =
"https://via.placeholder.com/150";

}

/* =========================
SAVE PRODUCT
========================= */

document
.getElementById("save")
.addEventListener("click",
async ()=>{

const product = {

name:
document.getElementById("name").value,

description:
document.getElementById("description").value,

code:
document.getElementById("code").value,

category:
document.getElementById("category").value,

image:
document.getElementById("image").value,

createdAt:
Date.now()

};

if(

!product.name ||
!product.code ||
!product.image

){

alert(
"Please fill all required fields / يرجى تعبئة جميع الحقول المطلوبة"
);

return;

}

if(editingId){

await updateDoc(

doc(
db,
"products",
editingId
),

product

);

editingId = null;

alert(
"Product Updated Successfully / تم تعديل المنتج"
);

}else{

await addDoc(

collection(
db,
"products"
),

product

);

alert(
"Product Added Successfully / تم إضافة المنتج"
);

}

clearForm();

loadProducts();

});

/* =========================
DELETE PRODUCT
========================= */

window.deleteProduct =
async function(id){

const ok = confirm(

"Delete Product ?\nهل تريد حذف المنتج ؟"

);

if(!ok) return;

await deleteDoc(

doc(
db,
"products",
id
)

);

loadProducts();

};

/* =========================
EDIT PRODUCT
========================= */

window.editProduct =
function(id){

const product =
allProducts.find(
p => p.id === id
);

if(!product) return;

editingId = id;

document.getElementById("name").value =
product.name;

document.getElementById("description").value =
product.description;

document.getElementById("code").value =
product.code;

document.getElementById("category").value =
product.category;

document.getElementById("image").value =
product.image;

document.getElementById("previewImage").src =
product.image;

window.scrollTo({

top:0,

behavior:"smooth"

});

};

/* =========================
SEARCH
========================= */

document
.getElementById("searchAdmin")
.addEventListener("input",
function(){

const value =
this.value.toLowerCase();

const filtered =
allProducts.filter(product=>

product.name
.toLowerCase()
.includes(value)

||

(product.description || "")
.toLowerCase()
.includes(value)

||

(product.code || "")
.toLowerCase()
.includes(value)

);

renderProducts(filtered);

});

/* =========================
SORT NEWEST
========================= */

document
.getElementById("sortNewest")
.addEventListener("click",()=>{

const sorted =

[...allProducts]

.sort(

(a,b)=>

(b.createdAt || 0)

-

(a.createdAt || 0)

);

renderProducts(sorted);

});

/* =========================
SORT OLDEST
========================= */

document
.getElementById("sortOldest")
.addEventListener("click",()=>{

const sorted =

[...allProducts]

.sort(

(a,b)=>

(a.createdAt || 0)

-

(b.createdAt || 0)

);

renderProducts(sorted);

});

/* =========================
SORT NAME
========================= */

document
.getElementById("sortNameAsc")
.addEventListener("click",()=>{

const sorted =

[...allProducts]

.sort(

(a,b)=>

a.name.localeCompare(
b.name,
"ar"
)

);

renderProducts(sorted);

});

/* =========================
START
========================= */

loadProducts();
