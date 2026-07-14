import { db } from "./firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getLang, setLang, t, catLabel, applyFullLang } from "./i18n.js";

const SESSION_KEY = "sallah_customer_session";
const CUSTOMERS_LOCAL_KEY = "sallah_customers_data";

const CATEGORY_PERMISSIONS = {
  "حساب معمل": ["احتياجات المعمل"],
  "حساب فرع": ["قسم المعمل","قسم السوبرماركت","قسم محلات الجملة","قسم المستودع"]
};

let allProducts = [];
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let currentCustomer = null;
let currentCustomerPin = "";
let customersCache = [];
let productQuantities = {};
let currentCategory = null;

const productsDiv = document.getElementById("products");
const searchInput = document.getElementById("search");
const cartCount = document.getElementById("cartCount");
const cartIconLink = document.getElementById("cartIconLink");
const categoriesBar = document.getElementById("categoriesBar");
const productsMain = document.getElementById("productsMain");
const loginRequiredOverlay = document.getElementById("loginRequiredOverlay");
const loginRequiredBtn = document.getElementById("loginRequiredBtn");

function escapeHTML(value){
  return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
function getItemQty(item){ const qty = parseInt(item.qty,10); return isNaN(qty) || qty < 1 ? 1 : qty; }
function getProductImage(p){ if(p.image && typeof p.image === "string" && p.image.trim() !== "") return p.image; return "images/noimg.jpg"; }
function getCartTotalQty(){ return cart.reduce((sum,item) => sum + getItemQty(item), 0); }

/* ========================
   LANGUAGE TOGGLE
   ======================== */
function applyLang(){
  applyFullLang({
    langToggle: "langToggle",
    search: "search",
    loginBtn: "loginBtn",
    loginRequiredOverlay: "loginRequiredOverlay",
    loginModal: "loginModal",
    profile: true,
  });
}
document.getElementById("langToggle")?.addEventListener("click", () => {
  setLang(getLang() === "ar" ? "en" : "ar");
  applyLang();
});

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
      showStore();
    }catch(e){ currentCustomer = null; }
  }
}
function saveSession(customer, pin){
  currentCustomer = customer;
  currentCustomerPin = pin || "";
  const sessionData = { id:customer.id, name:customer.name, pin:currentCustomerPin, accountType:customer.accountType||"", permissions:customer.permissions||{} };
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  updateAuthUI();
  showStore();
}
function clearSession(){
  currentCustomer = null;
  currentCustomerPin = "";
  localStorage.removeItem(SESSION_KEY);
  updateAuthUI();
  hideStore();
}
function updateAuthUI(){
  const loginBtnEl = document.getElementById("loginBtn");
  const userProfileEl = document.getElementById("userProfile");
  if(currentCustomer){
    if(loginBtnEl) loginBtnEl.style.display = "none";
    if(userProfileEl) userProfileEl.style.display = "inline-flex";
    document.getElementById("loggedInUser").textContent = currentCustomer.name;
    document.getElementById("profileName").textContent = currentCustomer.name;
    document.getElementById("profileType").textContent = currentCustomer.accountType || (getLang()==="en"?"Not set":"غير محدد");
    document.getElementById("profileAvatar").textContent = (currentCustomer.name || "?")[0];
  }else{
    if(loginBtnEl) loginBtnEl.style.display = "inline-flex";
    if(userProfileEl) userProfileEl.style.display = "none";
  }
}

/* ========================
   SHOW/HIDE STORE
   ======================== */
function showStore(){
  if(loginRequiredOverlay) loginRequiredOverlay.classList.add("hidden");
  if(categoriesBar) categoriesBar.style.display = "";
  if(productsMain) productsMain.style.display = "";
  if(searchInput) searchInput.disabled = false;
  applyPermissions();
  const allowed = getAllowedCategories();
  if(!currentCategory || !allowed.includes(currentCategory)){
    currentCategory = allowed.length ? allowed[0] : null;
  }
  setActiveCategory();
  renderProducts(getFilteredProducts());
}
function hideStore(){
  if(loginRequiredOverlay) loginRequiredOverlay.classList.remove("hidden");
  if(categoriesBar) categoriesBar.style.display = "none";
  if(productsMain) productsMain.style.display = "none";
  if(searchInput) searchInput.disabled = true;
}

