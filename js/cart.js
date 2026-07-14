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
let currentCustomerPin = "";
let customersCache = [];
let customersCacheLoaded = false;

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
const profileType = document.getElementById("profileType");
const profilePin = document.getElementById("profilePin");
const profileTogglePin = document.getElementById("profileTogglePin");
const profileChangePinBtn = document.getElementById("profileChangePinBtn");
const profileInvoicesBtn = document.getElementById("profileInvoicesBtn");
const profileLogoutBtn = document.getElementById("profileLogoutBtn");
const loggedInUser = document.getElementById("loggedInUser");
const profileAvatar = document.getElementById("profileAvatar");

const loginModal = document.getElementById("loginModal");
const loginModalClose = document.getElementById("loginModalClose");
const loginAccountType = document.getElementById("loginAccountType");
const loginNameInput = document.getElementById("loginName");
const loginPinInput = document.getElementById("loginPin");
const loginSubmit = document.getElementById("loginSubmit");
const loginError = document.getElementById("loginError");

const invoicesModal = document.getElementById("invoicesModal");
const invoicesModalClose = document.getElementById("invoicesModalClose");
const invoicesList = document.getElementById("invoicesList");
const invoicesSubtitle = document.getElementById("invoicesSubtitle");
const invoicesCloseBtn = document.getElementById("invoicesCloseBtn");
const invoiceDetailModal = document.getElementById("invoiceDetailModal");
const invoiceDetailClose = document.getElementById("invoiceDetailClose");
const invoiceDetailContent = document.getElementById("invoiceDetailContent");

const COLUMNS_PER_INVOICE_ROW = 3;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const ARABIC_DAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const ARABIC_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

function escapeHTML(value){
  return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function getItemQty(item){
  const qty = parseInt(item.qty,10);
  return isNaN(qty) || qty < 1 ? 1 : qty;
}

function getProductImage(item){
  if(item.image && typeof item.image === "string" && item.image.trim() !== "") return item.image;
  return "images/noimg.jpg";
}

function saveCart(){ localStorage.setItem("cart",JSON.stringify(cart)); }
function getCartTotalQty(){ return cart.reduce((sum,item)=>sum + getItemQty(item),0); }

function formatArabicDate(date){
  const d = date instanceof Timestamp ? date.toDate() : (date?.toDate ? date.toDate() : new Date(date));
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
      currentCustomer = { id:data.id, name:data.name, accountType:data.accountType||"", permissions:data.permissions||{} };
      currentCustomerPin = data.pin || "";
      updateAuthUI();
    }catch(e){ currentCustomer = null; }
  }
}

function saveSession(customer, pin){
  currentCustomer = customer;
  currentCustomerPin = pin || "";
  const sessionData = { id:customer.id, name:customer.name, pin:currentCustomerPin, accountType:customer.accountType||"", permissions:customer.permissions||{} };
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  updateAuthUI();
}

function clearSession(){
  currentCustomer = null;
  currentCustomerPin = "";
  localStorage.removeItem(SESSION_KEY);
  updateAuthUI();
}

function updateAuthUI(){
  if(currentCustomer){
    if(loginBtn) loginBtn.style.display = "none";
    if(userProfile) userProfile.style.display = "inline-flex";
    if(loggedInUser) loggedInUser.textContent = currentCustomer.name;
    if(profileName) profileName.textContent = currentCustomer.name;
    if(profileType) profileType.textContent = currentCustomer.accountType || "غير محدد";
    if(profileAvatar) profileAvatar.textContent = (currentCustomer.name || "?")[0];
  }else{
    if(loginBtn) loginBtn.style.display = "inline-flex";
    if(userProfile) userProfile.style.display = "none";
  }
}

/* ========================
   LOCAL CUSTOMER STORAGE
   ======================== */

function getLocalCustomers(){
  try{ return JSON.parse(localStorage.getItem(CUSTOMERS_LOCAL_KEY)) || []; }catch(e){ return []; }
}
function saveLocalCustomers(arr){ localStorage.setItem(CUSTOMERS_LOCAL_KEY, JSON.stringify(arr)); }

