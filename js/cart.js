import { db } from "./firebase.js";
import { generateInvoicePdf } from "./invoice-pdf.js";

import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const CUSTOMERS_COLLECTION = "customers";
const INVOICES_COLLECTION = "invoices";
const SESSION_KEY = "sallah_customer_session";
const CUSTOMERS_LOCAL_KEY = "sallah_customers_data";

let cart = JSON.parse(localStorage.getItem("cart")) || [];
let currentCustomer = null;

const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const cartSearch = document.getElementById("cartSearch");
const branchNameInput = document.getElementById("branchName");
const invoiceNoElement = document.getElementById("invoiceNo");
const invoiceDateElement = document.getElementById("invoiceDate");
const invoiceCustomerElement = document.getElementById("invoiceCustomer");
const invoiceProducts = document.getElementById("invoiceProducts");
const invoiceTotalElement = document.getElementById("invoiceTotal");
const invoiceQtyElement = document.getElementById("invoiceQty");
const invoiceTemplate = document.getElementById("invoiceTemplate");
const createInvoiceButton = document.getElementById("createInvoice");
const whatsappButton = document.getElementById("whatsappBtn");
const clearCartButton = document.getElementById("clearCartBtn");
const clearCartModal = document.getElementById("clearCartConfirmModal");
const confirmClearInput = document.getElementById("confirmClearInput");
const cancelClearCartButton = document.getElementById("cancelClearCart");
const confirmClearCartButton = document.getElementById("confirmClearCart");

const loginBtn = document.getElementById("loginBtn");
const userProfile = document.getElementById("userProfile");
const profileToggle = document.getElementById("profileToggle");
const profileDropdown = document.getElementById("profileDropdown");
const profileName = document.getElementById("profileName");
const profilePin = document.getElementById("profilePin");
const profileTogglePin = document.getElementById("profileTogglePin");
const profileChangePinBtn = document.getElementById("profileChangePinBtn");
const profileInvoicesBtn = document.getElementById("profileInvoicesBtn");
const profileLogoutBtn = document.getElementById("profileLogoutBtn");
const loggedInUser = document.getElementById("loggedInUser");
const userInvoicesBtn = document.getElementById("userInvoicesBtn");
const loginModal = document.getElementById("loginModal");
const loginModalClose = document.getElementById("loginModalClose");
const loginNameInput = document.getElementById("loginName");
const loginPinInput = document.getElementById("loginPin");
const loginSubmit = document.getElementById("loginSubmit");
const loginError = document.getElementById("loginError");
const authLoginTab = document.getElementById("authLoginTab");
const authRegisterTab = document.getElementById("authRegisterTab");
const authSubtitle = document.getElementById("authSubtitle");
const registerNameInput = document.getElementById("registerName");
let authMode = "login";
const invoicesModal = document.getElementById("invoicesModal");
const invoicesModalClose = document.getElementById("invoicesModalClose");
const invoicesList = document.getElementById("invoicesList");
const invoicesSubtitle = document.getElementById("invoicesSubtitle");
const invoicesCloseBtn = document.getElementById("invoicesCloseBtn");
const invoiceDetailModal = document.getElementById("invoiceDetailModal");
const invoiceDetailClose = document.getElementById("invoiceDetailClose");
const invoiceDetailContent = document.getElementById("invoiceDetailContent");

let currentCustomerPin = "";
let customersCache = [];
let customersCacheLoaded = false;

function findLocalCustomer(name){
  const trimmed = name.trim().toLowerCase();
  const list = getLocalCustomers();
  return list.find(c => String(c.name || "").trim().toLowerCase() === trimmed) || null;
}

const ARABIC_DAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const ARABIC_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

const COLUMNS_PER_INVOICE_ROW = 3;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