/* ========================
   PERMISSIONS
   ======================== */
function getAllowedCategories(){
  if(!currentCustomer) return [];
  const accType = currentCustomer.accountType || "";
  return CATEGORY_PERMISSIONS[accType] || ["قسم المعمل","قسم السوبرماركت","قسم محلات الجملة","قسم المستودع","احتياجات المعمل"];
}
function applyPermissions(){
  const allowed = getAllowedCategories();
  document.querySelectorAll(".cat-card").forEach(card => {
    const cat = card.dataset.cat;
    if(allowed.includes(cat)){
      card.style.display = "";
      card.style.opacity = "1";
      card.style.pointerEvents = "auto";
    }else{
      card.style.display = "none";
      card.style.opacity = "0.3";
      card.style.pointerEvents = "none";
    }
  });
}
function setActiveCategory(){
  document.querySelectorAll(".cat-card").forEach(c => {
    c.classList.toggle("active", c.dataset.cat === currentCategory);
  });
}

/* ========================
   PRODUCTS
   ======================== */
productsDiv.innerHTML = `<div style="text-align:center;padding:40px;color:var(--secondary);">${t("loading")}</div>`;

async function loadProducts(){
  const querySnapshot = await getDocs(collection(db,"products"));
  allProducts = [];
  querySnapshot.forEach(doc => allProducts.push({id:doc.id,...doc.data()}));
  if(currentCustomer) renderProducts(getFilteredProducts());
}

function getFilteredProducts(){
  if(!currentCategory) return allProducts;
  return allProducts.filter(p => (p.category || "") === currentCategory);
}

function renderProducts(products){
  if(!productsDiv) return;
  productsDiv.innerHTML = "";
  if(products.length === 0){
    productsDiv.innerHTML = `<div style="text-align:center;padding:40px;color:var(--secondary);grid-column:1/-1;">${t("noProducts")}</div>`;
    return;
  }
  products.forEach(product => {
    const pid = product.id;
    if(!productQuantities[pid]) productQuantities[pid] = 1;
    const qty = productQuantities[pid];
    productsDiv.insertAdjacentHTML("beforeend",`
      <div class="product" style="animation-delay:${Math.random()*.2}s">
        <div class="product-img-wrap">
          <img src="${escapeHTML(getProductImage(product))}" alt="${escapeHTML(product.name||"")}" loading="lazy" decoding="async" onerror="this.src='images/noimg.jpg'">
        </div>
        <div class="product-info">
          <h3>${escapeHTML(product.name||"")}</h3>
          <p class="product-desc">${escapeHTML(product.description||"")}</p>
          <p class="product-sku">SKU: ${escapeHTML(product.code||"")}</p>
        </div>
        <div class="product-qty-row">
          <button type="button" data-action="dec" data-id="${escapeHTML(pid)}">−</button>
          <span class="qty-val" id="qty-${escapeHTML(pid)}">${qty}</span>
          <button type="button" data-action="inc" data-id="${escapeHTML(pid)}">+</button>
        </div>
        <button class="product-cart-btn" data-id="${escapeHTML(pid)}" type="button">
          <span class="cart-btn-icon">🛒</span>
          <span data-i18n="addToCart">${t("addToCart")}</span>
        </button>
      </div>
    `);
  });
}

if(productsDiv){
  productsDiv.addEventListener("click", event => {
    const incBtn = event.target.closest('[data-action="inc"]');
    const decBtn = event.target.closest('[data-action="dec"]');
    const cartBtn = event.target.closest(".product-cart-btn");
    if(incBtn){
      const id = incBtn.dataset.id;
      productQuantities[id] = (productQuantities[id]||1)+1;
      const el = document.getElementById("qty-"+id);
      if(el) el.textContent = productQuantities[id];
      return;
    }
    if(decBtn){
      const id = decBtn.dataset.id;
      productQuantities[id] = Math.max(1,(productQuantities[id]||1)-1);
      const el = document.getElementById("qty-"+id);
      if(el) el.textContent = productQuantities[id];
      return;
    }
    if(cartBtn){
      const id = cartBtn.dataset.id;
      const qty = productQuantities[id] || 1;
      addToCart(id, qty);
      cartBtn.classList.add("is-added");
      cartBtn.querySelector("span:last-child").textContent = t("addedToCart");
      setTimeout(() => { cartBtn.classList.remove("is-added"); cartBtn.querySelector("span:last-child").textContent = t("addToCart"); }, 1200);
      return;
    }
  });
}