function getCustomerByName(name){
  const trimmed = name.trim().toLowerCase();
  return customersCache.find(c => String(c.name || "").trim().toLowerCase() === trimmed) || null;
}

async function loadCustomersCache(){
  customersCache = getLocalCustomers();
  customersCacheLoaded = true;
  try{
    const snapshot = await getDocs(collection(db, CUSTOMERS_COLLECTION));
    const firestoreCustomers = snapshot.docs.map(d => ({ id:d.id, ...d.data() }));
    const localIds = new Set(customersCache.map(c => c.id));
    const localNames = new Set(customersCache.map(c => String(c.name || "").trim().toLowerCase()));
    let changed = false;
    firestoreCustomers.forEach(fc => {
      if(!localIds.has(fc.id) && !localNames.has(String(fc.name || "").trim().toLowerCase())){
        customersCache.push(fc); localIds.add(fc.id); localNames.add(String(fc.name || "").trim().toLowerCase()); changed = true;
      }
    });
    if(changed) saveLocalCustomers(customersCache);
  }catch(e){}
}

function populateCustomerDropdown(accountType){
  if(!loginNameInput) return;
  loginNameInput.innerHTML = '<option value="">-- اختر الاسم --</option>';
  let filtered = customersCache;
  if(accountType) filtered = customersCache.filter(c => (c.accountType || "") === accountType);
  const sorted = [...filtered].sort((a,b) => String(a.name || "").localeCompare(String(b.name || ""), "ar"));
  sorted.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = c.name;
    loginNameInput.appendChild(opt);
  });
}

/* ========================
   LOGIN MODAL (no registration)
   ======================== */

function openLoginModal(){
  if(!loginModal) return;
  if(!customersCacheLoaded || !customersCache.length) loadCustomersCache();
  loginModal.hidden = false;
  loginModal.setAttribute("aria-hidden","false");
  if(loginAccountType) loginAccountType.style.display = "block";
  if(loginAccountType) loginAccountType.value = "";
  if(loginNameInput) loginNameInput.style.display = "none";
  if(loginNameInput) loginNameInput.value = "";
  if(loginPinInput) loginPinInput.style.display = "none";
  if(loginPinInput) loginPinInput.value = "";
  if(loginSubmit) loginSubmit.style.display = "none";
  if(loginError) loginError.textContent = "";
  requestAnimationFrame(()=> loginModal.classList.add("active"));
}

function closeLoginModal(){
  if(!loginModal) return;
  loginModal.classList.remove("active");
  loginModal.setAttribute("aria-hidden","true");
  setTimeout(()=>{ loginModal.hidden = true; },200);
}

loginAccountType?.addEventListener("change", function(){
  const val = this.value;
  if(val){
    populateCustomerDropdown(val);
    if(loginNameInput) loginNameInput.style.display = "block";
    if(loginPinInput) loginPinInput.style.display = "none";
    if(loginSubmit) loginSubmit.style.display = "none";
  }else{
    if(loginNameInput) loginNameInput.style.display = "none";
    if(loginPinInput) loginPinInput.style.display = "none";
    if(loginSubmit) loginSubmit.style.display = "none";
  }
});

loginNameInput?.addEventListener("change", function(){
  if(this.value){
    if(loginPinInput) loginPinInput.style.display = "block";
    if(loginSubmit) loginSubmit.style.display = "block";
  }else{
    if(loginPinInput) loginPinInput.style.display = "none";
    if(loginSubmit) loginSubmit.style.display = "none";
  }
});

loginPinInput?.addEventListener("keydown", e => { if(e.key === "Enter") loginSubmit?.click(); });

