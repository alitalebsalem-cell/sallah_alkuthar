import { db } from "./firebase.js";

import {
collection,
addDoc
}
from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

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

await addDoc(
collection(db,"products"),
product
);

alert("تم إضافة المنتج");

});
