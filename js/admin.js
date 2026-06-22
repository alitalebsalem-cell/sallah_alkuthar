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

const productsTable =
document.getElementById("productsTable");

document
.getElementById("save")
.addEventListener("click", async ()=>{

const product = {

name:
document.getElementById("name").value,

description:
document.getElementById("description").value,

code:
document.getElementById("code").value,

price:
Number(
document.getElementById("price").value
),

category:
document.getElementById("category").value,

image:
document.getElementById("image").value,

createdAt:
Date.now()

};

if(editingId){

await updateDoc(
doc(db,"products",editingId),
product
);

editingId = null;

alert("تم تعديل المنتج");

}else{

await addDoc(
collection(db,"products"),
product
);

alert("تم إضافة المنتج");

}

clearForm();

loadProducts();

});

function clearForm(){

document.getElementById("name").value = "";

document.getElementById("description").value = "";

document.getElementById("code").value = "";

document.getElementById("price").value = "";

document.getElementById("image").value = "";

}

async function loadProducts(){

const snapshot =
await getDocs(
collection(db,"products")
);

productsTable.innerHTML = "";

snapshot.forEach(item=>{

const p = item.data();

productsTable.innerHTML += `

<div style="
background:white;
padding:15px;
margin:10px 0;
border-radius:10px;
border:1px solid #ddd;
">

<img
src="${p.image}"
width="100"
style="
height:100px;
object-fit:contain;
">

<h3>${p.name}</h3>

<p>${p.description || ""}</p>

<p><b>الكود:</b> ${p.code}</p>

<p><b>القسم:</b> ${p.category}</p>

<p><b>السعر:</b> ${p.price} ريال</p>

<button
onclick="editProduct('${item.id}')">

✏️ تعديل

</button>

<button
onclick="deleteProduct('${item.id}')">

🗑 حذف

</button>

</div>

`;

});

}

window.deleteProduct =
async function(id){

const result =
confirm("هل تريد حذف المنتج؟");

if(!result) return;

await deleteDoc(
doc(db,"products",id)
);

loadProducts();

};

window.editProduct =
async function(id){

const snapshot =
await getDocs(
collection(db,"products")
);

snapshot.forEach(item=>{

if(item.id === id){

const p = item.data();

editingId = id;

document.getElementById("name").value =
p.name;

document.getElementById("description").value =
p.description;

document.getElementById("code").value =
p.code;

document.getElementById("price").value =
p.price;

document.getElementById("category").value =
p.category;

document.getElementById("image").value =
p.image;

window.scrollTo({
top:0,
behavior:"smooth"
});

}

});

};

loadProducts();