loginSubmit?.addEventListener("click", () => {
  if(loginError) loginError.textContent = "";
  const name = loginNameInput ? loginNameInput.value.trim() : "";
  const pin = loginPinInput ? loginPinInput.value.trim() : "";
  const accountType = loginAccountType ? loginAccountType.value : "";

  if(!accountType){ if(loginError) loginError.textContent = "اختر نوع الحساب"; return; }
  if(!name){ if(loginError) loginError.textContent = "اختر الاسم"; return; }
  if(!pin || pin.length !== 4){ if(loginError) loginError.textContent = "كلمة المرور 4 أرقام"; return; }

  const match = getCustomerByName(name);
  if(!match){ if(loginError) loginError.textContent = "الحساب غير موجود"; return; }
  if(String(match.pin) === pin){
    saveSession({ id:match.id, name:match.name, accountType:match.accountType || accountType, permissions:match.permissions || {} }, pin);
    closeLoginModal();
  }else{
    if(loginError) loginError.textContent = "كلمة المرور خاطئة";
  }
});

loginBtn?.addEventListener("click", openLoginModal);
loginModalClose?.addEventListener("click", closeLoginModal);
loginModal?.addEventListener("click", e => { if(e.target === loginModal) closeLoginModal(); });

/* ========================
   PROFILE DROPDOWN
   ======================== */

profileToggle?.addEventListener("click", e => { e.stopPropagation(); profileDropdown?.classList.toggle("show"); });
document.addEventListener("click", e => { if(profileDropdown?.classList.contains("show") && !profileDropdown.contains(e.target) && e.target !== profileToggle) profileDropdown.classList.remove("show"); });

profileLogoutBtn?.addEventListener("click", () => {
  profileDropdown?.classList.remove("show");
  if(confirm("هل تريد تسجيل الخروج؟")) clearSession();
});

profileTogglePin?.addEventListener("click", () => {
  if(!profilePin) return;
  if(profilePin.textContent === "****"){ profilePin.textContent = currentCustomerPin || "N/A"; profileTogglePin.textContent = "إخفاء"; }
  else{ profilePin.textContent = "****"; profileTogglePin.textContent = "إظهار"; }
});

profileChangePinBtn?.addEventListener("click", async () => {
  profileDropdown?.classList.remove("show");
  const newPin = prompt("أدخل كلمة المرور الجديدة (4 أرقام):");
  if(!newPin || !/^\d{4}$/.test(newPin)){ alert("يجب أن تكون 4 أرقام"); return; }
  currentCustomerPin = newPin;
  const stored = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
  stored.pin = newPin;
  localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
  const localCustomers = getLocalCustomers();
  const idx = localCustomers.findIndex(c => c.id === currentCustomer.id);
  if(idx !== -1){ localCustomers[idx].pin = newPin; saveLocalCustomers(localCustomers); customersCache = getLocalCustomers(); }
  try{
    const customerRef = doc(db, CUSTOMERS_COLLECTION, currentCustomer.id);
    await updateDoc(customerRef, { pin: newPin });
  }catch(e){}
  alert("تم تغيير كلمة المرور");
});

profileInvoicesBtn?.addEventListener("click", () => {
  profileDropdown?.classList.remove("show");
  openInvoicesModal();
});

/* ========================
   INVOICES MODAL
   ======================== */

function openInvoicesModal(){
  if(!invoicesModal) return;
  invoicesModal.hidden = false;
  invoicesModal.setAttribute("aria-hidden","false");
  if(invoicesList) invoicesList.innerHTML = '<div class="loading-text">جاري تحميل الفواتير...</div>';
  if(invoicesSubtitle) invoicesSubtitle.textContent = `العميل: ${currentCustomer?.name || ""}`;
  requestAnimationFrame(()=> invoicesModal.classList.add("active"));
  loadCustomerInvoices();
}

function closeInvoicesModal(){
  if(!invoicesModal) return;
  invoicesModal.classList.remove("active");
  invoicesModal.setAttribute("aria-hidden","true");
  setTimeout(()=>{ invoicesModal.hidden = true; },200);
}