/* ========================
   CART
   ======================== */
function addToCart(id, quantity){
  const product = allProducts.find(p => String(p.id) === String(id));
  if(!product) return;
  const addQty = parseInt(quantity,10);
  const finalQty = isNaN(addQty) || addQty < 1 ? 1 : addQty;
  const existing = cart.find(item => String(item.id) === String(id));
  if(existing){ existing.qty = getItemQty(existing) + finalQty; }
  else{ cart.push({ id:product.id, name:product.name||"", description:product.description||"", code:product.code||"", category:product.category||"", image:product.image||"images/noimg.jpg", qty:finalQty }); }
  updateCartCount();
  if(cartIconLink){ cartIconLink.classList.add("bounce"); setTimeout(()=>cartIconLink.classList.remove("bounce"),400); }
}
function updateCartCount(){
  if(cartCount) cartCount.textContent = getCartTotalQty();
  localStorage.setItem("cart",JSON.stringify(cart));
}

/* ========================
   CATEGORY FILTER
   ======================== */
document.querySelectorAll(".cat-card").forEach(card => {
  card.addEventListener("click", () => {
    currentCategory = card.dataset.cat;
    setActiveCategory();
    const value = searchInput ? searchInput.value.trim().toLowerCase() : "";
    let filtered = getFilteredProducts();
    if(value){
      filtered = filtered.filter(p => {
        const t = `${p.name||""} ${p.description||""} ${p.code||""}`.toLowerCase();
        return t.includes(value);
      });
    }
    renderProducts(filtered);
  });
});

/* ========================
   SEARCH
   ======================== */
if(searchInput){
  searchInput.addEventListener("input", () => {
    const value = searchInput.value.trim().toLowerCase();
    const filtered = getFilteredProducts().filter(p => {
      const productText = `${p.name||""} ${p.description||""} ${p.code||""} ${p.category||""}`.toLowerCase();
      return productText.includes(value);
    });
    renderProducts(filtered);
  });
}

/* ========================
   LOGIN MODAL (FIXED: fetches from Firestore)
   ======================== */
const loginModal = document.getElementById("loginModal");
const loginModalClose = document.getElementById("loginModalClose");
const loginAccountType = document.getElementById("loginAccountType");
const loginNameInput = document.getElementById("loginName");
const loginPinInput = document.getElementById("loginPin");
const loginSubmitBtn = document.getElementById("loginSubmit");
const loginError = document.getElementById("loginError");

function openLoginModal(){
  if(!loginModal) return;
  loginModal.hidden = false;
  loginModal.setAttribute("aria-hidden","false");
  if(loginAccountType) loginAccountType.value = "";
  if(loginNameInput){ loginNameInput.style.display = "none"; loginNameInput.value = ""; }
  if(loginPinInput){ loginPinInput.style.display = "none"; loginPinInput.value = ""; }
  if(loginSubmitBtn) loginSubmitBtn.style.display = "none";
  if(loginError) loginError.textContent = "";
  requestAnimationFrame(() => loginModal.classList.add("active"));
  loadCustomersFromFirestore();
}

function closeLoginModal(){
  if(!loginModal) return;
  loginModal.classList.remove("active");
  loginModal.setAttribute("aria-hidden","true");
  setTimeout(() => { loginModal.hidden = true; }, 200);
}

