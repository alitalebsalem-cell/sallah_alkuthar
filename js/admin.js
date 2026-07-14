import { db } from "./firebase.js";
import { generateInvoicePdf } from "./invoice-pdf.js";

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

let editingId = null;
let allProducts = [];

const ARABIC_DAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const ARABIC_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

const productsTable = document.getElementById("productsTable");
const productsCollection = collection(db,"products");
const invoicesCollection = collection(db,"invoices");
const customersCollection = collection(db,"customers");
const adminsCollection = collection(db,"admins");

const CATEGORY_FOOD = "مواد غذائية";
const CATEGORY_VEGETABLES = "خضار";
const CATEGORY_DETERGENTS = "منظفات";
const CATEGORY_SUPPLIES = "مستلزمات";

/* =========================
HELPERS
========================= */

function escapeHTML(value){
  return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function getElement(id){ return document.getElementById(id); }

function getInputValue(id){
  const element = getElement(id);
  return element ? element.value.trim() : "";
}

function setText(id,value){
  const element = getElement(id);
  if(element) element.textContent = value;
}

function getProductImage(product){
  if(product.image && String(product.image).trim() !== "") return product.image;
  return "images/noimg.jpg";
}

function normalizeText(value){
  return String(value ?? "").trim().toLowerCase();
}

function isBase64Image(value){
  return typeof value === "string" && value.startsWith("data:image/");
}

function getExportImageValue(value){
  if(!value) return "";
  const image = String(value).trim();
  if(isBase64Image(image)) return "Image stored inside database - cannot export as Excel cell";
  if(image.length > 32000) return "Image value is too long for Excel cell";
  return image;
}

function makeExcelFileName(){
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2,"0");
  const day = String(now.getDate()).padStart(2,"0");
  const hours = String(now.getHours()).padStart(2,"0");
  const minutes = String(now.getMinutes()).padStart(2,"0");
  return `products-${year}${month}${day}-${hours}${minutes}.xlsx`;
}