function openInvoiceDetailModal(inv){
  if(!invoiceDetailModal || !invoiceDetailContent) return;
  const dateStr = formatArabicDate(inv.createdAt || inv.date);
  let itemsHtml = "";
  if(inv.items && inv.items.length){
    inv.items.forEach((item,idx) => {
      itemsHtml += `<tr><td>${idx+1}</td><td>${escapeHTML(item.name||"")}</td><td>${escapeHTML(item.code||"")}</td><td>${getItemQty(item)}</td></tr>`;
    });
  }
  const displayName = inv.branchName || inv.invoiceNo || "";
  const invShortNo = (inv.invoiceNo || "").replace("INV-","");
  const accType = inv.accountType || "";
  invoiceDetailContent.innerHTML = `
    <div style="text-align:center;margin-bottom:14px;">
      <img src="images/logo.png" style="width:80px;height:auto;margin:0 auto 6px;" alt="Logo" onerror="this.style.display='none'">
      <h2 style="color:var(--dark);font-size:20px;">تفاصيل الفاتورة</h2>
    </div>
    <div class="invoice-detail-meta">
      <div><span>رقم الفاتورة</span><strong>${escapeHTML(invShortNo)}</strong></div>
      <div><span>العميل</span><strong>${escapeHTML(inv.customerName||"")}</strong></div>
      <div><span>التاريخ</span><strong>${escapeHTML(dateStr)}</strong></div>
      ${accType ? `<div><span>نوع الحساب</span><strong>${escapeHTML(accType)}</strong></div>` : ""}
    </div>
    <table class="invoice-detail-table">
      <thead><tr><th>#</th><th>المنتج</th><th>KOD</th><th>الكمية</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div class="invoice-detail-summary">
      <span>المنتجات: ${inv.totalItems||0}</span>
      <span>الكمية: ${inv.totalQty||0}</span>
    </div>
    <div style="text-align:center;margin-top:14px;">
      <button id="detailPrintBtn" class="inv-print-small-btn" type="button" style="width:auto;padding:8px 24px;font-size:14px;">🖨 طباعة PDF</button>
    </div>
  `;
  invoiceDetailContent.querySelector("#detailPrintBtn")?.addEventListener("click", ()=> downloadInvoicePdf(inv));
  invoiceDetailModal.hidden = false;
  invoiceDetailModal.setAttribute("aria-hidden","false");
  requestAnimationFrame(()=> invoiceDetailModal.classList.add("active"));
}

function closeInvoiceDetailModal(){
  if(!invoiceDetailModal) return;
  invoiceDetailModal.classList.remove("active");
  invoiceDetailModal.setAttribute("aria-hidden","true");
  setTimeout(()=>{ invoiceDetailModal.hidden = true; },200);
}

async function loadCustomerInvoices(){
  if(!currentCustomer || !invoicesList) return;
  try{
    const invoicesRef = collection(db, INVOICES_COLLECTION);
    let snapshot;
    try{
      const q = query(invoicesRef, where("customerId","==",currentCustomer.id), orderBy("createdAt","desc"));
      snapshot = await getDocs(q);
    }catch(e){
      const q = query(invoicesRef, where("customerId","==",currentCustomer.id));
      snapshot = await getDocs(q);
    }
    if(snapshot.empty){ invoicesList.innerHTML = '<div class="empty-text">لا توجد فواتير</div>'; return; }
    invoicesList.innerHTML = "";
    snapshot.forEach(doc => {
      const inv = doc.data();
      const dateStr = formatArabicDate(inv.createdAt || inv.date);
      let itemsPreview = "";
      if(inv.items && inv.items.length){
        itemsPreview = inv.items.slice(0,3).map(i=>i.name).join("، ");
        if(inv.items.length > 3) itemsPreview += `...+${inv.items.length-3}`;
      }
      const accType = inv.accountType || "";
      const div = document.createElement("div");
      div.className = "invoice-history-card";
      div.innerHTML = `
        <div class="invoice-history-top">
          <strong class="invoice-history-no">${escapeHTML(inv.branchName || inv.invoiceNo || "")}</strong>
          <span class="invoice-history-date">${dateStr}</span>
        </div>
        ${accType ? `<div style="font-size:11px;color:var(--accent);font-weight:700;margin-bottom:4px;">${escapeHTML(accType)}</div>` : ""}
        <div class="invoice-history-items">${escapeHTML(itemsPreview)}</div>
        <div class="invoice-history-footer">
          <span>المنتجات: ${inv.totalItems||0}</span>
          <span>الكمية: ${inv.totalQty||0}</span>
        </div>
        <div style="margin-top:8px;"><button class="inv-print-small-btn" type="button">🖨 طباعة</button></div>
      `;
      div.querySelector(".inv-print-small-btn").addEventListener("click", e => { e.stopPropagation(); downloadInvoicePdf(inv); });
      div.addEventListener("click", ()=> openInvoiceDetailModal(inv));
      invoicesList.appendChild(div);
    });
  }catch(e){
    invoicesList.innerHTML = '<div class="error-text">حدث خطأ</div>';
  }
}

