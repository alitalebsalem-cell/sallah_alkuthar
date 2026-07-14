import { db } from "./firebase.js";
import { generateInvoicePdf } from "./invoice-pdf.js";
import {
  collection, addDoc, getDocs, updateDoc, doc,
  query, where, orderBy, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getLang, setLang, t, catLabel, applyFullLang } from "./i18n.js";

const SESSION_KEY = "sallah_customer_session";
const CUSTOMERS_LOCAL_KEY = "sallah_customers_data";
const INV_COUNTER_KEY = "sallah_invoice_counter";
const BRANCHES_KEY = "sallah_branches";
const DEFAULT_BRANCHES = ["فرع الحمدانية - Hamdanya","فرع الطائف - Altayf","فرع السامر - Al-Samer","فرع المعمل - Almamal"];
const COLUMNS_PER_INVOICE_ROW = 3;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const ARABIC_DAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const ARABIC_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

let cart = JSON.parse(localStorage.getItem("cart")) || [];
let currentCustomer = null;
let currentCustomerPin = "";
let customersCache = [];
let cartCategory = "all";

const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const cartSearch = document.getElementById("cartSearch");
const branchNameInput = document.getElementById("branchName");
const invoiceTemplate = document.getElementById("invoiceTemplate");
const createInvoiceButton = document.getElementById("createInvoice");
const clearCartButton = document.getElementById("clearCartBtn");
const clearCartModal = document.getElementById("clearCartConfirmModal");
const confirmClearInput = document.getElementById("confirmClearInput");
const cancelClearCartButton = document.getElementById("cancelClearCart");
const confirmClearCartButton = document.getElementById("confirmClearCart");
const loginBtn = document.getElementById("loginBtn");
const userProfile = document.getElementById("userProfile");
const loginModal = document.getElementById("loginModal");
const loginAccountType = document.getElementById("loginAccountType");
const loginNameInput = document.getElementById("loginName");
const loginPinInput = document.getElementById("loginPin");
const loginSubmitBtn = document.getElementById("loginSubmit");
const loginError = document.getElementById("loginError");
const invoicesModal = document.getElementById("invoicesModal");
const invoicesList = document.getElementById("invoicesList");
const invoiceDetailModal = document.getElementById("invoiceDetailModal");
const invoiceDetailContent = document.getElementById("invoiceDetailContent");
const cartMain = document.getElementById("cartMain");
const loginRequiredOverlay = document.getElementById("loginRequiredOverlay");
const cartCategoryFilter = document.getElementById("cartCategoryFilter");