async function loadCustomersFromFirestore(){
  customersCache = getLocalCustomers();
  try{
    const snapshot = await getDocs(collection(db, "customers"));
    const firestoreCustomers = snapshot.docs.map(d => ({ id:d.id, ...d.data() }));
    const localIds = new Set(customersCache.map(c => c.id));
    const localNames = new Set(customersCache.map(c => String(c.name||"").trim().toLowerCase()));
    let changed = false;
    firestoreCustomers.forEach(fc => {
      const fcName = String(fc.name||"").trim().toLowerCase();
      const existingById = customersCache.find(c => c.id === fc.id);
      const existingByName = customersCache.find(c => String(c.name||"").trim().toLowerCase() === fcName);
      if(existingById){
        Object.assign(existingById, fc);
      }else if(existingByName){
        Object.assign(existingByName, fc);
      }else{
        customersCache.push(fc);
        changed = true;
      }
    });
    customersCache.forEach(c => {
      if(!c.accountType || c.accountType.trim() === ""){
        c.accountType = "حساب معمل";
        if(c.id && !String(c.id).startsWith("local_")){
          import("https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js").then(({doc,updateDoc}) => {
            import("./firebase.js").then(({db:d}) => {
              updateDoc(doc(d,"customers",c.id),{accountType:"حساب معمل"}).catch(()=>{});
            });
          });
        }
      }
    });
    saveLocalCustomers(customersCache);
  }catch(e){
    console.warn("Firestore sync failed:", e);
  }
}

function getLocalCustomers(){ try{ return JSON.parse(localStorage.getItem(CUSTOMERS_LOCAL_KEY)) || []; }catch(e){ return []; } }
function saveLocalCustomers(arr){ localStorage.setItem(CUSTOMERS_LOCAL_KEY, JSON.stringify(arr)); }

function populateCustomerDropdown(accountType){
  if(!loginNameInput) return;
  loginNameInput.innerHTML = '<option value="">-- اختر الاسم --</option>';
  let filtered = customersCache;
  if(accountType){
    filtered = customersCache.filter(c => {
      const t = (c.accountType || "").trim();
      return t === accountType || t === "";
    });
  }
  const sorted = [...filtered].sort((a,b) => String(a.name||"").localeCompare(String(b.name||""), "ar"));
  sorted.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = c.name;
    loginNameInput.appendChild(opt);
  });
}

loginAccountType?.addEventListener("change", function(){
  const val = this.value;
  if(val){
    populateCustomerDropdown(val);
    if(loginNameInput) loginNameInput.style.display = "block";
    if(loginPinInput) loginPinInput.style.display = "none";
    if(loginSubmitBtn) loginSubmitBtn.style.display = "none";
  }else{
    if(loginNameInput) loginNameInput.style.display = "none";
    if(loginPinInput) loginPinInput.style.display = "none";
    if(loginSubmitBtn) loginSubmitBtn.style.display = "none";
  }
});

loginNameInput?.addEventListener("change", function(){
  if(this.value){
    if(loginPinInput) loginPinInput.style.display = "block";
    if(loginSubmitBtn) loginSubmitBtn.style.display = "block";
  }else{
    if(loginPinInput) loginPinInput.style.display = "none";
    if(loginSubmitBtn) loginSubmitBtn.style.display = "none";
  }
});

loginPinInput?.addEventListener("keydown", e => { if(e.key === "Enter") loginSubmitBtn?.click(); });

loginSubmitBtn?.addEventListener("click", () => {
  if(loginError) loginError.textContent = "";
  const name = loginNameInput ? loginNameInput.value.trim() : "";
  const pin = loginPinInput ? loginPinInput.value.trim() : "";
  const accountType = loginAccountType ? loginAccountType.value : "";
  if(!accountType){ loginError.textContent = t("selectAccountType"); return; }
  if(!name){ loginError.textContent = t("selectNameErr"); return; }
  if(!pin || pin.length !== 4){ loginError.textContent = t("pinFourDigits"); return; }
  const trimmedName = name.trim().toLowerCase();
  const match = customersCache.find(c => String(c.name||"").trim().toLowerCase() === trimmedName);
  if(!match){ loginError.textContent = t("accountNotFound"); return; }
  if(String(match.pin) === pin){
    saveSession({ id:match.id, name:match.name, accountType:match.accountType || accountType, permissions:match.permissions||{} }, pin);
    closeLoginModal();
  }else{
    loginError.textContent = t("wrongPassword");
  }
});