function escapeHTML(value){
  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function getItemQty(item){
  const qty = parseInt(item.qty,10);
  return isNaN(qty) || qty < 1 ? 1 : qty;
}

function getProductImage(item){
  if(item.image && typeof item.image === "string" && item.image.trim() !== ""){
    return item.image;
  }
  return "images/noimg.jpg";
}

function saveCart(){
  localStorage.setItem("cart",JSON.stringify(cart));
}

function getCartTotalQty(){
  return cart.reduce((sum,item)=>sum + getItemQty(item),0);
}

function formatArabicDate(date){
  const d = date instanceof Timestamp ? date.toDate() : new Date(date);
  return `${ARABIC_DAYS[d.getDay()]} ${ARABIC_MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;
}

/* ========================
   AUTH / SESSION
   ======================== */

function loadSession(){
  const stored = localStorage.getItem(SESSION_KEY);
  if(stored){
    try{
      const data = JSON.parse(stored);
      currentCustomer = { id: data.id, name: data.name };
      currentCustomerPin = data.pin || "";
      console.log("Session loaded:", currentCustomer);
      updateAuthUI();
    }catch(e){
      console.warn("Session parse error:", e);
      currentCustomer = null;
    }
  }else{
    console.log("No saved session found");
  }
}

function saveSession(customer, pin){
  currentCustomer = customer;
  currentCustomerPin = pin || "";
  const sessionData = { id: customer.id, name: customer.name, pin: currentCustomerPin };
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  console.log("Session saved:", sessionData);
  updateAuthUI();
}

function clearSession(){
  currentCustomer = null;
  currentCustomerPin = "";
  localStorage.removeItem(SESSION_KEY);
  console.log("Session cleared");
  updateAuthUI();
}

function updateAuthUI(){
  console.log("updateAuthUI, logged in:", !!currentCustomer, currentCustomer?.name);
  if(currentCustomer){
    if(loggedInUser) loggedInUser.textContent = currentCustomer.name;
    if(userProfile) userProfile.style.display = "inline-flex";
    if(profileName) profileName.textContent = currentCustomer.name;
    if(profilePin) profilePin.textContent = "****";
    if(loginBtn) loginBtn.style.display = "none";
  }else{
    if(userProfile) userProfile.style.display = "none";
    if(loginBtn) loginBtn.style.display = "inline-flex";
  }
}

/* ========================
   LOCAL CUSTOMER STORAGE
   ======================== */

function getLocalCustomers(){
  try{
    const data = localStorage.getItem(CUSTOMERS_LOCAL_KEY);
    const parsed = data ? JSON.parse(data) : [];
    console.log("getLocalCustomers:", parsed.length, "customers");
    return parsed;
  }catch(e){
    console.warn("getLocalCustomers error:", e);
    return [];
  }
}

function saveLocalCustomers(arr){
  localStorage.setItem(CUSTOMERS_LOCAL_KEY, JSON.stringify(arr));
  console.log("saveLocalCustomers:", arr.length, "customers saved");
}

function addLocalCustomer(name, pin){
  const list = getLocalCustomers();
  const id = "cust_" + Date.now() + "_" + Math.random().toString(36).slice(2,8);
  list.push({ id, name, pin: String(pin), createdAt: Date.now() });
  saveLocalCustomers(list);
  console.log("addLocalCustomer:", name, "id:", id);
  return id;
}

function removeLocalCustomer(id){
  const list = getLocalCustomers().filter(c => c.id !== id);
  saveLocalCustomers(list);
}

async function loadCustomersCache(){
  console.log("loadCustomersCache: loading from localStorage");
  customersCache = getLocalCustomers();
  customersCacheLoaded = true;
  populateCustomerDropdown();
  console.log("loadCustomersCache: done, count:", customersCache.length);

  try{
    const snapshot = await getDocs(collection(db, CUSTOMERS_COLLECTION));
    const firestoreCustomers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const localIds = new Set(customersCache.map(c => c.id));
    const localNames = new Set(customersCache.map(c => String(c.name || "").trim().toLowerCase()));
    let changed = false;
    firestoreCustomers.forEach(fc => {
      if(!localIds.has(fc.id) && !localNames.has(String(fc.name || "").trim().toLowerCase())){
        customersCache.push(fc);
        localIds.add(fc.id);
        localNames.add(String(fc.name || "").trim().toLowerCase());
        changed = true;
      }
    });
    if(changed){
      saveLocalCustomers(customersCache);
      populateCustomerDropdown();
      console.log("loadCustomersCache: synced", changed, "customers from Firestore");
    }
  }catch(error){
    console.warn("Firestore sync failed (local data works):", error);
  }
}

function populateCustomerDropdown(){
  if(!loginNameInput){
    console.warn("populateCustomerDropdown: loginNameInput not found");
    return;
  }
  console.log("populateCustomerDropdown: populating with", customersCache.length, "customers");
  loginNameInput.innerHTML = '<option value="">-- اختر اسمك --</option>';
  const sorted = [...customersCache].sort((a,b) => String(a.name || "").localeCompare(String(b.name || ""), "ar"));
  sorted.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = c.name;
    loginNameInput.appendChild(opt);
  });
}

function getCustomerByName(name){
  const trimmed = name.trim().toLowerCase();
  return customersCache.find(c => String(c.name || "").trim().toLowerCase() === trimmed) || null;
}

async function registerCustomer(name, pin){
  console.log("registerCustomer called with:", name, pin);
  if(!name || name.trim().length < 2){
    return { error: "Name must be at least 2 characters" };
  }
  if(!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)){
    return { error: "PIN must be exactly 4 digits" };
  }

  const trimmedName = name.trim();

  if(!customersCacheLoaded || customersCache.length === 0){
    customersCache = getLocalCustomers();
    customersCacheLoaded = true;
  }

  const existing = getCustomerByName(trimmedName);
  console.log("registerCustomer: existing check:", existing);
  if(existing){
    return { error: "This name is already registered, please login" };
  }

  const localId = addLocalCustomer(trimmedName, pin);
  customersCache = getLocalCustomers();
  populateCustomerDropdown();
  console.log("registerCustomer: saved locally with id:", localId);

  try{
    const docRef = await addDoc(collection(db, CUSTOMERS_COLLECTION), { name: trimmedName, pin: pin, createdAt: serverTimestamp() });
    console.log("registerCustomer: also saved to Firestore with id:", docRef.id);
    return { success: true, customer: { id: docRef.id, name: trimmedName }, pin: pin };
  }catch(error){
    console.warn("registerCustomer: Firestore failed (local OK):", error);
    return { success: true, customer: { id: localId, name: trimmedName }, pin: pin };
  }
}

async function loginCustomer(name, pin){
  console.log("loginCustomer called with:", name, pin);
  if(!name || name.trim().length < 2){
    return { error: "Name must be at least 2 characters" };
  }
  if(!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)){
    return { error: "PIN must be exactly 4 digits" };
  }

  const trimmedName = name.trim();

  if(!customersCacheLoaded || customersCache.length === 0){
    console.log("loginCustomer: cache empty, reloading from localStorage");
    customersCache = getLocalCustomers();
    customersCacheLoaded = true;
    populateCustomerDropdown();
  }

  console.log("loginCustomer: searching for", trimmedName, "in", customersCache.length, "customers");
  const match = getCustomerByName(trimmedName);
  console.log("loginCustomer: match found:", match);

  if(!match){
    return { error: "User not found, please register first" };
  }

  const storedPin = String(match.pin);
  console.log("loginCustomer: comparing pins - stored:", storedPin, "input:", pin, "match:", storedPin === pin);
  if(storedPin === pin){
    return { success: true, customer: { id: match.id, name: match.name }, pin: pin };
  }else{
    console.warn("Login PIN mismatch for", trimmedName, "stored type:", typeof match.pin, "input type:", typeof pin);
    return { error: "Incorrect PIN" };
  }
}

function openLoginModal(){
  console.log("openLoginModal");
  if(!loginModal) return;

  if(!customersCacheLoaded || customersCache.length === 0){
    console.log("openLoginModal: loading customers cache");
    loadCustomersCache();
  }

  setLoginMode();
  populateCustomerDropdown();

  loginModal.hidden = false;
  loginModal.setAttribute("aria-hidden","false");
  if(loginError) loginError.textContent = "";
  if(loginNameInput) loginNameInput.value = "";
  if(registerNameInput) registerNameInput.value = "";
  if(loginPinInput) loginPinInput.value = "";

  requestAnimationFrame(()=>{
    loginModal.classList.add("active");
    if(loginNameInput) loginNameInput.focus();
  });
}

function closeLoginModal(){
  if(!loginModal) return;
  loginModal.classList.remove("active");
  loginModal.setAttribute("aria-hidden","true");
  setTimeout(()=>{ loginModal.hidden = true; },200);
}

function openInvoicesModal(){
  if(!invoicesModal) return;
  invoicesModal.hidden = false;
  invoicesModal.setAttribute("aria-hidden","false");
  if(invoicesList) invoicesList.innerHTML = "<p class='loading-text'>جاري تحميل الفواتير...</p>";
  requestAnimationFrame(()=>{
    invoicesModal.classList.add("active");
  });
  loadCustomerInvoices();
}

function closeInvoicesModal(){
  if(!invoicesModal) return;
  invoicesModal.classList.remove("active");
  invoicesModal.setAttribute("aria-hidden","true");
  setTimeout(()=>{ invoicesModal.hidden = true; },200);
}

function openInvoiceDetailModal(invoiceData){
  if(!invoiceDetailModal || !invoiceDetailContent) return;
  invoiceDetailModal.hidden = false;
  invoiceDetailModal.setAttribute("aria-hidden","false");

  const dateStr = formatArabicDate(invoiceData.createdAt || invoiceData.date);
  let itemsHtml = "";
  if(invoiceData.items && invoiceData.items.length > 0){
    invoiceData.items.forEach((item, idx)=>{
      itemsHtml += `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHTML(item.name || "")}</td>
          <td>${escapeHTML(item.code || "")}</td>
          <td>${getItemQty(item)}</td>
        </tr>
      `;
    });
  }

  const displayName = invoiceData.branchName || invoiceData.invoiceNo || "";

  const invShortNo = (invoiceData.invoiceNo || "").replace("INV-", "");

  invoiceDetailContent.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <div style="font-size:11px;font-weight:700;color:#444;text-align:left;direction:ltr;">
        Receiving Branch: <span style="display:inline-block;min-width:120px;border-bottom:1px solid #999;color:var(--brand-gold);font-weight:400;">${escapeHTML(displayName)}</span>
      </div>
      <div class="invoice-detail-header" style="text-align:center;flex:1;">
        <img src="images/logo.png" class="invoice-detail-logo" alt="Logo" onerror="this.style.display='none'" style="width:80px;height:auto;margin-bottom:6px;">
        <h2 style="font-size:22px;color:#111;margin:0;">Delivery Materials List</h2>
      </div>
    </div>
    <div class="invoice-detail-meta">
      <div><span>Invoice No:</span> <strong>${escapeHTML(invShortNo)}</strong></div>
      <div><span>Customer:</span> <strong>${escapeHTML(invoiceData.customerName || "")}</strong></div>
      <div><span>Date:</span> <strong>${escapeHTML(dateStr)}</strong></div>
    </div>
    <table class="invoice-detail-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Product</th>
          <th>SKU</th>
          <th>Qty</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div class="invoice-detail-summary">
      <span>Items: ${invoiceData.totalItems || 0}</span>
      <span>Qty: ${invoiceData.totalQty || 0}</span>
    </div>
    <div style="text-align:center;margin-top:14px;">
      <button id="detailPrintBtn" class="inv-print-small-btn" type="button" style="width:auto;padding:8px 24px;font-size:14px;">🖨 Print PDF</button>
    </div>
  `;

  const printBtn = invoiceDetailContent.querySelector("#detailPrintBtn");
  if(printBtn) printBtn.addEventListener("click", ()=>downloadInvoicePdf(invoiceData));

  requestAnimationFrame(()=>{
    invoiceDetailModal.classList.add("active");
  });
}