function escapeHTML(v){ return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
function getItemQty(item){ const q=parseInt(item.qty,10); return isNaN(q)||q<1?1:q; }
function getProductImage(item){ if(item.image&&typeof item.image==="string"&&item.image.trim()!=="") return item.image; return "images/noimg.jpg"; }
function saveCart(){ localStorage.setItem("cart",JSON.stringify(cart)); }
function getCartTotalQty(){ return cart.reduce((s,i)=>s+getItemQty(i),0); }
function formatArabicDate(date){ const d=date instanceof Timestamp?date.toDate():(date?.toDate?date.toDate():new Date(date)); return `${ARABIC_DAYS[d.getDay()]} ${ARABIC_MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`; }
function getBranches(){ try{const d=localStorage.getItem(BRANCHES_KEY);if(d){const p=JSON.parse(d);if(Array.isArray(p)&&p.length)return p;}}catch(e){} return [...DEFAULT_BRANCHES]; }
function getLocalCustomers(){ try{return JSON.parse(localStorage.getItem(CUSTOMERS_LOCAL_KEY))||[];}catch(e){return [];} }
function saveLocalCustomers(a){ localStorage.setItem(CUSTOMERS_LOCAL_KEY,JSON.stringify(a)); }

/* LANG */
function applyLang(){
  applyFullLang({
    langToggle: "langToggle",
    search: "cartSearch",
    loginBtn: "loginBtn",
    loginRequiredOverlay: "loginRequiredOverlay",
    loginModal: "loginModal",
    profile: true,
  });
  // Swap category images
  const lang = getLang();
  document.querySelectorAll(".cat-card .cat-img").forEach(img => {
    const ar = img.getAttribute("data-img-ar");
    const en = img.getAttribute("data-img-en");
    if(ar && en) img.src = lang === "en" ? en : ar;
  });
}
document.getElementById("langToggle")?.addEventListener("click",()=>{
  setLang(getLang()==="ar"?"en":"ar");
  applyLang();
});

/* AUTH */
function loadSession(){
  const s=localStorage.getItem(SESSION_KEY);
  if(s){try{const d=JSON.parse(s);currentCustomer={id:d.id,name:d.name,accountType:d.accountType||"",permissions:d.permissions||{}};currentCustomerPin=d.pin||"";updateAuthUI();showCart();}catch(e){currentCustomer=null;}}
}
function saveSession(c,p){
  currentCustomer=c;currentCustomerPin=p||"";
  localStorage.setItem(SESSION_KEY,JSON.stringify({id:c.id,name:c.name,pin:currentCustomerPin,accountType:c.accountType||"",permissions:c.permissions||{}}));
  updateAuthUI();showCart();
}
function clearSession(){ currentCustomer=null;currentCustomerPin="";localStorage.removeItem(SESSION_KEY);updateAuthUI();hideCart(); }
function updateAuthUI(){
  if(currentCustomer){
    if(loginBtn)loginBtn.style.display="none";
    if(userProfile)userProfile.style.display="inline-flex";
    document.getElementById("loggedInUser").textContent=currentCustomer.name;
    document.getElementById("profileName").textContent=currentCustomer.name;
    document.getElementById("profileType").textContent=currentCustomer.accountType||"غير محدد";
    document.getElementById("profileAvatar").textContent=(currentCustomer.name||"?")[0];
  }else{
    if(loginBtn)loginBtn.style.display="inline-flex";
    if(userProfile)userProfile.style.display="none";
  }
}
function showCart(){
  if(loginRequiredOverlay)loginRequiredOverlay.classList.add("hidden");
  if(cartMain)cartMain.style.display="";
  if(cartCategoryFilter)cartCategoryFilter.style.display="";
  applyPermissions();renderCart();
}
function hideCart(){
  if(loginRequiredOverlay)loginRequiredOverlay.classList.remove("hidden");
  if(cartMain)cartMain.style.display="none";
  if(cartCategoryFilter)cartCategoryFilter.style.display="none";
}

/* PERMISSIONS */
const CATEGORY_PERMISSIONS={"حساب معمل":["احتياجات المعمل"],"حساب فرع":["قسم المعمل","قسم السوبرماركت","قسم محلات الجملة","قسم المستودع"]};
function getAllowedCategories(){
  if(!currentCustomer)return[];
  return CATEGORY_PERMISSIONS[currentCustomer.accountType||""]||["قسم المعمل","قسم السوبرماركت","قسم محلات الجملة","قسم المستودع","احتياجات المعمل"];
}
function applyPermissions(){
  const allowed=getAllowedCategories();
  document.querySelectorAll("#cartCategoryFilter .cat-card").forEach(c=>{
    const cat=c.dataset.cat;
    if(cat==="all"){c.style.display="";return;}
    c.style.display=allowed.includes(cat)?"":"none";
  });
}

/* LOGIN (FIXED: fetches from Firestore) */
async function loadCustomersFromFirestore(){
  customersCache=getLocalCustomers();
  try{
    const snap=await getDocs(collection(db,"customers"));
    const fc=snap.docs.map(d=>({id:d.id,...d.data()}));
    const ids=new Set(customersCache.map(c=>c.id));
    const names=new Set(customersCache.map(c=>String(c.name||"").trim().toLowerCase()));
    let changed=false;
    fc.forEach(f=>{
      const fn=String(f.name||"").trim().toLowerCase();
      const byId=customersCache.find(c=>c.id===f.id);
      const byName=customersCache.find(c=>String(c.name||"").trim().toLowerCase()===fn);
      if(byId){Object.assign(byId,f);}
      else if(byName){Object.assign(byName,f);}
      else{customersCache.push(f);changed=true;}
    });
    saveLocalCustomers(customersCache);
  }catch(e){console.warn("Firestore sync failed:",e);}
}
function openLoginModal(){
  if(!loginModal)return;
  loginModal.hidden=false;loginModal.setAttribute("aria-hidden","false");
  if(loginAccountType)loginAccountType.value="";
  if(loginNameInput){loginNameInput.style.display="none";loginNameInput.value="";}
  if(loginPinInput){loginPinInput.style.display="none";loginPinInput.value="";}
  if(loginSubmitBtn)loginSubmitBtn.style.display="none";
  if(loginError)loginError.textContent="";
  requestAnimationFrame(()=>loginModal.classList.add("active"));
  loadCustomersFromFirestore();
}
function closeLoginModal(){if(!loginModal)return;loginModal.classList.remove("active");loginModal.setAttribute("aria-hidden","true");setTimeout(()=>{loginModal.hidden=true;},200);}
function populateCustomerDropdown(at){
  if(!loginNameInput)return;
  loginNameInput.innerHTML='<option value="">-- اختر الاسم --</option>';
  let f=customersCache;if(at)f=customersCache.filter(c=>(c.accountType||"")===at);
  [...f].sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"ar")).forEach(c=>{const o=document.createElement("option");o.value=c.name;o.textContent=c.name;loginNameInput.appendChild(o);});
}
loginAccountType?.addEventListener("change",function(){if(this.value){populateCustomerDropdown(this.value);if(loginNameInput)loginNameInput.style.display="block";if(loginPinInput)loginPinInput.style.display="none";if(loginSubmitBtn)loginSubmitBtn.style.display="none";}else{if(loginNameInput)loginNameInput.style.display="none";if(loginPinInput)loginPinInput.style.display="none";if(loginSubmitBtn)loginSubmitBtn.style.display="none";}});
loginNameInput?.addEventListener("change",function(){if(this.value){if(loginPinInput)loginPinInput.style.display="block";if(loginSubmitBtn)loginSubmitBtn.style.display="block";}else{if(loginPinInput)loginPinInput.style.display="none";if(loginSubmitBtn)loginSubmitBtn.style.display="none";}});
loginPinInput?.addEventListener("keydown",e=>{if(e.key==="Enter")loginSubmitBtn?.click();});
loginSubmitBtn?.addEventListener("click",()=>{
  if(loginError)loginError.textContent="";
  const name=loginNameInput?.value.trim()||"";
  const pin=loginPinInput?.value.trim()||"";
  const at=loginAccountType?.value||"";
  if(!at){loginError.textContent=t("selectAccountType");return;}
  if(!name){loginError.textContent=t("selectNameErr");return;}
  if(!pin||pin.length!==4){loginError.textContent=t("pinFourDigits");return;}
  const match=customersCache.find(c=>String(c.name||"").trim().toLowerCase()===name.trim().toLowerCase());
  if(!match){loginError.textContent=t("accountNotFound");return;}
  if(String(match.pin)===pin){saveSession({id:match.id,name:match.name,accountType:match.accountType||at,permissions:match.permissions||{}},pin);closeLoginModal();}
  else{loginError.textContent=t("wrongPassword");}
});
document.getElementById("loginRequiredBtn")?.addEventListener("click",openLoginModal);
loginBtn?.addEventListener("click",openLoginModal);
document.getElementById("loginModalClose")?.addEventListener("click",closeLoginModal);
loginModal?.addEventListener("click",e=>{if(e.target===loginModal)closeLoginModal();});