document.getElementById("loginBtn")?.addEventListener("click", openLoginModal);
loginRequiredBtn?.addEventListener("click", openLoginModal);
loginModalClose?.addEventListener("click", closeLoginModal);
loginModal?.addEventListener("click", e => { if(e.target === loginModal) closeLoginModal(); });

/* ========================
   PROFILE
   ======================== */
const profileToggle = document.getElementById("profileToggle");
const profileDropdown = document.getElementById("profileDropdown");

profileToggle?.addEventListener("click", e => { e.stopPropagation(); profileDropdown?.classList.toggle("show"); });
document.addEventListener("click", e => { if(profileDropdown?.classList.contains("show") && !profileDropdown.contains(e.target) && e.target !== profileToggle) profileDropdown.classList.remove("show"); });

document.getElementById("profileLogoutBtn")?.addEventListener("click", () => {
  profileDropdown?.classList.remove("show");
  if(confirm(t("logoutConfirm"))) clearSession();
});
document.getElementById("profileTogglePin")?.addEventListener("click", () => {
  const el = document.getElementById("profilePin");
  if(!el) return;
  if(el.textContent === "****"){ el.textContent = currentCustomerPin || "N/A"; document.getElementById("profileTogglePin").textContent = t("hide"); }
  else{ el.textContent = "****"; document.getElementById("profileTogglePin").textContent = t("show"); }
});
document.getElementById("profileChangePinBtn")?.addEventListener("click", async () => {
  profileDropdown?.classList.remove("show");
  const newPin = prompt(t("changePinPrompt"));
  if(!newPin || !/^\d{4}$/.test(newPin)){ alert(t("pinMustBeFour")); return; }
  currentCustomerPin = newPin;
  const stored = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
  stored.pin = newPin;
  localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
  try{ const {doc,updateDoc} = await import("https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js"); const {db:d} = await import("./firebase.js"); await updateDoc(doc(d,"customers",currentCustomer.id),{pin:newPin}); }catch(e){}
  alert(t("pinChanged"));
});
document.getElementById("profileInvoicesBtn")?.addEventListener("click", () => {
  profileDropdown?.classList.remove("show");
  openInvoicesModal();
});

/* ========================
   INVOICES MODAL
   ======================== */
function openInvoicesModal(){
  const m = document.getElementById("invoicesModal");
  if(!m) return;
  m.hidden = false;
  m.setAttribute("aria-hidden","false");
  document.getElementById("invoicesList").innerHTML = `<div class="loading-text">${t("loadingInvoices")}</div>`;
  document.getElementById("invoicesSubtitle").textContent = `${t("customer")}: ${currentCustomer?.name||""}`;
  requestAnimationFrame(() => m.classList.add("active"));
  loadCustomerInvoices();
}
function closeInvoicesModal(){
  const m = document.getElementById("invoicesModal");
  if(!m) return;
  m.classList.remove("active");
  m.setAttribute("aria-hidden","true");
  setTimeout(() => { m.hidden = true; }, 200);
}

async function loadCustomerInvoices(){
  if(!currentCustomer) return;
  const list = document.getElementById("invoicesList");
  try{
    const {collection:col,query:q,where,orderBy,getDocs:gd} = await import("https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js");
    const {db:d} = await import("./firebase.js");
    let snapshot;
    try{ snapshot = await gd(q(col(d,"invoices"),where("customerId","==",currentCustomer.id),orderBy("createdAt","desc"))); }
    catch(e){ snapshot = await gd(q(col(d,"invoices"),where("customerId","==",currentCustomer.id))); }
    if(snapshot.empty){ list.innerHTML = `<div class="empty-text">${t("noInvoices")}</div>`; return; }
    list.innerHTML = "";
    snapshot.forEach(doc => {
      const inv = doc.data();
      const div = document.createElement("div");
      div.className = "invoice-history-card";
      div.innerHTML = `
        <div class="invoice-history-top">
          <strong class="invoice-history-no">${escapeHTML(inv.branchName||inv.invoiceNo||"")}</strong>
          <span class="invoice-history-date">${inv.date||""}</span>
        </div>
        <div class="invoice-history-items">${escapeHTML((inv.items||[]).slice(0,3).map(i=>i.name).join("، "))}</div>
        <div class="invoice-history-footer">
          <span>${t("products")}: ${inv.totalItems||0}</span>
          <span>${t("qty")}: ${inv.totalQty||0}</span>
        </div>
      `;
      div.addEventListener("click", () => openInvoiceDetail(inv));
      list.appendChild(div);
    });
  }catch(e){ list.innerHTML = '<div class="error-text">حدث خطأ</div>'; }
}

