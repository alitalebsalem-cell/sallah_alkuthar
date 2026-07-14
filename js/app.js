import { db } from "./firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const NEW_CATEGORIES = ["قسم المعمل","قسم السوبرماركت","قسم محلات الجملة","قسم المستودع","طلبات المعمل"];
const CATEGORY_ICONS = {"قسم المعمل":"🔬","قسم السوبرماركت":"🛒","قسم محلات الجملة":"🏪","قسم المستودع":"🏭","طلبات المعمل":"📋"};

let allProducts = [];
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let currentCategory = "all";
let productQuantities = {};

const productsDiv = document.getElementById("products");
const searchInput = document.getElementById("search");
const cartCount = document.getElementById("cartCount");
const cartIconLink = document.getElementById("cartIconLink");

const SESSION_KEY = "sallah_customer_session";
const CUSTOMERS_LOCAL_KEY = "sallah_customers_data";

let currentCustomer = null;
let currentCustomerPin = "";
let customersCache = [];

function escapeHTML(value){
  return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function getItemQty(item){
  const qty = parseInt(item.qty,10);
  return isNaN(qty) || qty < 1 ? 1 : qty;
}

function getProductImage(product){
  if(product.image && typeof product.image === "string" && product.image.trim() !== "") return product.image;
  return "images/noimg.jpg";
}

function getCartTotalQty(){
  return cart.reduce((sum,item)=>sum + getItemQty(item),0);
}

function findProduct(id){
  return allProducts.find(product=>String(product.id) === String(id));
}

function updateCartCount(){
  if(cartCount) cartCount.textContent = getCartTotalQty();
  localStorage.setItem("cart",JSON.stringify(cart));
}

function addToCart(id,quantity){
  const product = findProduct(id);
  if(!product) return;
  const addQty = parseInt(quantity,10);
  const finalQty = isNaN(addQty) || addQty < 1 ? 1 : addQty;
  const existing = cart.find(item=>String(item.id) === String(id));
  if(existing){
    existing.qty = getItemQty(existing) + finalQty;
  }else{
    cart.push({
      id: product.id,
      name: product.name || "",
      description: product.description || "",
      code: product.code || "",
      category: product.category || "",
      image: product.image || "images/noimg.jpg",
      qty: finalQty
    });
  }
  updateCartCount();
  if(cartIconLink){cartIconLink.classList.add("bounce");setTimeout(()=>cartIconLink.classList.remove("bounce"),400);}
}

function showFeedback(btn){
  if(!btn) return;
  const originalHTML = btn.innerHTML;
  btn.classList.add("is-added");
  btn.innerHTML = '<span class="cart-btn-icon">✓</span><span>تمت الإضافة</span>';
  setTimeout(()=>{btn.classList.remove("is-added");btn.innerHTML=originalHTML;},1200);
}

/* LOAD PRODUCTS */
productsDiv.innerHTML = '<div style="text-align:center;padding:40px;color:var(--secondary);">جاري تحميل المنتجات...</div>';
async function loadProducts(){
  const querySnapshot = await getDocs(collection(db,"products"));
  allProducts = [];
  querySnapshot.forEach(doc=>{
    allProducts.push({id:doc.id,...doc.data()});
  });
  renderProducts(getFilteredProducts());
}

function getFilteredProducts(){
  if(currentCategory === "all") return allProducts;
  return allProducts.filter(p => (p.category || "") === currentCategory);
}

/* RENDER PRODUCTS */
function renderProducts(products){
  if(!productsDiv) return;
  productsDiv.innerHTML = "";
  if(products.length === 0){
    productsDiv.innerHTML = '<div style="text-align:center;padding:40px;color:var(--secondary);grid-column:1/-1;">لا توجد منتجات في هذا القسم</div>';
    return;
  }
  products.forEach(product=>{
    const pid = product.id;
    if(!productQuantities[pid]) productQuantities[pid] = 1;
    const qty = productQuantities[pid];
    productsDiv.insertAdjacentHTML("beforeend",`
      <div class="product" style="animation-delay:${Math.random()*.2}s">
        <div class="product-img-wrap">
          <img src="${escapeHTML(getProductImage(product))}" alt="${escapeHTML(product.name || "")}" loading="lazy" decoding="async" onerror="this.src='images/noimg.jpg'">
        </div>
        <div class="product-info">
          <h3>${escapeHTML(product.name || "")}</h3>
          <p class="product-desc">${escapeHTML(product.description || "")}</p>
          <p class="product-sku">SKU: ${escapeHTML(product.code || "")}</p>
        </div>
        <div class="product-qty-row">
          <button type="button" data-action="dec" data-id="${escapeHTML(pid)}">−</button>
          <span class="qty-val" id="qty-${escapeHTML(pid)}">${qty}</span>
          <button type="button" data-action="inc" data-id="${escapeHTML(pid)}">+</button>
        </div>
        <button class="product-cart-btn" data-id="${escapeHTML(pid)}" type="button">
          <span class="cart-btn-icon">🛒</span>
          <span>إضافة إلى السلة</span>
        </button>
      </div>
    `);
  });
}

/* PRODUCT ACTIONS DELEGATION */
if(productsDiv){
  productsDiv.addEventListener("click",event=>{
    const incBtn = event.target.closest('[data-action="inc"]');
    const decBtn = event.target.closest('[data-action="dec"]');
    const cartBtn = event.target.closest(".product-cart-btn");

    if(incBtn){
      const id = incBtn.dataset.id;
      productQuantities[id] = (productQuantities[id] || 1) + 1;
      const el = document.getElementById("qty-"+id);
      if(el) el.textContent = productQuantities[id];
      return;
    }
    if(decBtn){
      const id = decBtn.dataset.id;
      productQuantities[id] = Math.max(1,(productQuantities[id] || 1) - 1);
      const el = document.getElementById("qty-"+id);
      if(el) el.textContent = productQuantities[id];
      return;
    }
    if(cartBtn){
      const id = cartBtn.dataset.id;
      const qty = productQuantities[id] || 1;
      addToCart(id,qty);
      showFeedback(cartBtn);
      return;
    }
  });
}

/* SEARCH */
if(searchInput){
  searchInput.addEventListener("input",()=>{
    const value = searchInput.value.trim().toLowerCase();
    const filtered = getFilteredProducts().filter(product=>{
      const productText = `${product.name || ""} ${product.description || ""} ${product.code || ""} ${product.category || ""}`.toLowerCase();
      return productText.includes(value);
    });
    renderProducts(filtered);
  });
}

/* CATEGORY FILTER */
document.querySelectorAll(".cat-card").forEach(card=>{
  card.addEventListener("click",()=>{
    document.querySelectorAll(".cat-card").forEach(c=>c.classList.remove("active"));
    card.classList.add("active");
    currentCategory = card.dataset.cat;
    const value = searchInput ? searchInput.value.trim().toLowerCase() : "";
    let filtered = getFilteredProducts();
    if(value){
      filtered = filtered.filter(p=>{
        const t = `${p.name || ""} ${p.description || ""} ${p.code || ""}`.toLowerCase();
        return t.includes(value);
      });
    }
    renderProducts(filtered);
  });
});

/* AUTH / SESSION */
function loadSession(){
  const stored = localStorage.getItem(SESSION_KEY);
  if(stored){
    try{
      const data = JSON.parse(stored);
      currentCustomer = {id:data.id,name:data.name,accountType:data.accountType||"",permissions:data.permissions||{}};
      currentCustomerPin = data.pin || "";
      updateAuthUI();
    }catch(e){currentCustomer=null;}
  }
}

function saveSession(customer,pin){
  currentCustomer = customer;
  currentCustomerPin = pin || "";
  const sessionData = {id:customer.id,name:customer.name,pin:currentCustomerPin,accountType:customer.accountType||"",permissions:customer.permissions||{}};
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
  const loginBtn = document.getElementById("loginBtn");
  const userProfile = document.getElementById("userProfile");
  const loggedInUser = document.getElementById("loggedInUser");
  const profileName = document.getElementById("profileName");
  const profileType = document.getElementById("profileType");
  const profileAvatar = document.getElementById("profileAvatar");
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

/* LOCAL CUSTOMERS */
function getLocalCustomers(){
  try{return JSON.parse(localStorage.getItem(CUSTOMERS_LOCAL_KEY)) || [];}catch(e){return [];}
}
function saveLocalCustomers(arr){localStorage.setItem(CUSTOMERS_LOCAL_KEY,JSON.stringify(arr));}

async function loadCustomersCache(){
  customersCache = getLocalCustomers();
  try{
    const snapshot = await getDocs(collection(db, "customers"));
    const firestoreCustomers = snapshot.docs.map(d=>({id:d.id,...d.data()}));
    const localIds = new Set(customersCache.map(c=>c.id));
    const localNames = new Set(customersCache.map(c=>String(c.name||"").trim().toLowerCase()));
    let changed = false;
    firestoreCustomers.forEach(fc=>{
      if(!localIds.has(fc.id) && !localNames.has(String(fc.name||"").trim().toLowerCase())){
        customersCache.push(fc);localIds.add(fc.id);localNames.add(String(fc.name||"").trim().toLowerCase());changed=true;
      }
    });
    if(changed) saveLocalCustomers(customersCache);
  }catch(e){}
}

function populateCustomerDropdown(accountType){
  const loginNameInput = document.getElementById("loginName");
  if(!loginNameInput) return;
  loginNameInput.innerHTML = '<option value="">-- اختر الاسم --</option>';
  let filtered = customersCache;
  if(accountType){
    filtered = customersCache.filter(c => (c.accountType || "") === accountType);
  }
  const sorted = [...filtered].sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"ar"));
  sorted.forEach(c=>{
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = c.name;
    loginNameInput.appendChild(opt);
  });
}