function closeInvoiceDetailModal(){
  if(!invoiceDetailModal) return;
  invoiceDetailModal.classList.remove("active");
  invoiceDetailModal.setAttribute("aria-hidden","true");
  setTimeout(()=>{ invoiceDetailModal.hidden = true; },200);
}

async function loadCustomerInvoices(){
  if(!currentCustomer || !invoicesList) return;

  if(invoicesSubtitle){
    invoicesSubtitle.textContent = `Customer: ${currentCustomer.name}`;
  }

  try{
    const invoicesRef = collection(db, INVOICES_COLLECTION);
    let snapshot;
    try{
      const q = query(
        invoicesRef,
        where("customerId", "==", currentCustomer.id),
        orderBy("createdAt", "desc")
      );
      snapshot = await getDocs(q);
    }catch(indexError){
      console.warn("Ordered query failed, trying without orderBy:", indexError);
      const q = query(invoicesRef, where("customerId", "==", currentCustomer.id));
      snapshot = await getDocs(q);
    }

    if(snapshot.empty){
      invoicesList.innerHTML = "<p class='empty-text'>No invoices found</p>";
      return;
    }

    invoicesList.innerHTML = "";
    snapshot.forEach(doc=>{
      const inv = doc.data();
      const dateStr = formatArabicDate(inv.createdAt || inv.date);
      let itemsPreview = "";
      if(inv.items && inv.items.length > 0){
        const shown = inv.items.slice(0, 3);
        itemsPreview = shown.map(i => i.name).join("، ");
        if(inv.items.length > 3){
          itemsPreview += `...+${inv.items.length - 3}`;
        }
      }

      const div = document.createElement("div");
      div.className = "invoice-history-card";
      const displayName = inv.branchName || inv.invoiceNo || "";
      div.innerHTML = `
        <div class="invoice-history-top">
          <strong class="invoice-history-no">${escapeHTML(displayName)}</strong>
          <span class="invoice-history-date">${dateStr}</span>
        </div>
        <div class="invoice-history-items">${escapeHTML(itemsPreview)}</div>
        <div class="invoice-history-footer">
          <span>Items: ${inv.totalItems || 0}</span>
          <span>Qty: ${inv.totalQty || 0}</span>
        </div>
        <div style="margin-top:8px;">
          <button class="inv-print-small-btn" type="button">🖨 Print</button>
        </div>
      `;
      div.querySelector(".inv-print-small-btn").addEventListener("click", (e)=>{
        e.stopPropagation();
        downloadInvoicePdf(inv);
      });
      div.addEventListener("click", ()=>openInvoiceDetailModal(inv));
      invoicesList.appendChild(div);
    });
  }catch(error){
    console.error("Error loading invoices:", error);
    invoicesList.innerHTML = "<p class='error-text'>حدث خطأ أثناء تحميل الفواتير</p>";
  }
}