/* PROFILE */
const profileToggle=document.getElementById("profileToggle");
const profileDropdown=document.getElementById("profileDropdown");
profileToggle?.addEventListener("click",e=>{e.stopPropagation();profileDropdown?.classList.toggle("show");});
document.addEventListener("click",e=>{if(profileDropdown?.classList.contains("show")&&!profileDropdown.contains(e.target)&&e.target!==profileToggle)profileDropdown.classList.remove("show");});
document.getElementById("profileLogoutBtn")?.addEventListener("click",()=>{profileDropdown?.classList.remove("show");if(confirm("هل تريد تسجيل الخروج؟"))clearSession();});
document.getElementById("profileTogglePin")?.addEventListener("click",()=>{const el=document.getElementById("profilePin");if(!el)return;if(el.textContent==="****"){el.textContent=currentCustomerPin||"N/A";document.getElementById("profileTogglePin").textContent="إخفاء";}else{el.textContent="****";document.getElementById("profileTogglePin").textContent="إظهار";}});
document.getElementById("profileChangePinBtn")?.addEventListener("click",async()=>{profileDropdown?.classList.remove("show");const np=prompt("كلمة المرور الجديدة (4 أرقام):");if(!np||!/^\d{4}$/.test(np)){alert("يجب أن تكون 4 أرقام");return;}currentCustomerPin=np;const s=JSON.parse(localStorage.getItem(SESSION_KEY)||"{}");s.pin=np;localStorage.setItem(SESSION_KEY,JSON.stringify(s));try{const{doc:d,updateDoc}=await import("https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js");const{db:dbRef}=await import("./firebase.js");await updateDoc(d(dbRef,"customers",currentCustomer.id),{pin:np});}catch(e){}alert("تم تغيير كلمة المرور");});
document.getElementById("profileInvoicesBtn")?.addEventListener("click",()=>{profileDropdown?.classList.remove("show");openInvoicesModal();});