invoicesModalClose?.addEventListener("click", closeInvoicesModal);
invoicesCloseBtn?.addEventListener("click", closeInvoicesModal);
invoicesModal?.addEventListener("click", e => { if(e.target === invoicesModal) closeInvoicesModal(); });
invoiceDetailClose?.addEventListener("click", closeInvoiceDetailModal);
invoiceDetailModal?.addEventListener("click", e => { if(e.target === invoiceDetailModal) closeInvoiceDetailModal(); });

/* ========================
   CART RENDER
   ======================== */

let cartCategory = "all";

function getFilteredCart(){
  if(cartCategory === "all") return cart;
  return cart.filter(item => (item.category || "") === cartCategory);
}

function renderCart(){
  if(!cartItems) return;
  cartItems.innerHTML = "";
  const searchText = cartSearch ? cartSearch.value.trim().toLowerCase() : "";
  let visibleItems = 0;
  const filtered = getFilteredCart();

  filtered.forEach(item => {
    const productText = `${item.name||""} ${item.description||""} ${item.code||""}`.toLowerCase();
    if(searchText && !productText.includes(searchText)) return;
    visibleItems++;
    cartItems.insertAdjacentHTML("beforeend",`
      <div class="cart-item">
        <img src="${escapeHTML(getProductImage(item))}" alt="${escapeHTML(item.name||"")}" onerror="this.src='images/noimg.jpg'">
        <div class="info">
          <h3>${escapeHTML(item.name||"")}</h3>
          <p>${escapeHTML(item.description||"")}</p>
          <p style="font-size:12px;color:var(--card);">SKU: ${escapeHTML(item.code||"")} | ${escapeHTML(item.category||"")}</p>
          <div class="qty-controls">
            <button type="button" data-action="decrease" data-id="${escapeHTML(item.id)}">-</button>
            <input type="number" min="1" value="${getItemQty(item)}" class="qty-input" data-id="${escapeHTML(item.id)}">
            <button type="button" data-action="increase" data-id="${escapeHTML(item.id)}">+</button>
          </div>
        </div>
        <button type="button" class="delete-cart-item" data-action="delete" data-id="${escapeHTML(item.id)}">🗑 حذف</button>
      </div>
    `);
  });

  if(cart.length === 0){
    cartItems.innerHTML = '<div class="cart-item"><div class="info"><h3>🛒 السلة فارغة</h3><p>أضف منتجات من المتجر</p></div></div>';
  }else if(visibleItems === 0){
    cartItems.innerHTML = '<div class="cart-item"><div class="info"><h3>لا توجد نتائج مطابقة</h3></div></div>';
  }

  if(cartTotal) cartTotal.textContent = getCartTotalQty();
  saveCart();
}