/* ========================
   CART RENDER
   ======================== */

function renderCart(){
  if(!cartItems) return;

  cartItems.innerHTML = "";

  const searchText = cartSearch ? cartSearch.value.trim().toLowerCase() : "";
  let visibleItems = 0;

  cart.forEach(item=>{
    const productText = `${item.name || ""} ${item.description || ""} ${item.code || ""}`.toLowerCase();
    if(searchText && !productText.includes(searchText)) return;

    visibleItems++;
    cartItems.insertAdjacentHTML("beforeend",`
      <div class="cart-item">
        <img src="${escapeHTML(getProductImage(item))}" alt="${escapeHTML(item.name || "Product")}" onerror="this.src='images/noimg.jpg'">
        <div class="info">
          <h3>${escapeHTML(item.name || "")}</h3>
          <p>${escapeHTML(item.description || "")}</p>
          <p>SKU : ${escapeHTML(item.code || "")}</p>
          <div class="qty-controls">
            <button type="button" data-action="decrease" data-id="${escapeHTML(item.id)}">-</button>
            <input type="number" min="1" value="${getItemQty(item)}" class="qty-input" data-id="${escapeHTML(item.id)}">
            <button type="button" data-action="increase" data-id="${escapeHTML(item.id)}">+</button>
          </div>
        </div>
        <button type="button" class="delete-cart-item" data-action="delete" data-id="${escapeHTML(item.id)}">حذف</button>
      </div>
    `);
  });

  if(cart.length === 0){
    cartItems.innerHTML = `<div class="cart-item"><div class="info"><h3>السلة فارغة</h3></div></div>`;
  }else if(visibleItems === 0){
    cartItems.innerHTML = `<div class="cart-item"><div class="info"><h3>لا توجد نتائج مطابقة للبحث</h3></div></div>`;
  }

  if(cartTotal){
    cartTotal.textContent = getCartTotalQty();
  }

  saveCart();
}