/* INVOICES MODAL */
function openInvoicesModal(){if(!invoicesModal)return;invoicesModal.hidden=false;invoicesModal.setAttribute("aria-hidden","false");if(invoicesList)invoicesList.innerHTML=`<div class="loading-text">${t("loadingInvoices")}</div>`;document.getElementById("invoicesSubtitle").textContent=`${t("customer")}: ${currentCustomer?.name||""}`;requestAnimationFrame(()=>invoicesModal.classList.add("active"));loadCustomerInvoices();}
function closeInvoicesModal(){if(!invoicesModal)return;invoicesModal.classList.remove("active");invoicesModal.setAttribute("aria-hidden","true");setTimeout(()=>{invoicesModal.hidden=true;},200);}
async function loadCustomerInvoices(){
  if(!currentCustomer||!invoicesList)return;
  try{const{collection:col,query:q,where:wh,orderBy:ob,getDocs:gd}=await import("https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js");const{db:d}=await import("./firebase.js");
  let snap;try{snap=await gd(q(col(d,"invoices"),wh("customerId","==",currentCustomer.id),ob("createdAt","desc")));}catch(e){snap=await gd(q(col(d,"invoices"),wh("customerId","==",currentCustomer.id)));}
  if(snap.empty){invoicesList.innerHTML='<div class="empty-text">لا توجد فواتير</div>';return;}
  invoicesList.innerHTML="";
  snap.forEach(doc=>{const inv=doc.data();const div=document.createElement("div");div.className="invoice-history-card";
  div.innerHTML=`<div class="invoice-history-top"><strong class="invoice-history-no">${escapeHTML(inv.branchName||inv.invoiceNo||"")}</strong><span class="invoice-history-date">${inv.date||""}</span></div><div class="invoice-history-items">${escapeHTML((inv.items||[]).slice(0,3).map(i=>i.name).join("، "))}</div><div class="invoice-history-footer"><span>المنتجات: ${inv.totalItems||0}</span><span>الكمية: ${inv.totalQty||0}</span></div>`;
  div.addEventListener("click",()=>openInvoiceDetail(inv));invoicesList.appendChild(div);});
  }catch(e){invoicesList.innerHTML='<div class="error-text">حدث خطأ</div>';}
}
function openInvoiceDetail(inv){
  if(!invoiceDetailModal||!invoiceDetailContent)return;
  let h=`<div style="text-align:center;margin-bottom:14px;"><img src="images/logo.png" style="width:80px;height:auto;margin:0 auto 6px;" onerror="this.style.display='none'"><h2 style="color:var(--dark);">${t("invoiceDetails")}</h2></div>`;
  h+=`<div class="invoice-detail-meta"><div><span>${t("invoiceNum")}</span><strong>${escapeHTML((inv.invoiceNo||"").replace("INV-",""))}</strong></div><div><span>${t("customer")}</span><strong>${escapeHTML(inv.customerName||"")}</strong></div><div><span>${t("date")}</span><strong>${escapeHTML(inv.date||"")}</strong></div></div>`;
  h+=`<table class="invoice-detail-table"><thead><tr><th>#</th><th>${getLang()==="en"?"Item":"المنتج"}</th><th>KOD</th><th>${getLang()==="en"?"Qty":"الكمية"}</th></tr></thead><tbody>`;
  (inv.items||[]).forEach((it,i)=>{h+=`<tr><td>${i+1}</td><td>${escapeHTML(it.name||"")}</td><td>${escapeHTML(it.code||"")}</td><td>${getItemQty(it)}</td></tr>`;});
  h+=`</tbody></table><div class="invoice-detail-summary"><span>${t("products")}: ${inv.totalItems||0}</span><span>${t("qty")}: ${inv.totalQty||0}</span></div>`;
  h+=`<div style="text-align:center;margin-top:14px;"><button onclick="document.getElementById('invoiceDetailModal').classList.remove('active');document.getElementById('invoiceDetailModal').hidden=true;" style="padding:10px 24px;border:none;border-radius:10px;background:rgba(122,102,85,.1);color:var(--dark);font-weight:700;cursor:pointer;">${t("close")}</button></div>`;
  invoiceDetailContent.innerHTML=h;
  invoiceDetailModal.hidden=false;invoiceDetailModal.setAttribute("aria-hidden","false");
  requestAnimationFrame(()=>invoiceDetailModal.classList.add("active"));
}
document.getElementById("invoicesModalClose")?.addEventListener("click",closeInvoicesModal);
document.getElementById("invoicesCloseBtn")?.addEventListener("click",closeInvoicesModal);
invoicesModal?.addEventListener("click",e=>{if(e.target===invoicesModal)closeInvoicesModal();});
document.getElementById("invoiceDetailClose")?.addEventListener("click",()=>{if(invoiceDetailModal){invoiceDetailModal.classList.remove("active");invoiceDetailModal.setAttribute("aria-hidden","true");setTimeout(()=>{invoiceDetailModal.hidden=true;},200);}});
invoiceDetailModal?.addEventListener("click",e=>{if(e.target===invoiceDetailModal){invoiceDetailModal.classList.remove("active");invoiceDetailModal.setAttribute("aria-hidden","true");setTimeout(()=>{invoiceDetailModal.hidden=true;},200);}});

