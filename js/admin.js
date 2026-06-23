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

updateStats();

}

/* =========================
RENDER PRODUCTS
========================= */
function updateStats(){

document.getElementById(
"totalProducts"
).textContent =
allProducts.length;

document.getElementById(
"foodCount"
).textContent =

allProducts.filter(
p => p.category === "مواد غذائية"
).length;

document.getElementById(
"vegCount"
).textContent =

allProducts.filter(
p => p.category === "خضار"
).length;

document.getElementById(
"detCount"
).textContent =

allProducts.filter(
p => p.category === "منظفات"
).length;

}
function renderProducts(products){

productsTable.innerHTML = "";

products.forEach(product=>{

productsTable.innerHTML += `

<div class="admin-product">

<img
src="${product.image}"
onerror="this.src='https://via.placeholder.com/120'">

<div class="admin-info">

<h3>

${product.name}

</h3>

<p>

${product.description || ""}

</p>

<p>

SKU / ${product.code}

</p>

<p>

${product.category}

</p>

</div>

<div class="admin-actions">

<button
class="edit-btn"
onclick="editProduct('${product.id}')">

✏️ Edit

</button>

<button
class="delete-btn"
onclick="deleteProduct('${product.id}')">

🗑 Delete

</button>

</div>

</div>

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
/* =========================
IMPORT EXCEL
========================= */

document
.getElementById("importExcel")
.addEventListener("click",()=>{

document
.getElementById("excelFile")
.click();

});

document
.getElementById("excelFile")
.addEventListener(
"change",
async(event)=>{

const file =
event.target.files[0];

if(!file) return;

const data =
await file.arrayBuffer();

const workbook =
XLSX.read(data);

const sheet =
workbook.Sheets[
workbook.SheetNames[0]
];

const products =
XLSX.utils.sheet_to_json(
sheet
);



/* يبدأ من 10000 */
const snapshot =
await getDocs(
collection(db,"products")
);

let maxCode = 9999;

snapshot.forEach(doc=>{

const code =
parseInt(
doc.data().code
);

if(
!isNaN(code)
&&
code > maxCode
){

maxCode = code;

}

});

let nextCode =
maxCode + 1;
/* البحث عن أكبر كود موجود */

const snapshot =
await getDocs(
collection(db,"products")
);

let maxCode = 9999;

snapshot.forEach(doc=>{

const code =
parseInt(
doc.data().code
);

if(
!isNaN(code)
&&
code > maxCode
){

maxCode = code;

}

});

let nextCode =
maxCode + 1;
  const existingProducts =
allProducts.map(p =>

(
p.name || ""
)
.trim()
.toLowerCase()

);
for(const product of products){

const productName =

(
product.name || ""
)
.trim()
.toLowerCase();

if(
existingProducts.includes(
productName
)
){

continue;

}

await addDoc(
collection(db,"products"),


{

name:
product.name || "",

description:
product.description || "",

code:
(nextCode++).toString(),

category:
product.category || "",

image:
product.image || "",

createdAt:
Date.now()

}

);

imported++;

}

alert(
`${imported} Products Imported Successfully`
);
/* =========================
EXPORT EXCEL
========================= */

document
.getElementById("exportExcel")
.addEventListener(
"click",
()=>{

const data =

allProducts.map(product=>({

name:
product.name || "",

description:
product.description || "",

code:
product.code || "",

category:
product.category || "",

image:
product.image || ""

}));

const worksheet =
XLSX.utils.json_to_sheet(
data
);

const workbook =
XLSX.utils.book_new();

XLSX.utils.book_append_sheet(
workbook,
worksheet,
"Products"
);

XLSX.writeFile(
workbook,
"products.xlsx"
);

});
loadProducts();

});