function openInvoiceDetail(inv){
  const m = document.getElementById("invoiceDetailModal");
  const c = document.getElementById("invoiceDetailContent");
  if(!m||!c) return;
  const lang = getLang();
  let html = `<div style="text-align:center;margin-bottom:14px;"><img src="images/logo.png" style="width:80px;height:auto;margin:0 auto 6px;" onerror="this.style.display='none'"><h2 style="color:var(--dark);font-size:20px;">${t("invoiceDetails")}</h2></div>`;
  html += `<div class="invoice-detail-meta"><div><span>${t("invoiceNum")}</span><strong>${escapeHTML((inv.invoiceNo||"").replace("INV-",""))}</strong></div><div><span>${t("customer")}</span><strong>${escapeHTML(inv.customerName||"")}</strong></div><div><span>${t("date")}</span><strong>${escapeHTML(inv.date||"")}</strong></div></div>`;
  html += `<table class="invoice-detail-table"><thead><tr><th>#</th><th>${lang==="en"?"Item":"المنتج"}</th><th>KOD</th><th>${lang==="en"?"Qty":"الكمية"}</th></tr></thead><tbody>`;
  (inv.items||[]).forEach((item,i) => { html += `<tr><td>${i+1}</td><td>${escapeHTML(item.name||"")}</td><td>${escapeHTML(item.code||"")}</td><td>${getItemQty(item)}</td></tr>`; });
  html += '</tbody></table>';
  html += `<div class="invoice-detail-summary"><span>${t("products")}: ${inv.totalItems||0}</span><span>${t("qty")}: ${inv.totalQty||0}</span></div>`;
  html += `<div style="text-align:center;margin-top:14px;"><button onclick="document.getElementById('invoiceDetailModal').classList.remove('active');document.getElementById('invoiceDetailModal').hidden=true;" style="padding:10px 24px;border:none;border-radius:10px;background:rgba(122,102,85,.1);color:var(--dark);font-weight:700;cursor:pointer;">${t("close")}</button></div>`;
  c.innerHTML = html;
  m.hidden = false;
  m.setAttribute("aria-hidden","false");
  requestAnimationFrame(() => m.classList.add("active"));
}

document.getElementById("invoicesModalClose")?.addEventListener("click", closeInvoicesModal);
document.getElementById("invoicesCloseBtn")?.addEventListener("click", closeInvoicesModal);
document.getElementById("invoicesModal")?.addEventListener("click", e => { if(e.target.id === "invoicesModal") closeInvoicesModal(); });
document.getElementById("invoiceDetailClose")?.addEventListener("click", () => { const m=document.getElementById("invoiceDetailModal"); if(m){m.classList.remove("active");m.setAttribute("aria-hidden","true");setTimeout(()=>{m.hidden=true;},200);} });
document.getElementById("invoiceDetailModal")?.addEventListener("click", e => { if(e.target.id==="invoiceDetailModal"){const m=e.target;m.classList.remove("active");m.setAttribute("aria-hidden","true");setTimeout(()=>{m.hidden=true;},200);} });

document.addEventListener("keydown", e => {
  if(e.key === "Escape"){ closeLoginModal(); closeInvoicesModal(); const m=document.getElementById("invoiceDetailModal"); if(m?.classList.contains("active")){m.classList.remove("active");m.setAttribute("aria-hidden","true");setTimeout(()=>{m.hidden=true;},200);} }
});

/* ========================
   INIT
   ======================== */
applyLang();
updateCartCount();
loadProducts();
loadSession();