/* CART RENDER */
function getFilteredCart(){if(cartCategory==="all")return cart;return cart.filter(i=>(i.category||"")===cartCategory);}
function renderCart(){
  if(!cartItems)return;
  cartItems.innerHTML="";
  const sv=cartSearch?cartSearch.value.trim().toLowerCase():"";
  let vis=0;
  getFilteredCart().forEach(item=>{
    const pt=`${item.name||""} ${item.description||""} ${item.code||""}`.toLowerCase();
    if(sv&&!pt.includes(sv))return;
    vis++;
    cartItems.insertAdjacentHTML("beforeend",`<div class="cart-item"><img src="${escapeHTML(getProductImage(item))}" alt="${escapeHTML(item.name||"")}" onerror="this.src='images/noimg.jpg'"><div class="info"><h3>${escapeHTML(item.name||"")}</h3><p>${escapeHTML(item.description||"")}</p><p style="font-size:12px;color:var(--card);">SKU: ${escapeHTML(item.code||"")} | ${escapeHTML(item.category||"")}</p><div class="qty-controls"><button type="button" data-action="decrease" data-id="${escapeHTML(item.id)}">-</button><input type="number" min="1" value="${getItemQty(item)}" class="qty-input" data-id="${escapeHTML(item.id)}"><button type="button" data-action="increase" data-id="${escapeHTML(item.id)}">+</button></div></div><button type="button" class="delete-cart-item" data-action="delete" data-id="${escapeHTML(item.id)}">🗑 حذف</button></div>`);
  });
  if(cart.length===0)cartItems.innerHTML=`<div class="cart-item"><div class="info"><h3>${t("cartEmpty")}</h3></div></div>`;
  else if(vis===0)cartItems.innerHTML=`<div class="cart-item"><div class="info"><h3>${t("noResults")}</h3></div></div>`;
  if(cartTotal)cartTotal.textContent=getCartTotalQty();
  saveCart();
}
function findItem(id){return cart.find(i=>String(i.id)===String(id));}
function increaseQty(id){const i=findItem(id);if(!i)return;i.qty=getItemQty(i)+1;renderCart();}
function decreaseQty(id){const i=findItem(id);if(!i)return;i.qty=getItemQty(i)-1;if(i.qty<=0)cart=cart.filter(p=>String(p.id)!==String(id));renderCart();}
function updateQty(id,v){const i=findItem(id);if(!i)return;const q=parseInt(v,10);i.qty=isNaN(q)||q<1?1:q;renderCart();}
function deleteItem(id){cart=cart.filter(p=>String(p.id)!==String(id));renderCart();}