function findItem(id){
  return cart.find(item=>String(item.id) === String(id));
}

function increaseQty(id){
  const item = findItem(id);
  if(!item) return;
  item.qty = getItemQty(item) + 1;
  renderCart();
}

function decreaseQty(id){
  const item = findItem(id);
  if(!item) return;
  item.qty = getItemQty(item) - 1;
  if(item.qty <= 0){
    cart = cart.filter(product=>String(product.id) !== String(id));
  }
  renderCart();
}

function updateQty(id,value){
  const item = findItem(id);
  if(!item) return;
  const qty = parseInt(value,10);
  item.qty = isNaN(qty) || qty < 1 ? 1 : qty;
  renderCart();
}

function deleteItem(id){
  cart = cart.filter(product=>String(product.id) !== String(id));
  renderCart();
}

function isClearCartConfirmed(){
  return confirmClearInput && confirmClearInput.value.trim().toLowerCase() === "yes";
}

function openClearCartModal(){
  if(cart.length === 0){ alert("السلة فارغة"); return; }
  if(!clearCartModal || !confirmClearInput || !confirmClearCartButton){
    const answer = prompt("لتأكيد حذف جميع محتويات السلة اكتب Yes");
    if(String(answer || "").trim().toLowerCase() === "yes") clearCart();
    return;
  }
  confirmClearInput.value = "";
  confirmClearCartButton.disabled = true;
  clearCartModal.classList.add("active");
  clearCartModal.setAttribute("aria-hidden","false");
  setTimeout(()=>{ confirmClearInput.focus(); },50);
}

function closeClearCartModal(){
  if(!clearCartModal) return;
  clearCartModal.classList.remove("active");
  clearCartModal.classList.remove("show");
  clearCartModal.setAttribute("aria-hidden","true");
  if(confirmClearInput) confirmClearInput.value = "";
  if(confirmClearCartButton) confirmClearCartButton.disabled = true;
}

function clearCart(){
  cart = [];
  saveCart();
  renderCart();
  closeClearCartModal();
}

/* ========================
   INVOICE
   ======================== */

const INV_COUNTER_KEY = "sallah_invoice_counter";

function makeInvoiceNumber(){
  let counter = 1;
  try{
    const val = localStorage.getItem(INV_COUNTER_KEY);
    if(val) counter = parseInt(val, 10) || 1;
  }catch(e){}
  const num = String(counter).padStart(4, "0");
  localStorage.setItem(INV_COUNTER_KEY, String(counter + 1));
  return `INV-${num}`;
}

function formatInvoiceDate(){
  return new Date().toLocaleString("en-GB",{
    year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", hour12:false
  });
}

function getInvoiceCustomerName(){
  if(currentCustomer) return currentCustomer.name;
  return branchNameInput ? branchNameInput.value.trim() : "";
}

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

function populateBranchDropdown(){
  if(!branchNameInput) return;
  const currentVal = branchNameInput.value;
  branchNameInput.className = "branch-select";
  branchNameInput.innerHTML = '<option value="">-- Select Branch --</option>';
  getBranches().forEach(b => {
    const opt = document.createElement("option");
    opt.value = b;
    opt.textContent = b;
    branchNameInput.appendChild(opt);
  });
  if(currentVal) branchNameInput.value = currentVal;
}

function getBranchName(){
  return branchNameInput ? branchNameInput.value.trim() : "No Branch";
}

function getItemDetails(item){
  const details = [];
  if(item.description) details.push(escapeHTML(item.description));
  return details.join(" | ");
}

function createInvoiceCells(item){
  const description = item.description || "";
  return `
    <td class="invoice-check-cell">
      <span class="invoice-check-box"></span>
    </td>
    <td class="invoice-product-cell">
      <div class="invoice-product-main">
        <span class="invoice-product-number invoice-product-qty" title="Quantity">${getItemQty(item)}</span>
        <strong><bdi>${escapeHTML(item.name || "")}</bdi></strong>
      </div>
      ${description ? `<div class="invoice-product-details" dir="ltr" style="padding-right:80px;font-size:11px;color:#000000;">${escapeHTML(description)}</div>` : ""}
    </td>
  `;
}

function createEmptyInvoiceCells(){
  return `
    <td class="invoice-check-cell invoice-empty-cell"></td>
    <td class="invoice-product-cell invoice-empty-cell"></td>
  `;
}

function createInvoiceRowsFromCart(){
  const rows = [];
  for(let index = 0; index < cart.length; index += COLUMNS_PER_INVOICE_ROW){
    rows.push(cart.slice(index,index + COLUMNS_PER_INVOICE_ROW));
  }
  return rows;
}