/* LOGIN MODAL */
function openLoginModal(){
  const loginModal = document.getElementById("loginModal");
  if(!loginModal) return;
  if(!customersCache.length) loadCustomersCache();
  loginModal.hidden = false;
  loginModal.setAttribute("aria-hidden","false");
  requestAnimationFrame(()=>loginModal.classList.add("active"));
  const loginAccountType = document.getElementById("loginAccountType");
  const loginNameInput = document.getElementById("loginName");
  const loginPinInput = document.getElementById("loginPin");
  const loginSubmit = document.getElementById("loginSubmit");
  if(loginAccountType) loginAccountType.value = "";
  if(loginNameInput){loginNameInput.style.display="none";loginNameInput.value="";}
  if(loginPinInput){loginPinInput.style.display="none";loginPinInput.value="";}
  if(loginSubmit) loginSubmit.style.display = "none";
}
function closeLoginModal(){
  const loginModal = document.getElementById("loginModal");
  if(!loginModal) return;
  loginModal.classList.remove("active");
  loginModal.setAttribute("aria-hidden","true");
  setTimeout(()=>{loginModal.hidden=true;},200);
}

/* LOGIN EVENTS */
document.getElementById("loginBtn")?.addEventListener("click",openLoginModal);
document.getElementById("loginModalClose")?.addEventListener("click",closeLoginModal);
document.getElementById("loginModal")?.addEventListener("click",e=>{if(e.target.id==="loginModal")closeLoginModal();});