/* CART CATEGORY FILTER */
document.querySelectorAll("#cartCategoryFilter .cat-card").forEach(card=>{
  card.addEventListener("click",()=>{
    document.querySelectorAll("#cartCategoryFilter .cat-card").forEach(c=>c.classList.remove("active"));
    card.classList.add("active");cartCategory=card.dataset.cat;renderCart();
  });
});

/* CLEAR CART */
function isClearCartConfirmed(){return confirmClearInput&&confirmClearInput.value.trim().toLowerCase()==="yes";}
function openClearCartModal(){if(cart.length===0){alert("السلة فارغة");return;}if(!clearCartModal||!confirmClearInput||!confirmClearCartButton)return;confirmClearInput.value="";confirmClearCartButton.disabled=true;clearCartModal.classList.add("active");clearCartModal.setAttribute("aria-hidden","false");setTimeout(()=>confirmClearInput.focus(),50);}
function closeClearCartModal(){if(!clearCartModal)return;clearCartModal.classList.remove("active");clearCartModal.setAttribute("aria-hidden","true");if(confirmClearInput)confirmClearInput.value="";if(confirmClearCartButton)confirmClearCartButton.disabled=true;}
function clearCart(){cart=[];saveCart();renderCart();closeClearCartModal();}

/* INVOICE */
function makeInvoiceNumber(){let c=1;try{const v=localStorage.getItem(INV_COUNTER_KEY);if(v)c=parseInt(v,10)||1;}catch(e){}const n=String(c).padStart(4,"0");localStorage.setItem(INV_COUNTER_KEY,String(c+1));return`INV-${n}`;}
function formatInvoiceDate(){return new Date().toLocaleString("en-GB",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false});}
function populateBranchDropdown(){if(!branchNameInput)return;const cv=branchNameInput.value;branchNameInput.innerHTML='<option value="">-- اختر الفرع --</option>';getBranches().forEach(b=>{const o=document.createElement("option");o.value=b;o.textContent=b;branchNameInput.appendChild(o);});if(cv)branchNameInput.value=cv;}
function createInvoiceCells(item){const desc=item.description||"";return `<td class="invoice-check-cell"><span class="invoice-check-box"></span></td><td class="invoice-product-cell"><div class="invoice-product-main"><span class="invoice-product-number invoice-product-qty">${getItemQty(item)}</span><strong><bdi>${escapeHTML(item.name||"")}</bdi></strong></div>${desc?`<div class="invoice-product-details" dir="ltr" style="padding-right:80px;font-size:11px;color:#000;">${escapeHTML(desc)}</div>`:""}</td>`;}
function createEmptyCells(){return '<td class="invoice-check-cell invoice-empty-cell"></td><td class="invoice-product-cell invoice-empty-cell"></td>';}
function createInvoiceRowsFromCart(){const r=[];for(let i=0;i<cart.length;i+=COLUMNS_PER_INVOICE_ROW)r.push(cart.slice(i,i+COLUMNS_PER_INVOICE_ROW));return r;}
function renderInvoiceRows(rows){if(!invoiceProducts)return;invoiceProducts.innerHTML="";rows.forEach(ri=>{let h="";ri.forEach(it=>{h+=createInvoiceCells(it);});for(let e=ri.length;e<COLUMNS_PER_INVOICE_ROW;e++)h+=createEmptyCells();invoiceProducts.insertAdjacentHTML("beforeend",`<tr>${h}</tr>`);}
)}
function setFooterVisible(v){const s=invoiceTemplate?.querySelector(".invoice-summary-row");const d=invoiceTemplate?.querySelector(".invoice-delivery-info");const ds=v?"":"none";if(s)s.style.display=ds;if(d)d.style.display=ds;}
function getMaxHeight(){const w=invoiceTemplate?invoiceTemplate.scrollWidth:1120;return Math.floor(w*(A4_HEIGHT_MM/A4_WIDTH_MM))-24;}
function splitPages(rows){const pages=[];const mh=getMaxHeight();let s=0;while(s<rows.length){let e=s+1;let lg=e;while(e<=rows.length){renderInvoiceRows(rows.slice(s,e));setFooterVisible(e===rows.length);if(invoiceTemplate.scrollHeight<=mh){lg=e;e++;}else break;}pages.push(rows.slice(s,lg));s=lg;}return pages;}
function waitForImages(c){return Promise.all(Array.from(c.querySelectorAll("img")).map(i=>new Promise(r=>{if(i.complete){r();return;}i.onload=()=>r();i.onerror=()=>r();setTimeout(r,2000);})));}

