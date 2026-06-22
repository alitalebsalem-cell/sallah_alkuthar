import { db } from "./firebase.js";

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

let editingId = null;
let allProducts = [];

const productsTable = document.getElementById("productsTable");

async function loadProducts() {

  const snapshot = await getDocs(
    collection(db, "products")
  );

  allProducts = [];

  snapshot.forEach(item => {

    allProducts.push({
      id: item.id,
      ...item.data()
    });

  });

  renderProducts(allProducts);

}

function renderProducts(products) {

  productsTable.innerHTML = "";

  products.forEach(product => {

    productsTable.innerHTML += `

      <div style="
      background:white;
      padding:15px;
      margin:10px 0;
      border-radius:10px;
      border:1px solid #ddd;
      ">

        <img
        src="${product.image}"
        width="100"
        style="
        height:100px;
        object-fit:contain;
        ">

        <h3>${product.name}</h3>

        <p>${product.description || ""}</p>

        <p><b>الكود:</b> ${product.code}</p>

        <p><b>القسم:</b> ${product.category}</p>

        <p><b>السعر:</b> ${product.price} ريال</p>

        <button onclick="editProduct('${product.id}')">
          ✏️ تعديل
        </button>

        <button onclick="deleteProduct('${product.id}')">
          🗑 حذف
        </button>

      </div>

    `;

  });

}

function clearForm() {

  document.getElementById("name").value = "";
  document.getElementById("description").value = "";
  document.getElementById("code").value = "";
  document.getElementById("price").value = "";
  document.getElementById("image").value = "";

}

document
.getElementById("save")
.addEventListener("click", async () => {

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

  if (editingId) {

    await updateDoc(
      doc(db, "products", editingId),
      product
    );

    editingId = null;

    alert("تم تعديل المنتج");

  } else {

    await addDoc(
      collection(db, "products"),
      product
    );

    alert("تم إضافة المنتج");

  }

  clearForm();

  loadProducts();

});

window.deleteProduct =
async function (id) {

  if (!confirm("هل تريد حذف المنتج؟"))
    return;

  await deleteDoc(
    doc(db, "products", id)
  );

  loadProducts();

};

window.editProduct =
function (id) {

  const product =
    allProducts.find(
      p => p.id === id
    );

  if (!product) return;

  editingId = id;

  document.getElementById("name").value =
    product.name;

  document.getElementById("description").value =
    product.description;

  document.getElementById("code").value =
    product.code;

  document.getElementById("price").value =
    product.price;

  document.getElementById("category").value =
    product.category;

  document.getElementById("image").value =
    product.image;

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

};

document
.getElementById("searchAdmin")
.addEventListener("input", function () {

  const value =
    this.value.toLowerCase();

  const filtered =
    allProducts.filter(product =>
      product.name
        .toLowerCase()
        .includes(value)
    );

  renderProducts(filtered);

});

document
.getElementById("sortNewest")
.addEventListener("click", () => {

  const sorted =
    [...allProducts].sort(
      (a, b) =>
        (b.createdAt || 0) -
        (a.createdAt || 0)
    );

  renderProducts(sorted);

});

document
.getElementById("sortOldest")
.addEventListener("click", () => {

  const sorted =
    [...allProducts].sort(
      (a, b) =>
        (a.createdAt || 0) -
        (b.createdAt || 0)
    );

  renderProducts(sorted);

});

document
.getElementById("sortPriceAsc")
.addEventListener("click", () => {

  const sorted =
    [...allProducts].sort(
      (a, b) =>
        (a.price || 0) -
        (b.price || 0)
    );

  renderProducts(sorted);

});

document
.getElementById("sortPriceDesc")
.addEventListener("click", () => {

  const sorted =
    [...allProducts].sort(
      (a, b) =>
        (b.price || 0) -
        (a.price || 0)
    );

  renderProducts(sorted);

});

document
.getElementById("sortNameAsc")
.addEventListener("click", () => {

  const sorted =
    [...allProducts].sort(
      (a, b) =>
        a.name.localeCompare(
          b.name,
          "ar"
        )
    );

  renderProducts(sorted);

});

document
.getElementById("sortNameDesc")
.addEventListener("click", () => {

  const sorted =
    [...allProducts].sort(
      (a, b) =>
        b.name.localeCompare(
          a.name,
          "ar"
        )
    );

  renderProducts(sorted);

});

loadProducts();