function findItem(id){ return cart.find(item => String(item.id) === String(id)); }
function increaseQty(id){ const item = findItem(id); if(!item) return; item.qty = getItemQty(item)+1; renderCart(); }
function decreaseQty(id){
  const item = findItem(id);
  if(!item) return;
  item.qty = getItemQty(item)-1;
  if(item.qty <= 0) cart = cart.filter(p => String(p.id) !== String(id));
  renderCart();
}
function updateQty(id,value){ const item = findItem(id); if(!item) return; const qty = parseInt(value,10); item.qty = isNaN(qty) || qty < 1 ? 1 : qty; renderCart(); }
function deleteItem(id){ cart = cart.filter(p => String(p.id) !== String(id)); renderCart(); }

/* CART CATEGORY FILTER */
document.querySelectorAll("#cartCategoryFilter .cat-card").forEach(card => {
  card.addEventListener("click", () => {
    document.querySelectorAll("#cartCategoryFilter .cat-card").forEach(c => c.classList.remove("active"));
    card.classList.add("active");
    cartCategory = card.dataset.cat;
    renderCart();
  });
});

/* ========================
   CLEAR CART
   ======================== */

function isClearCartConfirmed(){ return confirmClearInput && confirmClearInput.value.trim().toLowerCase() === "yes"; }

function openClearCartModal(){
  if(cart.length === 0){ alert("السلة فارغة"); return; }
  if(!clearCartModal || !confirmClearInput || !confirmClearCartButton){ return; }
  confirmClearInput.value = "";
  confirmClearCartButton.disabled = true;
  clearCartModal.classList.add("active");
  clearCartModal.setAttribute("aria-hidden","false");
  setTimeout(()=> confirmClearInput.focus(), 50);
}

function closeClearCartModal(){
  if(!clearCartModal) return;
  clearCartModal.classList.remove("active");
  clearCartModal.setAttribute("aria-hidden","true");
  if(confirmClearInput) confirmClearInput.value = "";
  if(confirmClearCartButton) confirmClearCartButton.disabled = true;
}

function clearCart(){ cart = []; saveCart(); renderCart(); closeClearCartModal(); }

/* ========================
   INVOICE
   ======================== */

const INV_COUNTER_KEY = "sallah_invoice_counter";

function makeInvoiceNumber(){
  let counter = 1;
  try{ const val = localStorage.getItem(INV_COUNTER_KEY); if(val) counter = parseInt(val,10)||1; }catch(e){}
  const num = String(counter).padStart(4,"0");
  localStorage.setItem(INV_COUNTER_KEY, String(counter+1));
  return `INV-${num}`;
}

function formatInvoiceDate(){
  return new Date().toLocaleString("en-GB",{ year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false });
}

const BRANCHES_KEY = "sallah_branches";
const DEFAULT_BRANCHES = ["فرع الحمدانية - Hamdanya","فرع الطائف - Altayf","فرع السامر - Al-Samer","فرع المعمل - Almamal"];

function getBranches(){
  try{ const data = localStorage.getItem(BRANCHES_KEY); if(data){ const parsed = JSON.parse(data); if(Array.isArray(parsed) && parsed.length) return parsed; } }catch(e){}
  return [...DEFAULT_BRANCHES];
}
function saveBranches(list){ localStorage.setItem(BRANCHES_KEY, JSON.stringify(list)); }

function populateBranchDropdown(){
  if(!branchNameInput) return;
  const currentVal = branchNameInput.value;
  branchNameInput.innerHTML = '<option value="">-- اختر الفرع --</option>';
  getBranches().forEach(b => {
    const opt = document.createElement("option");
    opt.value = b;
    opt.textContent = b;
    branchNameInput.appendChild(opt);
  });
  if(currentVal) branchNameInput.value = currentVal;
}

function getBranchName(){ return branchNameInput ? branchNameInput.value.trim() : "No Branch"; }

function createInvoiceCells(item){
  const description = item.description || "";
  return `
    <td class="invoice-check-cell"><span class="invoice-check-box"></span></td>
    <td class="invoice-product-cell">
      <div class="invoice-product-main">
        <span class="invoice-product-number invoice-product-qty" title="Quantity">${getItemQty(item)}</span>
        <strong><bdi>${escapeHTML(item.name||"")}</bdi></strong>
      </div>
      ${description ? `<div class="invoice-product-details" dir="ltr" style="padding-right:80px;font-size:11px;color:#000000;">${escapeHTML(description)}</div>` : ""}
    </td>
  `;
}