async function saveInvoiceToFirestore(invoiceNo,customerName){
  try{const items=cart.map(it=>({id:it.id,name:it.name||"",description:it.description||"",code:it.code||"",category:it.category||"",qty:getItemQty(it)}));const bn=branchNameInput?branchNameInput.value.trim():"";
  await addDoc(collection(db,"invoices"),{invoiceNo,branchName:bn,customerId:currentCustomer?currentCustomer.id:"guest",customerName,accountType:currentCustomer?(currentCustomer.accountType||""):"",items,totalItems:cart.length,totalQty:getCartTotalQty(),createdAt:serverTimestamp(),date:new Date().toISOString()});
  }catch(e){console.error("Error saving invoice:",e);}
}

async function createInvoice(){
  if(cart.length===0){alert("السلة فارغة");return;}
  if(!currentCustomer){alert("سجل الدخول أولاً");openLoginModal();return;}
  const bn=branchNameInput?branchNameInput.value.trim():"";
  if(!bn){alert("اختر الفرع أولاً");branchNameInput?.focus();return;}
  const no=makeInvoiceNumber();
  document.getElementById("invoiceNo").textContent=no;
  document.getElementById("invoiceDate").textContent=formatInvoiceDate();
  document.getElementById("invoiceCustomer").textContent=currentCustomer.name;
  document.getElementById("invoiceTotal").textContent=cart.length;
  document.getElementById("invoiceQty").textContent=getCartTotalQty();
  const rv=document.getElementById("invRecvBranch");if(rv){const p=bn.split(" - ");rv.textContent=p.length===2?p[1]+" - "+p[0]:bn;}
  const rows=createInvoiceRowsFromCart();const pages=splitPages(rows);
  const pdf=new window.jspdf.jsPDF("P","mm","A4");
  for(let pi=0;pi<pages.length;pi++){
    renderInvoiceRows(pages[pi]);setFooterVisible(pi===pages.length-1);
    const th=invoiceTemplate?.querySelector("#invoiceTable thead");if(th)th.style.display=pi>0?"none":"";
    await waitForImages(invoiceTemplate);
    const canvas=await html2canvas(invoiceTemplate,{scale:2,useCORS:true,backgroundColor:"#ffffff",windowWidth:invoiceTemplate.scrollWidth,windowHeight:invoiceTemplate.scrollHeight});
    const imgData=canvas.toDataURL("image/png");const imgH=Math.min((canvas.height*A4_WIDTH_MM)/canvas.width,A4_HEIGHT_MM);
    if(pi>0)pdf.addPage();pdf.addImage(imgData,"PNG",0,0,A4_WIDTH_MM,imgH);
  }
  const th=invoiceTemplate?.querySelector("#invoiceTable thead");if(th)th.style.display="";setFooterVisible(true);
  pdf.save(`${bn}-${no}.pdf`);
  await saveInvoiceToFirestore(no,currentCustomer.name);
}