function renderInvoiceRows(rows){
  if(!invoiceProducts) return;
  invoiceProducts.innerHTML = "";
  rows.forEach(rowItems=>{
    let rowHTML = "";
    rowItems.forEach(item=>{ rowHTML += createInvoiceCells(item); });
    for(let empty = rowItems.length; empty < COLUMNS_PER_INVOICE_ROW; empty++){
      rowHTML += createEmptyInvoiceCells();
    }
    invoiceProducts.insertAdjacentHTML("beforeend",`<tr>${rowHTML}</tr>`);
  });
}

function setInvoiceFooterVisible(isVisible){
  const summary = invoiceTemplate ? invoiceTemplate.querySelector(".invoice-summary-row") : null;
  const delivery = invoiceTemplate ? invoiceTemplate.querySelector(".invoice-delivery-info") : null;
  const display = isVisible ? "" : "none";
  if(summary) summary.style.display = display;
  if(delivery) delivery.style.display = display;
}

function getInvoiceMaxPageHeight(){
  const width = invoiceTemplate ? invoiceTemplate.scrollWidth : 1120;
  return Math.floor(width * (A4_HEIGHT_MM / A4_WIDTH_MM)) - 24;
}

function splitInvoiceRowsIntoPages(rows){
  const pages = [];
  const maxHeight = getInvoiceMaxPageHeight();
  let start = 0;
  while(start < rows.length){
    let end = start + 1;
    let lastGoodEnd = end;
    while(end <= rows.length){
      const candidateRows = rows.slice(start,end);
      const isLastPageCandidate = end === rows.length;
      renderInvoiceRows(candidateRows);
      setInvoiceFooterVisible(isLastPageCandidate);
      if(invoiceTemplate.scrollHeight <= maxHeight){
        lastGoodEnd = end;
        end++;
      }else{
        break;
      }
    }
    pages.push(rows.slice(start,lastGoodEnd));
    start = lastGoodEnd;
  }
  return pages;
}

function waitForImages(container){
  const images = container.querySelectorAll("img");
  return Promise.all(Array.from(images).map(img=>{
    return new Promise(resolve=>{
      if(img.complete){ resolve(); return; }
      img.onload = ()=>resolve();
      img.onerror = ()=>resolve();
      setTimeout(resolve,2000);
    });
  }));
}

async function renderInvoicePageToCanvas(){
  await waitForImages(invoiceTemplate);
  return html2canvas(invoiceTemplate,{
    scale:2, useCORS:true, backgroundColor:"#ffffff",
    windowWidth:invoiceTemplate.scrollWidth,
    windowHeight:invoiceTemplate.scrollHeight
  });
}

async function saveInvoiceToFirestore(invoiceNo, customerName){
  try{
    const items = cart.map(item=>({
      id: item.id,
      name: item.name || "",
      description: item.description || "",
      code: item.code || "",
      qty: getItemQty(item)
    }));

    const branchName = getBranchName();

    const invoiceData = {
      invoiceNo: invoiceNo,
      branchName: branchName,
      customerId: currentCustomer ? currentCustomer.id : "guest",
      customerName: customerName,
      items: items,
      totalItems: cart.length,
      totalQty: getCartTotalQty(),
      createdAt: serverTimestamp(),
      date: new Date().toISOString()
    };

    const invoicesRef = collection(db, INVOICES_COLLECTION);
    await addDoc(invoicesRef, invoiceData);
    console.log("Invoice saved to Firestore:", invoiceNo);
  }catch(error){
    console.error("Error saving invoice to Firestore:", error);
  }
}

async function downloadInvoicePdf(invoiceData){
  try{
    await generateInvoicePdf(invoiceData);
  }catch(error){
    console.error("Error generating PDF:", error);
    alert("Error generating PDF");
  }
}

async function createInvoice(){
  if(cart.length === 0){ alert("السلة فارغة"); return; }

  if(!currentCustomer){
    alert("Please login first to create invoice");
    openLoginModal();
    return;
  }

  const branchName = getBranchName();
  if(!branchName){
    alert("Please enter branch name first / قم بكتابة اسم الفرع أولاً");
    if(branchNameInput) branchNameInput.focus();
    return;
  }

  const customerName = currentCustomer.name;

  if(!invoiceTemplate || !invoiceNoElement || !invoiceDateElement || !invoiceCustomerElement || !invoiceTotalElement || !invoiceQtyElement){
    alert("قالب الفاتورة غير موجود في الصفحة");
    return;
  }

  const invoiceNo = makeInvoiceNumber();
  invoiceNoElement.textContent = invoiceNo;
  invoiceDateElement.textContent = formatInvoiceDate();
  invoiceCustomerElement.textContent = customerName;
  invoiceTotalElement.textContent = cart.length;
  invoiceQtyElement.textContent = getCartTotalQty();

  const recvBranchEl = document.getElementById("invRecvBranch");
  if(recvBranchEl){
    const parts = branchName.split(" - ");
    let formattedBranch = branchName;
    if(parts.length === 2){
      formattedBranch = parts[1] + " - " + parts[0];
    }
    recvBranchEl.textContent = formattedBranch;
  }

  const invoiceRows = createInvoiceRowsFromCart();
  const invoicePages = splitInvoiceRowsIntoPages(invoiceRows);
  const pdf = new window.jspdf.jsPDF("P","mm","A4");

  for(let pageIndex = 0; pageIndex < invoicePages.length; pageIndex++){
    const isLastPage = pageIndex === invoicePages.length - 1;
    renderInvoiceRows(invoicePages[pageIndex]);
    setInvoiceFooterVisible(isLastPage);
    const thead = invoiceTemplate.querySelector("#invoiceTable thead");
    if(thead) thead.style.display = pageIndex > 0 ? "none" : "";
    const canvas = await renderInvoicePageToCanvas();
    const imgData = canvas.toDataURL("image/png");
    const imgHeight = Math.min((canvas.height * A4_WIDTH_MM) / canvas.width, A4_HEIGHT_MM);
    if(pageIndex > 0) pdf.addPage();
    pdf.addImage(imgData,"PNG",0,0,A4_WIDTH_MM,imgHeight);
  }
  const thead = invoiceTemplate.querySelector("#invoiceTable thead");
  if(thead) thead.style.display = "";

  setInvoiceFooterVisible(true);
  pdf.save(`${branchName}-${invoiceNo}.pdf`);

  await saveInvoiceToFirestore(invoiceNo, customerName);
}