document.getElementById("loginAccountType")?.addEventListener("change",function(){
  const val = this.value;
  const loginNameInput = document.getElementById("loginName");
  const loginPinInput = document.getElementById("loginPin");
  const loginSubmit = document.getElementById("loginSubmit");
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

document.getElementById("loginName")?.addEventListener("change",function(){
  const loginPinInput = document.getElementById("loginPin");
  const loginSubmit = document.getElementById("loginSubmit");
  if(this.value){
    if(loginPinInput) loginPinInput.style.display = "block";
    if(loginSubmit) loginSubmit.style.display = "block";
  }else{
    if(loginPinInput) loginPinInput.style.display = "none";
    if(loginSubmit) loginSubmit.style.display = "none";
  }
});

document.getElementById("loginPin")?.addEventListener("keydown",e=>{if(e.key==="Enter")document.getElementById("loginSubmit")?.click();});

document.getElementById("loginSubmit")?.addEventListener("click",async()=>{
  const loginError = document.getElementById("loginError");
  const loginSubmitBtn = document.getElementById("loginSubmit");
  const loginNameInput = document.getElementById("loginName");
  const loginPinInput = document.getElementById("loginPin");
  const loginAccountType = document.getElementById("loginAccountType");
  if(loginError) loginError.textContent = "";
  const name = loginNameInput ? loginNameInput.value.trim() : "";
  const pin = loginPinInput ? loginPinInput.value.trim() : "";
  const accountType = loginAccountType ? loginAccountType.value : "";
  if(!name){if(loginError)loginError.textContent="اختر الاسم";return;}
  if(!pin || pin.length!==4){if(loginError)loginError.textContent="كلمة المرور 4 أرقام";return;}
  if(!accountType){if(loginError)loginError.textContent="اختر نوع الحساب";return;}

  loginSubmitBtn.disabled = true;
  loginSubmitBtn.textContent = "جاري التحقق...";

  const trimmedName = name.trim().toLowerCase();
  const match = customersCache.find(c => String(c.name||"").trim().toLowerCase() === trimmedName);
  if(!match){
    if(loginError) loginError.textContent = "الحساب غير موجود";
    loginSubmitBtn.disabled = false;
    loginSubmitBtn.textContent = "دخول";
    return;
  }
  if(String(match.pin) === pin){
    saveSession({id:match.id,name:match.name,accountType:match.accountType||accountType,permissions:match.permissions||{}},pin);
    closeLoginModal();
  }else{
    if(loginError) loginError.textContent = "كلمة المرور خاطئة";
  }
  loginSubmitBtn.disabled = false;
  loginSubmitBtn.textContent = "دخول";
});

/* PROFILE DROPDOWN */
const profileToggle = document.getElementById("profileToggle");
const profileDropdown = document.getElementById("profileDropdown");
const profileLogoutBtn = document.getElementById("profileLogoutBtn");
const profileTogglePin = document.getElementById("profileTogglePin");
const profileChangePinBtn = document.getElementById("profileChangePinBtn");
const profileInvoicesBtn = document.getElementById("profileInvoicesBtn");

profileToggle?.addEventListener("click",e=>{e.stopPropagation();profileDropdown?.classList.toggle("show");});
document.addEventListener("click",e=>{if(profileDropdown&&profileDropdown.classList.contains("show")&&!profileDropdown.contains(e.target)&&e.target!==profileToggle)profileDropdown.classList.remove("show");});

profileLogoutBtn?.addEventListener("click",()=>{
  profileDropdown?.classList.remove("show");
  if(confirm("هل تريد تسجيل الخروج؟")) clearSession();
});

profileTogglePin?.addEventListener("click",()=>{
  const profilePin = document.getElementById("profilePin");
  if(!profilePin) return;
  if(profilePin.textContent === "****"){profilePin.textContent = currentCustomerPin || "N/A";profileTogglePin.textContent = "إخفاء";}
  else{profilePin.textContent = "****";profileTogglePin.textContent = "إظهار";}
});

profileChangePinBtn?.addEventListener("click",async()=>{
  profileDropdown?.classList.remove("show");
  const newPin = prompt("أدخل كلمة المرور الجديدة (4 أرقام):");
  if(!newPin || !/^\d{4}$/.test(newPin)){alert("يجب أن تكون 4 أرقام");return;}
  currentCustomerPin = newPin;
  const stored = JSON.parse(localStorage.getItem(SESSION_KEY)|| "{}");
  stored.pin = newPin;
  localStorage.setItem(SESSION_KEY,JSON.stringify(stored));
  try{
    const {doc:updateDocRef,updateDoc} = await import("https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js");
    const {db:dbRef} = await import("./firebase.js");
    await updateDoc(doc(dbRef,"customers",currentCustomer.id),{pin:newPin});
  }catch(e){}
  alert("تم تغيير كلمة المرور");
});

profileInvoicesBtn?.addEventListener("click",()=>{
  profileDropdown?.classList.remove("show");
  openInvoicesModal();
});

/* INVOICES MODAL */
function openInvoicesModal(){
  const invoicesModal = document.getElementById("invoicesModal");
  const invoicesList = document.getElementById("invoicesList");
  const invoicesSubtitle = document.getElementById("invoicesSubtitle");
  if(!invoicesModal) return;
  invoicesModal.hidden = false;
  invoicesModal.setAttribute("aria-hidden","false");
  if(invoicesList) invoicesList.innerHTML = '<div class="loading-text">جاري تحميل الفواتير...</div>';
  if(invoicesSubtitle) invoicesSubtitle.textContent = `العميل: ${currentCustomer?.name || ""}`;
  requestAnimationFrame(()=>invoicesModal.classList.add("active"));
  loadCustomerInvoices();
}
function closeInvoicesModal(){
  const m = document.getElementById("invoicesModal");
  if(!m) return;
  m.classList.remove("active");
  m.setAttribute("aria-hidden","true");
  setTimeout(()=>{m.hidden=true;},200);
}
function openInvoiceDetailModal(inv){
  const m = document.getElementById("invoiceDetailModal");
  const c = document.getElementById("invoiceDetailContent");
  if(!m||!c) return;
  let html = `<h2 style="color:var(--dark);margin-bottom:12px;">فاتورة ${escapeHTML(inv.branchName||inv.invoiceNo||"")}</h2>`;
  html += `<p style="color:var(--secondary);font-size:13px;margin-bottom:12px;">العميل: ${escapeHTML(inv.customerName||"")} | التاريخ: ${inv.date||""}</p>`;
  if(inv.items && inv.items.length){
    html += '<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:var(--dark);color:#fff;"><th style="padding:8px;border:1px solid var(--dark);">#</th><th style="padding:8px;border:1px solid var(--dark);">المنتج</th><th style="padding:8px;border:1px solid var(--dark);">الكمية</th></tr></thead><tbody>';
    inv.items.forEach((item,idx)=>{
      html += `<tr><td style="padding:6px;border:1px solid rgba(199,178,153,.2);text-align:center;">${idx+1}</td><td style="padding:6px;border:1px solid rgba(199,178,153,.2);">${escapeHTML(item.name||"")}</td><td style="padding:6px;border:1px solid rgba(199,178,153,.2);text-align:center;">${getItemQty(item)}</td></tr>`;
    });
    html += '</tbody></table>';
  }
  html += `<div style="text-align:center;margin-top:14px;"><button onclick="document.getElementById('invoiceDetailModal').classList.remove('active');document.getElementById('invoiceDetailModal').setAttribute('aria-hidden','true');setTimeout(()=>{document.getElementById('invoiceDetailModal').hidden=true;},200);" style="padding:10px 24px;border:none;border-radius:10px;background:rgba(122,102,85,.1);color:var(--dark);font-weight:700;cursor:pointer;">إغلاق</button></div>`;
  c.innerHTML = html;
  m.hidden = false;
  m.setAttribute("aria-hidden","false");
  requestAnimationFrame(()=>m.classList.add("active"));
}

async function loadCustomerInvoices(){
  if(!currentCustomer) return;
  const {collection:col,query:q,where,orderBy,getDocs:gd} = await import("https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js");
  const {db:d} = await import("./firebase.js");
  const invoicesList = document.getElementById("invoicesList");
  try{
    let snapshot;
    try{
      const qq = q(col(d,"invoices"),where("customerId","==",currentCustomer.id),orderBy("createdAt","desc"));
      snapshot = await gd(qq);
    }catch(e){
      const qq = q(col(d,"invoices"),where("customerId","==",currentCustomer.id));
      snapshot = await gd(qq);
    }
    if(snapshot.empty){if(invoicesList)invoicesList.innerHTML='<div class="empty-text">لا توجد فواتير</div>';return;}
    invoicesList.innerHTML = "";
    snapshot.forEach(doc=>{
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
          <span>المنتجات: ${inv.totalItems||0}</span>
          <span>الكمية: ${inv.totalQty||0}</span>
        </div>
      `;
      div.addEventListener("click",()=>openInvoiceDetailModal(inv));
      invoicesList.appendChild(div);
    });
  }catch(e){
    if(invoicesList) invoicesList.innerHTML = '<div class="error-text">حدث خطأ</div>';
  }
}

document.getElementById("invoicesModalClose")?.addEventListener("click",closeInvoicesModal);
document.getElementById("invoicesCloseBtn")?.addEventListener("click",closeInvoicesModal);
document.getElementById("invoicesModal")?.addEventListener("click",e=>{if(e.target.id==="invoicesModal")closeInvoicesModal();});
document.getElementById("invoiceDetailClose")?.addEventListener("click",()=>{
  const m = document.getElementById("invoiceDetailModal");
  if(m){m.classList.remove("active");m.setAttribute("aria-hidden","true");setTimeout(()=>{m.hidden=true;},200);}
});
document.getElementById("invoiceDetailModal")?.addEventListener("click",e=>{
  if(e.target.id==="invoiceDetailModal"){
    const m = document.getElementById("invoiceDetailModal");
    m.classList.remove("active");m.setAttribute("aria-hidden","true");setTimeout(()=>{m.hidden=true;},200);
  }
});

document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
    closeLoginModal();
    closeInvoicesModal();
    const m=document.getElementById("invoiceDetailModal");
    if(m&&m.classList.contains("active")){m.classList.remove("active");m.setAttribute("aria-hidden","true");setTimeout(()=>{m.hidden=true;},200);}
  }
});

/* INIT */
updateCartCount();
loadProducts();
loadSession();
loadCustomersCache();