function createEmptyInvoiceCells(){ return '<td class="invoice-check-cell invoice-empty-cell"></td><td class="invoice-product-cell invoice-empty-cell"></td>'; }

function createInvoiceRowsFromCart(){
  const rows = [];
  for(let i = 0; i < cart.length; i += COLUMNS_PER_INVOICE_ROW) rows.push(cart.slice(i, i + COLUMNS_PER_INVOICE_ROW));
  return rows;
}

function renderInvoiceRows(rows){
  if(!invoiceProducts) return;
  invoiceProducts.innerHTML = "";
  rows.forEach(rowItems => {
    let rowHTML = "";
    rowItems.forEach(item => { rowHTML += createInvoiceCells(item); });
    for(let e = rowItems.length; e < COLUMNS_PER_INVOICE_ROW; e++) rowHTML += createEmptyInvoiceCells();
    invoiceProducts.insertAdjacentHTML("beforeend", `<tr>${rowHTML}</tr>`);
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
      renderInvoiceRows(rows.slice(start,end));
      setInvoiceFooterVisible(end === rows.length);
      if(invoiceTemplate.scrollHeight <= maxHeight){ lastGoodEnd = end; end++; }else break;
    }
    pages.push(rows.slice(start, lastGoodEnd));
    start = lastGoodEnd;
  }
  return pages;
}

function waitForImages(container){
  return Promise.all(Array.from(container.querySelectorAll("img")).map(img => new Promise(resolve => {
    if(img.complete){ resolve(); return; }
    img.onload = ()=>resolve(); img.onerror = ()=>resolve(); setTimeout(resolve,2000);
  })));
}

async function renderInvoicePageToCanvas(){
  await waitForImages(invoiceTemplate);
  return html2canvas(invoiceTemplate,{ scale:2, useCORS:true, backgroundColor:"#ffffff", windowWidth:invoiceTemplate.scrollWidth, windowHeight:invoiceTemplate.scrollHeight });
}

async function saveInvoiceToFirestore(invoiceNo, customerName){
  try{
    const items = cart.map(item => ({
      id:item.id, name:item.name||"", description:item.description||"", code:item.code||"", category:item.category||"", qty:getItemQty(item)
    }));
    const branchName = getBranchName();
    const invoiceData = {
      invoiceNo, branchName,
      customerId: currentCustomer ? currentCustomer.id : "guest",
      customerName,
      accountType: currentCustomer ? (currentCustomer.accountType || "") : "",
      items, totalItems:cart.length, totalQty:getCartTotalQty(),
      createdAt:serverTimestamp(), date:new Date().toISOString()
    };
    await addDoc(collection(db, INVOICES_COLLECTION), invoiceData);
    console.log("Invoice saved:", invoiceNo);
  }catch(error){
    console.error("Error saving invoice:", error);
  }
}

async function downloadInvoicePdf(invoiceData){
  try{ await generateInvoicePdf(invoiceData); }catch(e){ console.error("PDF error:", e); alert("Error generating PDF"); }
}