function formatArabicDate(date){
  if(!date) return "";
  const d = date.toDate ? date.toDate() : new Date(date);
  return `${ARABIC_DAYS[d.getDay()]} ${ARABIC_MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;
}

function loadXLSXLibrary(){
  return new Promise((resolve,reject)=>{
    if(window.XLSX){ resolve(window.XLSX); return; }
    const existingScript = document.querySelector('script[data-xlsx-loader="true"]');
    if(existingScript){
      existingScript.addEventListener("load",()=>resolve(window.XLSX));
      existingScript.addEventListener("error",()=>reject(new Error("Failed to load XLSX library")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    script.dataset.xlsxLoader = "true";
    script.onload = ()=>{ if(window.XLSX) resolve(window.XLSX); else reject(new Error("XLSX library is not available")); };
    script.onerror = ()=>reject(new Error("Failed to load XLSX library"));
    document.head.appendChild(script);
  });
}

/* =========================
AUTH CHECK
========================= */

const AUTH_KEY = "sallah_admin_unlocked";
const VERIFIED_KEY = "sallah_admin_verified";

function revertToLoginScreen(errorMsg){
  sessionStorage.removeItem(AUTH_KEY);
  document.body.classList.add("admin-locked");
  const loginScreen = document.getElementById("adminLoginScreen");
  const adminPanel = document.getElementById("adminPanel");
  if(loginScreen) loginScreen.hidden = false;
  if(adminPanel) adminPanel.hidden = true;
  if(errorMsg){
    const loginError = document.getElementById("adminLoginError");
    if(loginError) loginError.textContent = errorMsg;
  }
  const script = document.querySelector("script[data-admin-module='true']");
  if(script) script.remove();
}

function showAdminPanel(){
  sessionStorage.setItem(AUTH_KEY, "true");
  if(typeof showAdminPanelUI === "function"){
    showAdminPanelUI();
  }else{
    document.body.classList.remove("admin-locked");
    const loginScreen = document.getElementById("adminLoginScreen");
    const adminPanel = document.getElementById("adminPanel");
    if(loginScreen) loginScreen.hidden = true;
    if(adminPanel) adminPanel.hidden = false;
  }
}

async function checkAdminAuth(){
  if(sessionStorage.getItem(VERIFIED_KEY) === "true"){
    return true;
  }

  const loginAttempt = sessionStorage.getItem("admin_login_attempt");
  if(!loginAttempt){
    revertToLoginScreen("");
    return false;
  }

  const { username, password } = JSON.parse(loginAttempt);
  sessionStorage.removeItem("admin_login_attempt");

  try{
    const q = query(adminsCollection, where("username", "==", username));
    const snapshot = await getDocs(q);
    if(!snapshot.empty){
      const admin = snapshot.docs[0].data();
      if(admin.password === password){
        sessionStorage.setItem(VERIFIED_KEY, "true");
        showAdminPanel();
        return true;
      }
    }
    revertToLoginScreen("Incorrect username or password");
    return false;
  }catch(error){
    console.error("Auth error:", error);
    revertToLoginScreen("Connection error, please check your internet and try again");
    return false;
  }
}

async function seedDefaultAdmin(){
  try{
    const snapshot = await getDocs(adminsCollection);
    if(snapshot.empty){
      await addDoc(adminsCollection, { username: "admin", password: "admin" });
      console.log("Default admin created: admin / admin");
    }
  }catch(error){
    console.error("Error seeding admin:", error);
  }
}

/* =========================
TABS - LAZY LOADING
========================= */

const loadedTabs = {};

async function loadTabContent(tabName){
  if(loadedTabs[tabName]) return;
  loadedTabs[tabName] = true;

  switch(tabName){
    case "products": await loadProducts(); break;
    case "invoices": await loadAllInvoices(); break;
    case "customers": await loadAllCustomers(); break;
    case "admins": await loadAdmins(); break;
  }
}

function initTabs(){
  document.querySelectorAll(".admin-tab").forEach(tab=>{
    tab.addEventListener("click",function(){
      document.querySelectorAll(".admin-tab").forEach(t=>t.classList.remove("active"));
      document.querySelectorAll(".admin-section").forEach(s=>s.classList.remove("active"));
      this.classList.add("active");
      const tabName = this.dataset.tab;
      const section = document.getElementById("section-" + tabName);
      if(section) section.classList.add("active");
      loadTabContent(tabName);
    });
  });
}

/* =========================
LOAD PRODUCTS
========================= */

async function loadProducts(){
  const snapshot = await getDocs(productsCollection);
  allProducts = [];
  snapshot.forEach(item=>{
    allProducts.push({ id: item.id, ...item.data() });
  });
  renderProducts(allProducts);
  updateStats();
}

/* =========================
STATS
========================= */

function updateStats(){
  setText("totalProducts",allProducts.length);
  setText("foodCount",allProducts.filter(p=>p.category === CATEGORY_FOOD).length);
  setText("vegCount",allProducts.filter(p=>p.category === CATEGORY_VEGETABLES).length);
  setText("detCount",allProducts.filter(p=>p.category === CATEGORY_DETERGENTS).length);
  setText("supCount",allProducts.filter(p=>p.category === CATEGORY_SUPPLIES).length);
}

/* =========================
RENDER PRODUCTS
========================= */

function renderProducts(products){
  if(!productsTable) return;
  productsTable.innerHTML = "";
  const frag = document.createDocumentFragment();
  const container = document.createElement("div");
  products.forEach(product=>{
    container.insertAdjacentHTML("beforeend",`
      <div class="admin-product">
        <img src="${escapeHTML(getProductImage(product))}" alt="${escapeHTML(product.name || "Product")}" onerror="this.src='images/noimg.jpg'">
        <div class="admin-info">
          <h3>${escapeHTML(product.name || "")}</h3>
          <p>${escapeHTML(product.description || "")}</p>
          <p>SKU / ${escapeHTML(product.code || "")}</p>
          <p>${escapeHTML(product.category || "")}</p>
        </div>
        <div class="admin-actions">
          <button class="edit-btn" type="button" onclick="editProduct('${escapeHTML(product.id)}')">Edit</button>
          <button class="delete-btn" type="button" onclick="deleteProduct('${escapeHTML(product.id)}')">Delete</button>
        </div>
      </div>
    `);
  });
  productsTable.appendChild(container);
}

/* =========================
IMAGE PICKER
========================= */

getElement("imageFile")?.addEventListener("change",function(){
  const file = this.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(event){
    const previewImage = getElement("previewImage");
    if(previewImage) previewImage.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

/* =========================
CLEAR FORM
========================= */

function clearForm(){
  ["name","description","code","image"].forEach(id=>{
    const el = getElement(id);
    if(el) el.value = "";
  });
  const imageFile = getElement("imageFile");
  if(imageFile) imageFile.value = "";
  const previewImage = getElement("previewImage");
  if(previewImage) previewImage.src = "images/noimg.jpg";
}

/* =========================
IMAGE COMPRESSION
========================= */

function compressImageFile(file){
  return new Promise((resolve,reject)=>{
    const image = new Image();
    const reader = new FileReader();
    reader.onload = event=>{
      image.onload = ()=>{
        const canvas = document.createElement("canvas");
        const maxWidth = 800;
        let width = image.width;
        let height = image.height;
        if(width > maxWidth){ height = height * (maxWidth / width); width = maxWidth; }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image,0,0,width,height);
        const compressed = canvas.toDataURL("image/jpeg",0.6);
        const sizeInBytes = Math.ceil((compressed.length * 3) / 4);
        if(sizeInBytes > 1000000){ reject(new Error("Image is bigger than 1MB after compression")); return; }
        resolve(compressed);
      };
      image.onerror = ()=>reject(new Error("Failed to load image"));
      image.src = event.target.result;
    };
    reader.onerror = ()=>reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

/* =========================
SAVE PRODUCT
========================= */

getElement("save")?.addEventListener("click",async()=>{
  try{
    let imageUrl = getInputValue("image");
    const imageFile = getElement("imageFile")?.files[0];
    if(imageFile) imageUrl = await compressImageFile(imageFile);
    if(!imageUrl) imageUrl = "images/noimg.jpg";

    const product = {
      name: getInputValue("name"),
      description: getInputValue("description"),
      code: getInputValue("code"),
      category: getInputValue("category"),
      image: imageUrl,
      createdAt: Date.now()
    };

    if(!product.name || !product.code){
      alert("Please fill all required fields / يرجى تعبئة جميع الحقول المطلوبة");
      return;
    }

    if(editingId){
      await updateDoc(doc(db,"products",editingId),product);
      editingId = null;
      alert("Product Updated Successfully / تم تعديل المنتج");
    }else{
      await addDoc(productsCollection,product);
      alert("Product Added Successfully / تم إضافة المنتج");
    }

    clearForm();
    await loadProducts();
  }catch(error){
    console.error(error);
    alert("حدث خطأ أثناء حفظ المنتج / Failed to save product");
  }
});

/* =========================
DELETE PRODUCT
========================= */

window.deleteProduct = async function(id){
  const ok = confirm("Delete Product ?\nهل تريد حذف المنتج؟");
  if(!ok) return;
  try{
    await deleteDoc(doc(db,"products",id));
    await loadProducts();
  }catch(error){
    console.error(error);
    alert("حدث خطأ أثناء حذف المنتج / Failed to delete product");
  }
};

/* =========================
EDIT PRODUCT
========================= */

window.editProduct = function(id){
  const product = allProducts.find(item=>String(item.id) === String(id));
  if(!product) return;
  editingId = id;
  getElement("name").value = product.name || "";
  getElement("description").value = product.description || "";
  getElement("code").value = product.code || "";
  getElement("category").value = product.category || "";
  getElement("image").value = product.image || "";
  const previewImage = getElement("previewImage");
  if(previewImage) previewImage.src = getProductImage(product);
  window.scrollTo({ top: 0, behavior: "smooth" });
};

/* =========================
SEARCH
========================= */

getElement("searchAdmin")?.addEventListener("input",function(){
  const value = normalizeText(this.value);
  const filtered = allProducts.filter(product=>{
    return normalizeText(`${product.name || ""} ${product.description || ""} ${product.code || ""} ${product.category || ""}`).includes(value);
  });
  renderProducts(filtered);
});

/* =========================
SORT
========================= */

getElement("sortNewest")?.addEventListener("click",()=>{
  const sorted = [...allProducts].sort((a,b)=>(b.createdAt || 0) - (a.createdAt || 0));
  renderProducts(sorted);
});
getElement("sortOldest")?.addEventListener("click",()=>{
  const sorted = [...allProducts].sort((a,b)=>(a.createdAt || 0) - (b.createdAt || 0));
  renderProducts(sorted);
});
getElement("sortNameAsc")?.addEventListener("click",()=>{
  const sorted = [...allProducts].sort((a,b)=>String(a.name || "").localeCompare(String(b.name || ""),"ar"));
  renderProducts(sorted);
});

/* =========================
IMPORT EXCEL
========================= */

getElement("importExcel")?.addEventListener("click",async()=>{
  try{
    await loadXLSXLibrary();
    getElement("excelFile")?.click();
  }catch(error){
    console.error(error);
    alert("تعذر تحميل مكتبة Excel / Failed to load Excel library");
  }
});

getElement("excelFile")?.addEventListener("change",async event=>{
  const file = event.target.files[0];
  if(!file) return;
  try{
    const XLSX = await loadXLSXLibrary();
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data,{ type:"array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const products = XLSX.utils.sheet_to_json(sheet,{ defval:"" });
    const snapshot = await getDocs(productsCollection);
    let maxCode = 9999;
    snapshot.forEach(item=>{ const code = parseInt(item.data().code,10); if(!isNaN(code) && code > maxCode) maxCode = code; });
    let nextCode = maxCode + 1;
    const existingProducts = allProducts.map(p=>normalizeText(p.name));
    let imported = 0;
    for(const product of products){
      const productName = normalizeText(product.name);
      if(!productName || existingProducts.includes(productName)) continue;
      await addDoc(productsCollection,{
        name: product.name || "",
        description: product.description || "",
        code: product.code || String(nextCode++),
        category: product.category || "",
        image: product.image || "images/noimg.jpg",
        createdAt: Date.now()
      });
      imported++;
    }
    event.target.value = "";
    alert(`${imported} Products Imported Successfully`);
    await loadProducts();
  }catch(error){
    console.error(error);
    alert("حدث خطأ أثناء استيراد ملف الإكسل / Failed to import Excel file");
  }
});

/* =========================
EXPORT EXCEL
========================= */

async function getProductsForExcelExport(){
  const snapshot = await getDocs(productsCollection);
  const products = [];
  snapshot.forEach(item=>{
    const product = item.data();
    products.push([product.name || "", product.description || "", product.category || "", getExportImageValue(product.image)]);
  });
  return products;
}

getElement("exportExcel")?.addEventListener("click",async()=>{
  const exportButton = getElement("exportExcel");
  const originalButtonHTML = exportButton ? exportButton.innerHTML : "";
  try{
    if(exportButton){ exportButton.disabled = true; exportButton.textContent = "جاري تصدير المنتجات... Exporting..."; }
    const XLSX = await loadXLSXLibrary();
    const rows = await getProductsForExcelExport();
    if(rows.length === 0){ alert("لا توجد منتجات للتصدير / No products to export"); return; }
    const worksheet = XLSX.utils.aoa_to_sheet([["name","description","category","image"],...rows]);
    worksheet["!cols"] = [{ wch: 34 },{ wch: 40 },{ wch: 24 },{ wch: 70 }];
    worksheet["!autofilter"] = { ref: `A1:D${rows.length + 1}` };
    const workbook = XLSX.utils.book_new();
    workbook.Props = { Title: "Products Export", Subject: "Store Products", Author: "Sallah Order Admin", CreatedDate: new Date() };
    XLSX.utils.book_append_sheet(workbook,worksheet,"Products");
    XLSX.writeFile(workbook,makeExcelFileName(),{ compression:true });
  }catch(error){
    console.error("Export Excel Error:",error);
    alert("حدث خطأ أثناء تصدير ملف الإكسل / Failed to export Excel file");
  }finally{
    if(exportButton){ exportButton.disabled = false; exportButton.innerHTML = originalButtonHTML || "Export Excel<br>تصدير المنتجات كاملة إلى ملف إكسل"; }
  }
});

/* =========================
INVOICES MANAGEMENT
========================= */

let allInvoices = [];

async function loadAllInvoices(){
  const list = document.getElementById("allInvoicesList");
  if(!list) return;
  list.innerHTML = "<div class='loading-msg'>جاري تحميل الفواتير...</div>";

  try{
    let snapshot;
    try{
      const q = query(invoicesCollection, orderBy("createdAt", "desc"));
      snapshot = await getDocs(q);
    }catch(indexError){
      console.warn("Ordered query failed, trying without orderBy:", indexError);
      snapshot = await getDocs(invoicesCollection);
    }
    allInvoices = [];
    snapshot.forEach(doc=>{ allInvoices.push({ id: doc.id, ...doc.data() }); });
    renderAllInvoices(allInvoices);
  }catch(error){
    console.error("Error loading invoices:", error);
    list.innerHTML = "<div class='empty-msg'>حدث خطأ أثناء تحميل الفواتير</div>";
  }
}

function renderAllInvoices(invoices){
  const list = document.getElementById("allInvoicesList");
  if(!list) return;

  if(invoices.length === 0){
    list.innerHTML = "<div class='empty-msg'>لا توجد فواتير بعد</div>";
    return;
  }

  list.innerHTML = "";
  invoices.forEach(inv=>{
    const dateStr = formatArabicDate(inv.createdAt || inv.date);
    let itemsPreview = "";
    if(inv.items && inv.items.length > 0){
      const firstFew = inv.items.slice(0, 3).map(i=>i.name).join("، ");
      itemsPreview = firstFew + (inv.items.length > 3 ? `...+${inv.items.length - 3}` : "");
    }

    let itemsTableRows = "";
    if(inv.items && inv.items.length > 0){
      inv.items.forEach((item, idx)=>{
        itemsTableRows += `<tr><td>${idx+1}</td><td>${escapeHTML(item.name || "")}</td><td>${escapeHTML(item.code || "")}</td><td>${item.qty || 0}</td></tr>`;
      });
    }

    const displayName = inv.branchName || inv.invoiceNo || "";

    const card = document.createElement("div");
    card.className = "invoice-admin-card";
    card.innerHTML = `
      <div class="inv-header">
        <strong>${escapeHTML(displayName)}</strong>
        <span>${dateStr}</span>
      </div>
      <div class="inv-customer">👤 ${escapeHTML(inv.customerName || "Direct Customer")}</div>
      <div class="inv-items-preview">${escapeHTML(itemsPreview)}</div>
      <div class="inv-footer">
        <span>Products: ${inv.totalItems || 0}</span>
        <span>Qty: ${inv.totalQty || 0}</span>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
        <button class="inv-toggle-btn" type="button">Show Details</button>
        <button class="inv-print-btn" type="button">📥 PDF</button>
        <button class="inv-del-btn" type="button" style="background:#dc3545;color:#fff;border:none;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:12px;font-weight:700;">🗑 Delete</button>
      </div>
      <table class="inv-detail-table">
        <thead><tr><th>#</th><th>Product</th><th>SKU</th><th>Qty</th></tr></thead>
        <tbody>${itemsTableRows}</tbody>
      </table>
    `;

    const toggleBtn = card.querySelector(".inv-toggle-btn");
    const detailTable = card.querySelector(".inv-detail-table");
    toggleBtn.addEventListener("click", ()=>{
      detailTable.classList.toggle("show");
      toggleBtn.textContent = detailTable.classList.contains("show") ? "Hide Details" : "Show Details";
    });

    const printBtn = card.querySelector(".inv-print-btn");
    printBtn.addEventListener("click", ()=>downloadInvoicePdf(inv));

    const delBtn = card.querySelector(".inv-del-btn");
    delBtn.addEventListener("click", ()=>openDeleteInvoiceModal(inv.id, displayName));

    list.appendChild(card);
  });
}

getElement("invoiceSearch")?.addEventListener("input", function(){
  const value = normalizeText(this.value);
  const filtered = allInvoices.filter(inv =>
    normalizeText(inv.customerName || "").includes(value) ||
    normalizeText(inv.invoiceNo || "").includes(value)
  );
  renderAllInvoices(filtered);
});

/* =========================
CUSTOMERS MANAGEMENT
========================= */

let allCustomers = [];

function getLocalCustomers(){
  try{
    return JSON.parse(localStorage.getItem("sallah_customers_data")) || [];
  }catch(e){
    return [];
  }
}

function saveLocalCustomers(arr){
  localStorage.setItem("sallah_customers_data", JSON.stringify(arr));
}

function removeLocalCustomer(id){
  const list = getLocalCustomers().filter(c => c.id !== id);
  saveLocalCustomers(list);
}

async function loadAllCustomers(){
  const list = document.getElementById("allCustomersList");
  if(!list) return;
  list.innerHTML = "<div class='loading-msg'>جاري تحميل العملاء...</div>";

  allCustomers = getLocalCustomers();

  try{
    const snapshot = await getDocs(customersCollection);
    const firestoreIds = new Set();
    snapshot.forEach(doc => {
      firestoreIds.add(doc.id);
      const data = doc.data();
      const existing = allCustomers.find(c => c.id === doc.id);
      if(!existing){
        allCustomers.push({ id: doc.id, name: data.name, pin: data.pin, createdAt: data.createdAt });
      }
    });
    const localIds = new Set(allCustomers.map(c => c.id));
    firestoreIds.forEach(fid => {
      if(!localIds.has(fid)) allCustomers = allCustomers.filter(c => c.id !== fid);
    });
    saveLocalCustomers(allCustomers);
  }catch(error){
    console.warn("Firestore load failed, using local data:", error);
  }

  renderAllCustomers(allCustomers);
}

function renderAllCustomers(customers){
  const list = document.getElementById("allCustomersList");
  if(!list) return;

  if(customers.length === 0){
    list.innerHTML = "<div class='empty-msg'>لا يوجد عملاء مسجلين بعد</div>";
    return;
  }

  list.innerHTML = "";
  customers.forEach(cust => {
    const dateStr = cust.createdAt ? formatArabicDate(cust.createdAt) : "";
    const card = document.createElement("div");
    card.className = "customer-admin-card";
    card.innerHTML = `
      <div class="cust-header">
        <strong>👤 ${escapeHTML(cust.name)}</strong>
        <span>${dateStr ? `تاريخ التسجيل: ${dateStr}` : ""}</span>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
        <button class="cust-toggle-btn" type="button">عرض الفواتير</button>
        <button class="cust-del-btn" type="button">🗑 حذف العميل</button>
      </div>
      <div class="cust-invoices"></div>
    `;

    const toggleBtn = card.querySelector(".cust-toggle-btn");
    const delBtn = card.querySelector(".cust-del-btn");
    const invoicesDiv = card.querySelector(".cust-invoices");

    delBtn.addEventListener("click", ()=>openDeleteCustomerModal(cust.id, cust.name));

    toggleBtn.addEventListener("click", async()=>{
      if(invoicesDiv.classList.contains("show")){
        invoicesDiv.classList.remove("show");
        invoicesDiv.innerHTML = "";
        toggleBtn.textContent = "عرض الفواتير";
        return;
      }
      toggleBtn.textContent = "جاري التحميل...";
      try{
        let snapshot;
        try{
          const q = query(invoicesCollection, where("customerId", "==", cust.id), orderBy("createdAt", "desc"));
          snapshot = await getDocs(q);
        }catch(indexError){
          console.warn("Ordered query failed, trying without orderBy:", indexError);
          const q = query(invoicesCollection, where("customerId", "==", cust.id));
          snapshot = await getDocs(q);
        }
        invoicesDiv.innerHTML = "";
        if(snapshot.empty){
          invoicesDiv.innerHTML = "<p style='color:#888;padding:10px;'>لا توجد فواتير لهذا العميل</p>";
        }else{
          snapshot.forEach(doc=>{
            const inv = doc.data();
            const invDate = formatArabicDate(inv.createdAt || inv.date);
            let itemsStr = "";
            if(inv.items && inv.items.length > 0){
              itemsStr = inv.items.slice(0,3).map(i=>i.name).join("، ");
              if(inv.items.length > 3) itemsStr += `...+${inv.items.length - 3}`;
            }
            const invId = doc.id;
            const invDisplayName = inv.branchName || inv.invoiceNo || "";
            const invDiv = document.createElement("div");
            invDiv.className = "cust-inv-card";
            invDiv.style.cssText = "background:#f9f9f9;border-radius:8px;padding:10px;margin-bottom:6px;border-right:3px solid #0a8f5a;";
            invDiv.innerHTML = `
              <div style="display:flex;justify-content:space-between;font-size:13px;">
                <strong>${escapeHTML(invDisplayName)}</strong>
                <span>${invDate}</span>
              </div>
              <div style="font-size:12px;color:#666;margin-top:4px;">${escapeHTML(itemsStr)}</div>
              <div style="font-size:12px;color:#888;margin-top:3px;display:flex;justify-content:space-between;align-items:center;">
                <span>Products: ${inv.totalItems || 0} | Qty: ${inv.totalQty || 0}</span>
                <span style="display:flex;gap:5px;">
                  <button class="cust-inv-detail-btn" type="button" style="background:#0a8f5a;color:#fff;border:none;border-radius:5px;padding:3px 10px;cursor:pointer;font-size:11px;font-weight:700;">Details</button>
                  <button class="cust-inv-print-btn" type="button" style="background:#ffc107;color:#333;border:none;border-radius:5px;padding:3px 10px;cursor:pointer;font-size:11px;font-weight:700;">🖨</button>
                  <button class="cust-inv-del-btn" type="button" style="background:#dc3545;color:#fff;border:none;border-radius:5px;padding:3px 10px;cursor:pointer;font-size:11px;font-weight:700;">🗑</button>
                </span>
              </div>
              <div class="cust-inv-detail-table" style="display:none;margin-top:8px;border-top:1px solid #ddd;padding-top:8px;"></div>
            `;
            invDiv.querySelector(".cust-inv-del-btn").addEventListener("click", (e)=>{
              e.stopPropagation();
              openDeleteInvoiceModal(invId, invDisplayName);
            });
            invDiv.querySelector(".cust-inv-print-btn").addEventListener("click", (e)=>{
              e.stopPropagation();
              downloadInvoicePdf(inv);
            });
            invDiv.querySelector(".cust-inv-detail-btn").addEventListener("click", (e)=>{
              e.stopPropagation();
              const detailDiv = invDiv.querySelector(".cust-inv-detail-table");
              if(detailDiv.style.display !== "none"){
                detailDiv.style.display = "none";
                e.target.textContent = "Details";
              }else{
                let detailHTML = `
                  <table style="width:100%;border-collapse:collapse;font-size:11px;">
                    <thead><tr style="background:#0a8f5a;color:#fff;">
                      <th style="padding:4px;border:1px solid #0a8f5a;">#</th>
                      <th style="padding:4px;border:1px solid #0a8f5a;">Product</th>
                      <th style="padding:4px;border:1px solid #0a8f5a;">SKU</th>
                      <th style="padding:4px;border:1px solid #0a8f5a;">Qty</th>
                    </tr></thead>
                    <tbody>
                `;
                if(inv.items && inv.items.length > 0){
                  inv.items.forEach((item, idx)=>{
                    detailHTML += `<tr>
                      <td style="padding:4px;border:1px solid #ddd;text-align:center;">${idx+1}</td>
                      <td style="padding:4px;border:1px solid #ddd;">${escapeHTML(item.name || "")}</td>
                      <td style="padding:4px;border:1px solid #ddd;">${escapeHTML(item.code || "")}</td>
                      <td style="padding:4px;border:1px solid #ddd;text-align:center;">${item.qty || 0}</td>
                    </tr>`;
                  });
                }else{
                  detailHTML += `<tr><td colspan="4" style="padding:8px;text-align:center;color:#888;">No items</td></tr>`;
                }
                detailHTML += `</tbody></table>`;
                detailDiv.innerHTML = detailHTML;
                detailDiv.style.display = "block";
                e.target.textContent = "Hide";
              }
            });
            invoicesDiv.appendChild(invDiv);
          });
        }
        invoicesDiv.classList.add("show");
        toggleBtn.textContent = "إخفاء الفواتير";
      }catch(error){
        console.error("Error loading customer invoices:", error);
        invoicesDiv.innerHTML = "<p style='color:#dc3545;padding:10px;'>حدث خطأ</p>";
        invoicesDiv.classList.add("show");
        toggleBtn.textContent = "إخفاء الفواتير";
      }
    });

    list.appendChild(card);
  });
}

/* =========================
DELETE CUSTOMER MODAL
========================= */

let deleteCustomerTargetId = null;

function openDeleteCustomerModal(custId, custName){
  deleteCustomerTargetId = custId;
  const overlay = document.getElementById("deleteCustomerModal");
  if(!overlay) return;
  const nameSpan = document.getElementById("deleteCustName");
  if(nameSpan) nameSpan.textContent = custName;
  const input = document.getElementById("deleteCustConfirmInput");
  if(input) input.value = "";
  const btn = document.getElementById("deleteCustConfirmBtn");
  if(btn) btn.disabled = true;
  overlay.hidden = false;
  overlay.setAttribute("aria-hidden", "false");
  requestAnimationFrame(()=>overlay.classList.add("active"));
}

window.closeDeleteCustomerModal = function(){
  const overlay = document.getElementById("deleteCustomerModal");
  if(!overlay) return;
  overlay.classList.remove("active");
  overlay.setAttribute("aria-hidden", "true");
  setTimeout(()=>{ overlay.hidden = true; },200);
  deleteCustomerTargetId = null;
};

function isDeleteCustomerConfirmed(){
  const input = document.getElementById("deleteCustConfirmInput");
  return input && input.value.trim().toLowerCase() === "yes";
}

window.confirmDeleteCustomer = async function(){
  if(!deleteCustomerTargetId) return;
  const id = deleteCustomerTargetId;
  deleteCustomerTargetId = null;

  const btn = document.getElementById("deleteCustConfirmBtn");
  if(btn){ btn.disabled = true; btn.textContent = "Deleting..."; }

  removeLocalCustomer(id);
  closeDeleteCustomerModal();
  await loadAllCustomers();

  try{
    await deleteDoc(doc(db, "customers", id));
  }catch(error){
    console.warn("Firestore delete failed (local delete succeeded):", error);
  }

  if(btn){ btn.disabled = false; btn.textContent = "Delete / حذف"; }
}

getElement("customerSearch")?.addEventListener("input", function(){
  const value = normalizeText(this.value);
  const filtered = allCustomers.filter(c => normalizeText(c.name || "").includes(value));
  renderAllCustomers(filtered);
});

getElement("addCustBtn")?.addEventListener("click", async function(){
  const name = getInputValue("newCustName");
  const pin = getInputValue("newCustPin");
  if(!name || name.length < 2){ alert("Name must be at least 2 characters"); return; }
  if(!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)){ alert("PIN must be exactly 4 digits"); return; }

  const existing = allCustomers.find(c => String(c.name || "").trim().toLowerCase() === name.toLowerCase());
  if(existing){ alert("Customer already exists"); return; }

  const localCustomers = getLocalCustomers();
  const id = "local_" + Date.now() + "_" + Math.random().toString(36).slice(2,6);
  localCustomers.push({ id, name, pin, createdAt: Date.now() });
  saveLocalCustomers(localCustomers);

  getElement("newCustName").value = "";
  getElement("newCustPin").value = "";
  alert("Customer added successfully!");

  try{
    await addDoc(customersCollection, { name, pin, createdAt: serverTimestamp() });
  }catch(error){
    console.warn("Firestore save failed (local save succeeded):", error);
  }
  await loadAllCustomers();
});

/* =========================
DELETE INVOICE
========================= */

let deleteInvoiceTargetId = null;

window.openDeleteInvoiceModal = function(invId, invName){
  deleteInvoiceTargetId = invId;
  const overlay = document.getElementById("deleteInvoiceModal");
  if(!overlay) return;
  const nameSpan = document.getElementById("deleteInvoiceName");
  if(nameSpan) nameSpan.textContent = invName;
  const input = document.getElementById("deleteInvoiceConfirmInput");
  if(input) input.value = "";
  const btn = document.getElementById("deleteInvoiceConfirmBtn");
  if(btn) btn.disabled = true;
  overlay.hidden = false;
  overlay.setAttribute("aria-hidden", "false");
  requestAnimationFrame(()=>overlay.classList.add("active"));
};

window.closeDeleteInvoiceModal = function(){
  const overlay = document.getElementById("deleteInvoiceModal");
  if(!overlay) return;
  overlay.classList.remove("active");
  overlay.setAttribute("aria-hidden", "true");
  setTimeout(()=>{ overlay.hidden = true; },200);
  deleteInvoiceTargetId = null;
};

window.confirmDeleteInvoice = async function(){
  if(!deleteInvoiceTargetId) return;
  const id = deleteInvoiceTargetId;
  deleteInvoiceTargetId = null;

  const btn = document.getElementById("deleteInvoiceConfirmBtn");
  if(btn){ btn.disabled = true; btn.textContent = "Deleting..."; }

  try{
    const timeoutPromise = new Promise((_, reject)=>setTimeout(()=>reject(new Error("Timeout")), 10000));
    await Promise.race([deleteDoc(doc(db, "invoices", id)), timeoutPromise]);
    closeDeleteInvoiceModal();
    if(typeof loadAllInvoices === "function") await loadAllInvoices();
  }catch(error){
    console.error("Error deleting invoice:", error);
    alert(error.message === "Timeout" ? "Connection timeout, please try again" : "Error deleting invoice / حدث خطأ أثناء حذف الفاتورة");
    if(btn){ btn.disabled = false; btn.textContent = "Delete / حذف"; }
  }
};

/* =========================
ADMIN USERS MANAGEMENT
========================= */

async function loadAdmins(){
  const list = document.getElementById("adminsList");
  if(!list) return;

  try{
    const snapshot = await getDocs(adminsCollection);
    list.innerHTML = "";
    if(snapshot.empty){
      list.innerHTML = "<div class='empty-msg'>لا يوجد مدراء</div>";
      return;
    }
    snapshot.forEach(doc=>{
      const data = doc.data();
      const div = document.createElement("div");
      div.className = "admin-user-card";
      div.innerHTML = `
        <strong>🔑 ${escapeHTML(data.username)}</strong>
        <button class="del-admin-btn" data-id="${doc.id}" type="button">حذف</button>
      `;
      list.appendChild(div);
    });

    list.querySelectorAll(".del-admin-btn").forEach(btn=>{
      btn.addEventListener("click", async()=>{
        const id = btn.dataset.id;
        const ok = confirm("هل تريد حذف هذا المدير؟");
        if(!ok) return;
        try{
          await deleteDoc(doc(db,"admins",id));
          await loadAdmins();
        }catch(error){
          console.error("Error deleting admin:", error);
          alert("حدث خطأ أثناء حذف المدير");
        }
      });
    });
  }catch(error){
    console.error("Error loading admins:", error);
    list.innerHTML = "<div class='empty-msg'>حدث خطأ</div>";
  }
}

getElement("addAdminBtn")?.addEventListener("click", async()=>{
  const username = getElement("newAdminUser")?.value.trim();
  const password = getElement("newAdminPass")?.value.trim();
  if(!username || !password){
    alert("يرجى إدخال اسم المستخدم وكلمة المرور");
    return;
  }
  if(username.length < 3 || password.length < 3){
    alert("اسم المستخدم وكلمة المرور يجب أن يكونا 3 أحرف على الأقل");
    return;
  }
  try{
    const q = query(adminsCollection, where("username", "==", username));
    const snapshot = await getDocs(q);
    if(!snapshot.empty){
      alert("اسم المستخدم موجود مسبقاً");
      return;
    }
    await addDoc(adminsCollection, { username, password });
    if(getElement("newAdminUser")) getElement("newAdminUser").value = "";
    if(getElement("newAdminPass")) getElement("newAdminPass").value = "";
    alert("تم إضافة المدير بنجاح");
    await loadAdmins();
  }catch(error){
    console.error("Error adding admin:", error);
    alert("حدث خطأ أثناء إضافة المدير");
  }
});

/* =========================
INIT
========================= */

async function init(){
  await seedDefaultAdmin();

  const isAuthed = await checkAdminAuth();
  if(!isAuthed) return;

  sessionStorage.setItem(AUTH_KEY, "true");
  initTabs();
  await loadTabContent("products");
}

function ensureJspdfLoaded(){
  return new Promise((resolve)=>{
    if(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable){ resolve(); return; }
    const check = ()=>{
      if(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable) resolve();
      else setTimeout(check, 200);
    };
    setTimeout(check, 500);
    setTimeout(resolve, 5000);
  });
}

async function downloadInvoicePdf(invoiceData){
  try{
    await generateInvoicePdf(invoiceData);
    const fileName = `${(invoiceData.branchName || (invoiceData.invoiceNo || "").replace("INV-", "") || "invoice")}.pdf`;
    const successMsg = document.getElementById("pdfSuccessMsg");
    if(successMsg){
      successMsg.textContent = `Downloaded ${fileName}`;
      setTimeout(() => { successMsg.textContent = ""; }, 3000);
    }
  }catch(error){
    console.error("Error generating PDF:", error);
    alert("Error generating PDF");
  }
}

/* =========================
BRANCHES MANAGEMENT
========================= */

const BRANCHES_KEY = "sallah_branches";
const DEFAULT_BRANCHES = [
  "فرع الحمدانية - Hamdanya",
  "فرع الطائف - Altayf",
  "فرع السامر - Al-Samer",
  "فرع المعمل - Almamal"
];

function getBranches(){
  try{
    const data = localStorage.getItem(BRANCHES_KEY);
    if(data){ const parsed = JSON.parse(data); if(Array.isArray(parsed) && parsed.length) return parsed; }
  }catch(e){}
  return [...DEFAULT_BRANCHES];
}

function saveBranches(list){
  localStorage.setItem(BRANCHES_KEY, JSON.stringify(list));
}

function renderBranches(){
  const list = document.getElementById("branchesList");
  if(!list) return;
  const branches = getBranches();
  if(branches.length === 0){
    list.innerHTML = "<div class='empty-msg'>No branches added yet</div>";
    return;
  }
  list.innerHTML = "";
  branches.forEach((b, idx) => {
    const card = document.createElement("div");
    card.className = "customer-admin-card";
    card.innerHTML = `
      <div class="cust-header">
        <strong>${escapeHTML(b)}</strong>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="branch-del-btn" type="button" style="background:#dc3545;color:#fff;border:none;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:12px;font-weight:700;" data-index="${idx}">🗑 Delete</button>
      </div>
    `;
    card.querySelector(".branch-del-btn").addEventListener("click", function(){
      const branches = getBranches();
      const idx = parseInt(this.dataset.index);
      if(idx >= 0 && idx < branches.length){
        if(confirm(`Delete branch "${branches[idx]}"?`)){
          branches.splice(idx, 1);
          saveBranches(branches);
          renderBranches();
        }
      }
    });
    list.appendChild(card);
  });
}

const addBranchBtn = document.getElementById("addBranchBtn");
const newBranchInput = document.getElementById("newBranchName");
if(addBranchBtn && newBranchInput){
  addBranchBtn.addEventListener("click", function(){
    const name = newBranchInput.value.trim();
    if(!name){ alert("Please enter a branch name"); return; }
    const branches = getBranches();
    if(branches.includes(name)){ alert("Branch already exists"); return; }
    branches.push(name);
    saveBranches(branches);
    newBranchInput.value = "";
    renderBranches();
  });
}

renderBranches();

init();