/* ========================
   EVENT LISTENERS
   ======================== */

if(cartItems){
  cartItems.addEventListener("click",event=>{
    const button = event.target.closest("button[data-action]");
    if(!button) return;
    const action = button.dataset.action;
    const id = button.dataset.id;
    if(action === "increase") increaseQty(id);
    if(action === "decrease") decreaseQty(id);
    if(action === "delete") deleteItem(id);
  });
  cartItems.addEventListener("change",event=>{
    const input = event.target.closest(".qty-input");
    if(!input) return;
    updateQty(input.dataset.id,input.value);
  });
}

if(cartSearch) cartSearch.addEventListener("input",renderCart);
if(createInvoiceButton) createInvoiceButton.addEventListener("click",createInvoice);
if(whatsappButton) whatsappButton.addEventListener("click",()=>{ window.open("https://wa.me/966541429240","_blank"); });
if(clearCartButton) clearCartButton.addEventListener("click",openClearCartModal);

if(confirmClearInput && confirmClearCartButton){
  confirmClearInput.addEventListener("input",()=>{ confirmClearCartButton.disabled = !isClearCartConfirmed(); });
  confirmClearInput.addEventListener("keydown",event=>{
    if(event.key === "Enter" && isClearCartConfirmed()) clearCart();
  });
}
if(cancelClearCartButton) cancelClearCartButton.addEventListener("click",closeClearCartModal);
if(confirmClearCartButton) confirmClearCartButton.addEventListener("click",()=>{ if(isClearCartConfirmed()) clearCart(); });
if(clearCartModal){
  clearCartModal.addEventListener("click",event=>{ if(event.target === clearCartModal) closeClearCartModal(); });
}
document.addEventListener("keydown",event=>{
  if(event.key === "Escape" && clearCartModal && clearCartModal.classList.contains("active")) closeClearCartModal();
  if(event.key === "Escape" && loginModal && loginModal.classList.contains("active")) closeLoginModal();
  if(event.key === "Escape" && invoicesModal && invoicesModal.classList.contains("active")) closeInvoicesModal();
  if(event.key === "Escape" && invoiceDetailModal && invoiceDetailModal.classList.contains("active")) closeInvoiceDetailModal();
});

/* LOGIN EVENTS */
if(loginBtn) loginBtn.addEventListener("click", openLoginModal);
if(profileLogoutBtn){
  profileLogoutBtn.addEventListener("click", ()=>{
    closeProfileDropdown();
    const ok = confirm("Logout?");
    if(ok) clearSession();
  });
}
if(loginModalClose) loginModalClose.addEventListener("click", closeLoginModal);
if(loginModal){
  loginModal.addEventListener("click", event=>{
    if(event.target === loginModal) closeLoginModal();
  });
}

/* PROFILE DROPDOWN */
if(profileToggle){
  profileToggle.addEventListener("click", (e)=>{
    e.stopPropagation();
    profileDropdown.classList.toggle("show");
  });
}

function closeProfileDropdown(){
  if(profileDropdown) profileDropdown.classList.remove("show");
}

document.addEventListener("click", (e)=>{
  if(profileDropdown && profileDropdown.classList.contains("show") && !profileDropdown.contains(e.target) && e.target !== profileToggle){
    closeProfileDropdown();
  }
});

if(profileTogglePin){
  profileTogglePin.addEventListener("click", ()=>{
    if(profilePin.textContent === "****"){
      profilePin.textContent = currentCustomerPin || "N/A";
      profileTogglePin.textContent = "Hide";
    }else{
      profilePin.textContent = "****";
      profileTogglePin.textContent = "Show";
    }
  });
}