/* EVENTS */
if(cartItems){
  cartItems.addEventListener("click",e=>{const b=e.target.closest("button[data-action]");if(!b)return;const{action,id}=b.dataset;if(action==="increase")increaseQty(id);if(action==="decrease")decreaseQty(id);if(action==="delete")deleteItem(id);});
  cartItems.addEventListener("change",e=>{const i=e.target.closest(".qty-input");if(i)updateQty(i.dataset.id,i.value);});
}
if(cartSearch)cartSearch.addEventListener("input",renderCart);
if(createInvoiceButton)createInvoiceButton.addEventListener("click",createInvoice);
document.getElementById("whatsappBtn")?.addEventListener("click",()=>window.open("https://wa.me/966541429240","_blank"));
if(clearCartButton)clearCartButton.addEventListener("click",openClearCartModal);
if(confirmClearInput&&confirmClearCartButton){confirmClearInput.addEventListener("input",()=>{confirmClearCartButton.disabled=!isClearCartConfirmed();});confirmClearInput.addEventListener("keydown",e=>{if(e.key==="Enter"&&isClearCartConfirmed())clearCart();});}
if(cancelClearCartButton)cancelClearCartButton.addEventListener("click",closeClearCartModal);
if(confirmClearCartButton)confirmClearCartButton.addEventListener("click",()=>{if(isClearCartConfirmed())clearCart();});
if(clearCartModal)clearCartModal.addEventListener("click",e=>{if(e.target===clearCartModal)closeClearCartModal();});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){clearCartModal?.classList.contains("active")&&closeClearCartModal();loginModal?.classList.contains("active")&&closeLoginModal();invoicesModal?.classList.contains("active")&&closeInvoicesModal();if(invoiceDetailModal?.classList.contains("active")){invoiceDetailModal.classList.remove("active");invoiceDetailModal.setAttribute("aria-hidden","true");setTimeout(()=>{invoiceDetailModal.hidden=true;},200);}}});

/* INIT */
async function loadCategoryCounts(){
  try{
    const snap = await getDocs(collection(db,"products"));
    const counts = {};
    snap.forEach(d => { const cat = d.data().category; if(cat) counts[cat] = (counts[cat]||0)+1; });
    document.querySelectorAll("[data-cat-count]").forEach(badge => {
      const cat = badge.getAttribute("data-cat-count");
      const count = counts[cat] || 0;
      badge.textContent = count;
      badge.style.display = count > 0 ? "" : "none";
    });
  }catch(e){}
}
applyLang();
loadSession();
populateBranchDropdown();
renderCart();
loadCategoryCounts();