async function createInvoice(){
  if(cart.length === 0){ alert("السلة فارغة"); return; }
  if(!currentCustomer){ alert("سجل الدخول أولاً لإنشاء فاتورة"); openLoginModal(); return; }
  const branchName = getBranchName();
  if(!branchName){ alert("اختر الفرع أولاً"); if(branchNameInput) branchNameInput.focus(); return; }
  if(!invoiceTemplate || !invoiceNoElement || !invoiceDateElement || !invoiceCustomerElement || !invoiceTotalElement || !invoiceQtyElement){ alert("قالب الفاتورة غير موجود"); return; }

  const invoiceNo = makeInvoiceNumber();
  invoiceNoElement.textContent = invoiceNo;
  invoiceDateElement.textContent = formatInvoiceDate();
  invoiceCustomerElement.textContent = currentCustomer.name;
  invoiceTotalElement.textContent = cart.length;
  invoiceQtyElement.textContent = getCartTotalQty();

  const recvBranchEl = document.getElementById("invRecvBranch");
  if(recvBranchEl){
    const parts = branchName.split(" - ");
    recvBranchEl.textContent = parts.length === 2 ? parts[1]+" - "+parts[0] : branchName;
  }

  const invoiceRows = createInvoiceRowsFromCart();
  const invoicePages = splitInvoiceRowsIntoPages(invoiceRows);
  const pdf = new window.jspdf.jsPDF("P","mm","A4");

  for(let pi = 0; pi < invoicePages.length; pi++){
    const isLastPage = pi === invoicePages.length - 1;
    renderInvoiceRows(invoicePages[pi]);
    setInvoiceFooterVisible(isLastPage);
    const thead = invoiceTemplate.querySelector("#invoiceTable thead");
    if(thead) thead.style.display = pi > 0 ? "none" : "";
    const canvas = await renderInvoicePageToCanvas();
    const imgData = canvas.toDataURL("image/png");
    const imgHeight = Math.min((canvas.height * A4_WIDTH_MM) / canvas.width, A4_HEIGHT_MM);
    if(pi > 0) pdf.addPage();
    pdf.addImage(imgData,"PNG",0,0,A4_WIDTH_MM,imgHeight);
  }
  const thead = invoiceTemplate.querySelector("#invoiceTable thead");
  if(thead) thead.style.display = "";
  setInvoiceFooterVisible(true);
  pdf.save(`${branchName}-${invoiceNo}.pdf`);

  await saveInvoiceToFirestore(invoiceNo, currentCustomer.name);
}

/* ========================
   EVENT LISTENERS
   ======================== */

if(cartItems){
  cartItems.addEventListener("click", event => {
    const btn = event.target.closest("button[data-action]");
    if(!btn) return;
    const {action, id} = btn.dataset;
    if(action === "increase") increaseQty(id);
    if(action === "decrease") decreaseQty(id);
    if(action === "delete") deleteItem(id);
  });
  cartItems.addEventListener("change", event => {
    const input = event.target.closest(".qty-input");
    if(input) updateQty(input.dataset.id, input.value);
  });
}

if(cartSearch) cartSearch.addEventListener("input", renderCart);
if(createInvoiceButton) createInvoiceButton.addEventListener("click", createInvoice);
if(whatsappButton) whatsappButton.addEventListener("click", ()=> window.open("https://wa.me/966541429240","_blank"));
if(clearCartButton) clearCartButton.addEventListener("click", openClearCartModal);

if(confirmClearInput && confirmClearCartButton){
  confirmClearInput.addEventListener("input", ()=>{ confirmClearCartButton.disabled = !isClearCartConfirmed(); });
  confirmClearInput.addEventListener("keydown", e => { if(e.key === "Enter" && isClearCartConfirmed()) clearCart(); });
}
if(cancelClearCartButton) cancelClearCartButton.addEventListener("click", closeClearCartModal);
if(confirmClearCartButton) confirmClearCartButton.addEventListener("click", ()=>{ if(isClearCartConfirmed()) clearCart(); });
if(clearCartModal) clearCartModal.addEventListener("click", e => { if(e.target === clearCartModal) closeClearCartModal(); });

document.addEventListener("keydown", e => {
  if(e.key === "Escape"){
    if(clearCartModal?.classList.contains("active")) closeClearCartModal();
    if(loginModal?.classList.contains("active")) closeLoginModal();
    if(invoicesModal?.classList.contains("active")) closeInvoicesModal();
    if(invoiceDetailModal?.classList.contains("active")) closeInvoiceDetailModal();
  }
});

/* ========================
   INIT
   ======================== */

loadSession();
loadCustomersCache();
populateBranchDropdown();
renderCart();