if(profileChangePinBtn){
  profileChangePinBtn.addEventListener("click", async ()=>{
    closeProfileDropdown();
    const newPin = prompt("Enter new PIN (4 digits):");
    if(!newPin || !/^\d{4}$/.test(newPin)){
      alert("PIN must be exactly 4 digits");
      return;
    }
    currentCustomerPin = newPin;
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
    stored.pin = newPin;
    localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
    const localCustomers = getLocalCustomers();
    const idx = localCustomers.findIndex(c => c.id === currentCustomer.id);
    if(idx !== -1){
      localCustomers[idx].pin = newPin;
      saveLocalCustomers(localCustomers);
      customersCache = getLocalCustomers();
    }
    try{
      const customerRef = doc(db, CUSTOMERS_COLLECTION, currentCustomer.id);
      await updateDoc(customerRef, { pin: newPin });
    }catch(error){
      console.warn("Firestore PIN update failed (local update succeeded):", error);
    }
    alert("PIN changed successfully");
  });
}

if(profileInvoicesBtn){
  profileInvoicesBtn.addEventListener("click", ()=>{
    closeProfileDropdown();
    openInvoicesModal();
  });
}

function setLoginMode(){
  authMode = "login";
  authLoginTab.classList.add("active");
  authRegisterTab.classList.remove("active");
  if(authSubtitle) authSubtitle.textContent = "Select your name and enter PIN";
  if(loginSubmit) loginSubmit.textContent = "Login";
  if(loginError) loginError.textContent = "";
  if(loginNameInput) loginNameInput.style.display = "block";
  if(registerNameInput) registerNameInput.style.display = "none";
}

function setRegisterMode(){
  authMode = "register";
  authRegisterTab.classList.add("active");
  authLoginTab.classList.remove("active");
  if(authSubtitle) authSubtitle.textContent = "Create a new account with name and PIN";
  if(loginSubmit) loginSubmit.textContent = "Register";
  if(loginError) loginError.textContent = "";
  if(loginNameInput) loginNameInput.style.display = "none";
  if(registerNameInput){ registerNameInput.style.display = "block"; registerNameInput.value = ""; registerNameInput.focus(); }
}

if(authLoginTab){
  authLoginTab.addEventListener("click", setLoginMode);
}

if(authRegisterTab){
  authRegisterTab.addEventListener("click", setRegisterMode);
}

if(loginSubmit){
  loginSubmit.addEventListener("click", async()=>{
    try{
      if(loginError) loginError.textContent = "";
      loginSubmit.disabled = true;
      loginSubmit.textContent = "Verifying...";

      const name = authMode === "register"
        ? (registerNameInput ? registerNameInput.value.trim() : "")
        : (loginNameInput ? loginNameInput.value.trim() : "");
      const pin = loginPinInput ? loginPinInput.value.trim() : "";

      console.log("Submit: mode=", authMode, "name=", name, "pin=", pin);

      if(!name){
        if(loginError) loginError.textContent = "Please select/enter your name";
        loginSubmit.disabled = false;
        loginSubmit.textContent = authMode === "register" ? "Register" : "Login";
        return;
      }
      if(!pin || pin.length !== 4){
        if(loginError) loginError.textContent = "PIN must be 4 digits";
        loginSubmit.disabled = false;
        loginSubmit.textContent = authMode === "register" ? "Register" : "Login";
        return;
      }

      let result;
      if(authMode === "register"){
        result = await registerCustomer(name, pin);
      }else{
        result = await loginCustomer(name, pin);
      }

      console.log("Submit: result=", JSON.stringify(result));

      if(result.error){
        if(loginError) loginError.textContent = result.error;
        console.log("Submit: error displayed:", result.error);
      }else if(result.success){
        console.log("Submit: success, saving session");
        saveSession(result.customer, result.pin);
        closeLoginModal();
        console.log("Submit: session saved and modal closed");
      }else{
        console.warn("Submit: unexpected result:", result);
        if(loginError) loginError.textContent = "Unexpected error, try again";
      }
    }catch(err){
      console.error("Login submit error:", err);
      if(loginError) loginError.textContent = "Error: " + err.message;
    }finally{
      loginSubmit.disabled = false;
      loginSubmit.textContent = authMode === "register" ? "Register" : "Login";
    }
  });
}

if(loginPinInput){
  loginPinInput.addEventListener("keydown", event=>{
    if(event.key === "Enter" && loginSubmit) loginSubmit.click();
  });
}

/* INVOICES HISTORY EVENTS */
if(invoicesModalClose) invoicesModalClose.addEventListener("click", closeInvoicesModal);
if(invoicesCloseBtn) invoicesCloseBtn.addEventListener("click", closeInvoicesModal);
if(invoicesModal){
  invoicesModal.addEventListener("click", event=>{
    if(event.target === invoicesModal) closeInvoicesModal();
  });
}

/* INVOICE DETAIL EVENTS */
if(invoiceDetailClose) invoiceDetailClose.addEventListener("click", closeInvoiceDetailModal);
if(invoiceDetailModal){
  invoiceDetailModal.addEventListener("click", event=>{
    if(event.target === invoiceDetailModal) closeInvoiceDetailModal();
  });
}

/* ========================
   INIT
   ======================== */

loadSession();
loadCustomersCache();
populateBranchDropdown();
renderCart();
