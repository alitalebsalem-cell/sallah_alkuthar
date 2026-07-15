import { db } from "./firebase.js";
import { generateInvoicePdf } from "./invoice-pdf.js";
import {
  collection, addDoc, getDocs, deleteDoc, updateDoc, doc,
  query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getLang, setLang, t, catLabel, applyFullLang, applyMenuLang } from "./i18n.js";

let editingId = null;
let allProducts = [];
let allInvoices = [];
let allCustomers = [];

const NEW_CATEGORIES = ["قسم المعمل","قسم السوبرماركت","قسم محلات الجملة","قسم المستودع","احتياجات المعمل"];
const ARABIC_DAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const ARABIC_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const CAT_EN_NAMES_ADMIN = {"قسم المعمل":"Almamal","قسم السوبرماركت":"AlsuperNarket","قسم محلات الجملة":"Aljumllah","قسم المستودع":"Almstudaa","احتياجات المعمل":"AhtyagatAlmamal"};
const CAT_ORDER_ADMIN = ["قسم المعمل","قسم السوبرماركت","قسم محلات الجملة","قسم المستودع","احتياجات المعمل"];
const CATEGORY_PERMISSIONS={"حساب معمل":["احتياجات المعمل"],"حساب فرع":["قسم المعمل","قسم السوبرماركت","قسم محلات الجملة","قسم المستودع"]};

const productsTable = document.getElementById("productsTable");
const productsCollection = collection(db,"products");
const invoicesCollection = collection(db,"invoices");
const customersCollection = collection(db,"customers");
const adminsCollection = collection(db,"admins");

function escapeHTML(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
function getElement(id){return document.getElementById(id);}
function getInputValue(id){const e=getElement(id);return e?e.value.trim():"";}
function setText(id,v){const e=getElement(id);if(e)e.textContent=v;}
function getProductImage(p){if(p.image&&String(p.image).trim()!=="")return p.image;return "images/noimg.jpg";}
function normalizeText(v){return String(v??"").trim().toLowerCase();}
function isBase64Image(v){return typeof v==="string"&&v.startsWith("data:image/");}
function getExportImageValue(v){if(!v)return"";const i=String(v).trim();if(isBase64Image(i))return"Image stored inside database";if(i.length>32000)return"Image too long";return i;}
function formatArabicDate(date){if(!date)return"";const d=date.toDate?date.toDate():new Date(date);return`${ARABIC_DAYS[d.getDay()]} ${ARABIC_MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;}

/* AUTH */
const AUTH_KEY="sallah_admin_unlocked";
const VERIFIED_KEY="sallah_admin_verified";

function revertToLoginScreen(msg){
  sessionStorage.removeItem(AUTH_KEY);
  document.body.classList.add("admin-locked");
  getElement("adminLoginScreen").hidden=false;
  getElement("adminPanel").hidden=true;
  if(msg){const e=getElement("adminLoginError");if(e)e.textContent=msg;}
  const s=document.querySelector("script[data-admin-module='true']");if(s)s.remove();
}
function showAdminPanel(){
  sessionStorage.setItem(AUTH_KEY,"true");
  if(typeof showAdminPanelUI==="function")showAdminPanelUI();
  else{document.body.classList.remove("admin-locked");getElement("adminLoginScreen").hidden=true;getElement("adminPanel").hidden=false;}
}
async function checkAdminAuth(){
  if(sessionStorage.getItem(VERIFIED_KEY)==="true")return true;
  const la=sessionStorage.getItem("admin_login_attempt");
  if(!la){revertToLoginScreen("");return false;}
  const{username,password}=JSON.parse(la);sessionStorage.removeItem("admin_login_attempt");
  try{const q=query(adminsCollection,where("username","==",username));const snap=await getDocs(q);
  if(!snap.empty){const a=snap.docs[0].data();if(a.password===password){sessionStorage.setItem(VERIFIED_KEY,"true");showAdminPanel();return true;}}
  revertToLoginScreen(t("adminLoginError"));return false;
  }catch(e){revertToLoginScreen(t("adminConnError"));return false;}
}
async function seedDefaultAdmin(){try{const s=await getDocs(adminsCollection);if(s.empty)await addDoc(adminsCollection,{username:"admin",password:"admin"});}catch(e){}}

/* TABS */
const loadedTabs={};
async function loadTabContent(name){if(loadedTabs[name])return;loadedTabs[name]=true;switch(name){case"products":await loadProducts();break;case"invoices":await loadAllInvoices();break;case"customers":await loadAllCustomers();break;case"branches":renderBranches();break;case"categories":renderCategories();break;}}
function initTabs(){document.querySelectorAll(".admin-tab").forEach(tab=>{tab.addEventListener("click",function(){document.querySelectorAll(".admin-tab").forEach(t=>t.classList.remove("active"));document.querySelectorAll(".admin-section").forEach(s=>s.classList.remove("active"));this.classList.add("active");const n=this.dataset.tab;const sec=document.getElementById("section-"+n);if(sec)sec.classList.add("active");loadTabContent(n);});});}

/* PRODUCTS */
async function loadProducts(){const snap=await getDocs(productsCollection);allProducts=[];snap.forEach(d=>allProducts.push({id:d.id,...d.data()}));renderProducts(allProducts);updateCategoryBadges();rebuildCatPickCards();renderCategories();}

function updateCategoryBadges(){
  document.querySelectorAll(".cat-pick-card").forEach(c => {
    const cat = c.dataset.cat;
    const count = allProducts.filter(p => p.category === cat).length;
    const badge = c.querySelector(".cat-pick-badge");
    if(badge) badge.textContent = count;
  });
}

/* CATEGORY PICKER */
let selectedAdminCategory = null;
const categoryPicker = document.getElementById("categoryPicker");
const productFormSection = document.getElementById("productFormSection");
const categorySelect = document.getElementById("category");
const selectedCategoryName = document.getElementById("selectedCategoryName");

function showCategoryPicker(){
  if(categoryPicker) categoryPicker.style.display = "";
  if(productFormSection) productFormSection.style.display = "none";
  selectedAdminCategory = null;
  const catProducts = document.getElementById("categoryProductsSection");
  if(catProducts) catProducts.style.display = "none";
  // Re-render all products
  renderProducts(allProducts);
}
function showProductForm(cat){
  selectedAdminCategory = cat;
  if(categoryPicker) categoryPicker.style.display = "none";
  if(productFormSection) productFormSection.style.display = "";
  if(selectedCategoryName) selectedCategoryName.textContent = catLabel(cat);
  if(categorySelect){ categorySelect.value = cat; }
  // Show category products below the form
  renderCategoryProducts(cat);
}

function renderCategoryProducts(cat){
  const section = document.getElementById("categoryProductsSection");
  if(!section) return;
  const list = document.getElementById("categoryProductsList");
  const title = document.getElementById("categoryProductsTitle");
  if(!list) return;
  const catProducts = allProducts.filter(p => p.category === cat);
  if(title) title.textContent = `${t("productsInCategory")} - ${catLabel(cat)} (${catProducts.length})`;
  if(catProducts.length === 0){
    list.innerHTML = `<div class="empty-msg">${t("noProductsInCategory")}</div>`;
  } else {
    list.innerHTML = "";
    catProducts.forEach(p => {
      list.insertAdjacentHTML("beforeend",`<div class="admin-product"><img src="${escapeHTML(getProductImage(p))}" alt="${escapeHTML(p.description||p.name||"")}" onerror="this.src='images/noimg.jpg'"><div class="admin-info"><h3>${escapeHTML(p.description||"")}</h3><p class="product-name-ar">${escapeHTML(p.name||"")}</p><p>SKU: ${escapeHTML(p.code||"")}</p></div><div class="admin-actions"><button class="edit-btn" type="button" onclick="editProduct('${escapeHTML(p.id)}')">${t("editBtn")}</button><button class="delete-btn" type="button" onclick="deleteProduct('${escapeHTML(p.id)}')">${t("deleteBtn")}</button></div></div>`);
    });
  }
  section.style.display = "";
}

document.getElementById("catPickCardsContainer")?.addEventListener("click", e => {
  const btn = e.target.closest(".cat-pick-card");
  if(btn) showProductForm(btn.dataset.cat);
});
getElement("backToCategories")?.addEventListener("click", () => {
  showCategoryPicker();
  clearForm();
  editingId = null;
});

document.querySelectorAll(".admin-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    if(tab.dataset.tab === "products") showCategoryPicker();
  });
});

function renderProducts(products){
  if(!productsTable)return;
  productsTable.innerHTML="";
  const checked = new Set((window.__selectedProducts)||[]);
  products.forEach(p=>{
    const cid = p.id;
    productsTable.insertAdjacentHTML("beforeend",`<div class="admin-product"><label class="prod-check"><input type="checkbox" class="prod-cb" value="${escapeHTML(cid)}"${checked.has(cid)?" checked":""}></label><img src="${escapeHTML(getProductImage(p))}" alt="${escapeHTML(p.description||p.name||"")}" onerror="this.src='images/noimg.jpg'"><div class="admin-info"><h3>${escapeHTML(p.description||"")}</h3><p class="product-name-ar">${escapeHTML(p.name||"")}</p><p>SKU: ${escapeHTML(p.code||"")}</p><p style="color:var(--accent);font-weight:700;">${escapeHTML(catLabel(p.category||""))}</p></div><div class="admin-actions"><button class="edit-btn" type="button" onclick="editProduct('${escapeHTML(p.id)}')">${t("editBtn")}</button><button class="delete-btn" type="button" onclick="deleteProduct('${escapeHTML(p.id)}')">${t("deleteBtn")}</button></div></div>`);
  });
  // Re-check checkboxes after re-render
  productsTable.querySelectorAll(".prod-cb").forEach(cb => {
    if(checked.has(cb.value)) cb.checked = true;
    cb.addEventListener("change", updateBulkUI);
  });
  updateBulkUI();
}

getElement("imageFile")?.addEventListener("change",function(){const f=this.files[0];if(!f)return;const r=new FileReader();r.onload=e=>{const pi=getElement("previewImage");if(pi)pi.src=e.target.result;};r.readAsDataURL(f);});

function clearForm(){["name","description","code","image"].forEach(id=>{const e=getElement(id);if(e)e.value="";});const f=getElement("imageFile");if(f)f.value="";const pi=getElement("previewImage");if(pi)pi.src="images/noimg.jpg";}

function compressImageFile(file){return new Promise((res,rej)=>{const img=new Image();const r=new FileReader();r.onload=e=>{img.onload=()=>{const c=document.createElement("canvas");let w=img.width,h=img.height;if(w>800){h=h*(800/w);w=800;}c.width=w;c.height=h;c.getContext("2d").drawImage(img,0,0,w,h);const d=c.toDataURL("image/jpeg",0.6);if(Math.ceil((d.length*3)/4)>1000000){rej(new Error("Image > 1MB"));return;}res(d);};img.onerror=()=>rej(new Error("Failed to load"));img.src=e.target.result;};r.onerror=()=>rej(new Error("Failed to read"));r.readAsDataURL(file);});}

getElement("save")?.addEventListener("click",async()=>{
  try{let img=getInputValue("image");const f=getElement("imageFile")?.files[0];if(f)img=await compressImageFile(f);if(!img)img="images/noimg.jpg";
  const p={name:getInputValue("name"),description:getInputValue("description"),code:getInputValue("code"),category:getInputValue("category"),image:img,createdAt:Date.now()};
  if(!p.name||!p.code){alert(t("fillRequired"));return;}
  if(editingId){await updateDoc(doc(db,"products",editingId),p);editingId=null;alert(t("productUpdated"));}
  else{await addDoc(productsCollection,p);alert(t("productAdded"));}
  clearForm();await loadProducts();}catch(e){console.error(e);alert(t("errorSaving"));}
});

window.deleteProduct=async function(id){if(!confirm(t("deleteProduct")))return;try{await deleteDoc(doc(db,"products",id));await loadProducts();}catch(e){alert(t("errorOccurredShort"));}};
window.editProduct=function(id){const p=allProducts.find(i=>String(i.id)===String(id));if(!p)return;editingId=id;showProductForm(p.category||"قسم المعمل");getElement("name").value=p.name||"";getElement("description").value=p.description||"";getElement("code").value=p.code||"";getElement("image").value=p.image||"";const pi=getElement("previewImage");if(pi)pi.src=getProductImage(p);window.scrollTo({top:0,behavior:"smooth"});};

getElement("searchAdmin")?.addEventListener("input",function(){const v=normalizeText(this.value);renderProducts(allProducts.filter(p=>normalizeText(`${p.name||""} ${p.description||""} ${p.code||""} ${p.category||""}`).includes(v)));});
getElement("sortNewest")?.addEventListener("click",()=>renderProducts([...allProducts].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))));
getElement("sortOldest")?.addEventListener("click",()=>renderProducts([...allProducts].sort((a,b)=>(a.createdAt||0)-(b.createdAt||0))));
getElement("sortNameAsc")?.addEventListener("click",()=>renderProducts([...allProducts].sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"ar"))));

/* BULK CATEGORY CHANGE */
function getSelectedIds(){
  return Array.from(document.querySelectorAll(".prod-cb:checked")).map(cb => cb.value);
}
function updateBulkUI(){
  const ids = getSelectedIds();
  window.__selectedProducts = new Set(ids);
  const countEl = document.getElementById("selectedCount");
  if(countEl) countEl.textContent = ids.length;
  const btn = document.getElementById("bulkChangeCatBtn");
  const sel = document.getElementById("bulkCategorySelect");
  if(btn) btn.disabled = ids.length === 0 || !sel?.value;
  const allCb = document.getElementById("selectAllCheckbox");
  if(allCb){
    const total = document.querySelectorAll(".prod-cb").length;
    allCb.checked = total > 0 && ids.length === total;
    allCb.indeterminate = ids.length > 0 && ids.length < total;
  }
}
document.getElementById("selectAllCheckbox")?.addEventListener("change", function(){
  document.querySelectorAll(".prod-cb").forEach(cb => cb.checked = this.checked);
  updateBulkUI();
});
document.getElementById("bulkCategorySelect")?.addEventListener("change", updateBulkUI);
document.getElementById("bulkChangeCatBtn")?.addEventListener("click", async function(){
  const ids = getSelectedIds();
  if(ids.length === 0){ alert(t("noProductsSelected")); return; }
  const cat = document.getElementById("bulkCategorySelect")?.value;
  if(!cat){ alert(t("selectCategoryFirst")); return; }
  if(!confirm(`${ids.length} منتج → ${catLabel(cat)}؟`)) return;
  const btn = this;
  btn.disabled = true;
  btn.textContent = "جاري التحديث...";
  let success = 0, fail = 0;
  for(const id of ids){
    try{
      await updateDoc(doc(db, "products", id), { category: cat });
      success++;
    }catch(e){ fail++; }
  }
  btn.textContent = "تغيير القسم";
  btn.disabled = false;
  alert(`تم تحديث ${success} منتج` + (fail ? `, فشل ${fail}` : ""));
  await loadProducts();
  window.__selectedProducts = new Set();
  document.querySelectorAll(".prod-cb").forEach(cb => cb.checked = false);
  const allCb = document.getElementById("selectAllCheckbox");
  if(allCb){ allCb.checked = false; allCb.indeterminate = false; }
  updateBulkUI();
});

/* EXCEL */
function loadXLSXLibrary(){return new Promise((res,rej)=>{if(window.XLSX){res(window.XLSX);return;}const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";s.onload=()=>{if(window.XLSX)res(window.XLSX);else rej(new Error("XLSX not available"));};s.onerror=()=>rej(new Error("Failed to load XLSX"));document.head.appendChild(s);});}
function makeExcelFileName(){const n=new Date();return`products-${n.getFullYear()}${String(n.getMonth()+1).padStart(2,"0")}${String(n.getDate()).padStart(2,"0")}-${String(n.getHours()).padStart(2,"0")}${String(n.getMinutes()).padStart(2,"0")}.xlsx`;}

getElement("importExcel")?.addEventListener("click",async()=>{try{await loadXLSXLibrary();getElement("excelFile")?.click();}catch(e){alert(t("excelLoadError"));}});
getElement("excelFile")?.addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{const XLSX=await loadXLSXLibrary();const d=await f.arrayBuffer();const wb=XLSX.read(d,{type:"array"});const sh=wb.Sheets[wb.SheetNames[0]];const prods=XLSX.utils.sheet_to_json(sh,{defval:""});const snap=await getDocs(productsCollection);let mc=9999;snap.forEach(i=>{const c=parseInt(i.data().code,10);if(!isNaN(c)&&c>mc)mc=c;});let nc=mc+1;const existing=allProducts.map(p=>normalizeText(p.name));let imp=0;for(const p of prods){const pn=normalizeText(p.name);if(!pn||existing.includes(pn))continue;await addDoc(productsCollection,{name:p.name||"",description:p.description||"",code:p.code||String(nc++),category:p.category||"",image:p.image||"images/noimg.jpg",createdAt:Date.now()});imp++;}  e.target.value="";alert(`${imp}${t("productsExported")}`);await loadProducts();}catch(e){alert(t("errorImport"));}});
getElement("exportExcel")?.addEventListener("click",async()=>{const btn=getElement("exportExcel");const orig=btn?btn.innerHTML:"";try{if(btn){btn.disabled=true;btn.textContent=t("importing");}const XLSX=await loadXLSXLibrary();const rows=allProducts.map(p=>[p.name||"",p.description||"",p.code||"",getExportImageValue(p.image),p.category||""]);if(!rows.length){alert(t("noProductsExport"));return;}const ws=XLSX.utils.aoa_to_sheet([["name","description","code","image","category"],...rows]);ws["!cols"]=[{wch:34},{wch:40},{wch:12},{wch:70},{wch:24}];const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Products");XLSX.writeFile(wb,makeExcelFileName(),{compression:true});}catch(e){alert(t("errorExport"));}finally{if(btn){btn.disabled=false;btn.innerHTML=orig;}}});

/* INVOICES */
async function loadAllInvoices(){
  const list=document.getElementById("allInvoicesList");if(!list)return;
  list.innerHTML=`<div class='loading-msg'>${t("loadingInvoicesAdmin")}</div>`;
  try{let snap;try{const q=query(invoicesCollection,orderBy("createdAt","desc"));snap=await getDocs(q);}catch(e){snap=await getDocs(invoicesCollection);}
  allInvoices=[];snap.forEach(d=>allInvoices.push({id:d.id,...d.data()}));renderAllInvoices(allInvoices);
  }catch(e){list.innerHTML=`<div class='empty-msg'>${t("errorOccurred")}</div>`;}
}
function renderAllInvoices(invoices){
  const list=document.getElementById("allInvoicesList");if(!list)return;
  if(!invoices.length){list.innerHTML=`<div class='empty-msg'>${t("noInvoicesAdmin")}</div>`;return;}
  list.innerHTML="";
  invoices.forEach(inv=>{
    const ds=formatArabicDate(inv.createdAt||inv.date);
    let preview="";if(inv.items?.length){preview=inv.items.slice(0,3).map(i=>i.description||i.name).join("، ");if(inv.items.length>3)preview+=`...+${inv.items.length-3}`;}
    let rows="";
    if(inv.items?.length){
      let admItems = [...inv.items];
      if(inv.accountType === "حساب معمل"){
        admItems = admItems.filter(it => it.category === "احتياجات المعمل");
      }
      const admGroups = {};
      admItems.forEach(it => {
        const cat = it.category || "Other";
        if(!admGroups[cat]) admGroups[cat] = [];
        admGroups[cat].push(it);
      });
      let admIdx = 0;
      CAT_ORDER_ADMIN.forEach(cat => {
        const group = admGroups[cat];
        if(!group || group.length === 0) return;
        rows+=`<tr><td colspan="4" style="background:#d9d9d9;border:1px solid #bbb;padding:6px 10px;font-size:13px;font-weight:900;text-align:center;">${CAT_EN_NAMES_ADMIN[cat]||cat}</td></tr>`;
        group.forEach(it => {
          admIdx++;
          rows+=`<tr><td>${admIdx}</td><td>${escapeHTML(it.description||it.name||"")}</td><td>${escapeHTML(it.code||"")}</td><td>${it.qty||0}</td></tr>`;
        });
      });
      // Remaining categories not in CAT_ORDER_ADMIN
      Object.keys(admGroups).forEach(cat => {
        if(CAT_ORDER_ADMIN.includes(cat)) return;
        const group = admGroups[cat];
        if(!group || group.length === 0) return;
        rows+=`<tr><td colspan="4" style="background:#d9d9d9;border:1px solid #bbb;padding:6px 10px;font-size:13px;font-weight:900;text-align:center;">${cat}</td></tr>`;
        group.forEach(it => {
          admIdx++;
          rows+=`<tr><td>${admIdx}</td><td>${escapeHTML(it.description||it.name||"")}</td><td>${escapeHTML(it.code||"")}</td><td>${it.qty||0}</td></tr>`;
        });
      });
    }
    const dn=inv.branchName||inv.invoiceNo||"";const acc=inv.accountType||"";
    const card=document.createElement("div");card.className="invoice-admin-card";
    card.innerHTML=`<div class="inv-header"><strong>${escapeHTML(dn)}</strong><span>${ds}</span></div><div class="inv-customer">👤 ${escapeHTML(inv.customerName||"")}</div>${acc?`<div style="font-size:11px;color:var(--accent);font-weight:700;margin-bottom:4px;">${escapeHTML(acc)}</div>`:""}<div class="inv-items-preview">${escapeHTML(preview)}</div><div class="inv-footer"><span>${t("products")}: ${inv.totalItems||0}</span><span>${t("qty")}: ${inv.totalQty||0}</span></div><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;"><button class="inv-toggle-btn" type="button">${t("showDetails")}</button><button class="inv-print-btn" type="button">📥 PDF</button><button class="inv-del-btn" type="button">🗑 ${t("deleteBtn")}</button></div><table class="inv-detail-table"><thead><tr><th>#</th><th>${t("products")}</th><th>KOD</th><th>${t("qty")}</th></tr></thead><tbody>${rows}</tbody></table>`;
    card.querySelector(".inv-toggle-btn").addEventListener("click",()=>{const t2=card.querySelector(".inv-detail-table");t2.classList.toggle("show");card.querySelector(".inv-toggle-btn").textContent=t2.classList.contains("show")?t("hideDetails"):t("showDetails");});
    card.querySelector(".inv-print-btn").addEventListener("click",()=>downloadInvoicePdf(inv));
    card.querySelector(".inv-del-btn").addEventListener("click",()=>openDeleteInvoiceModal(inv.id,dn));
    list.appendChild(card);
  });
}
getElement("invoiceSearch")?.addEventListener("input",function(){const v=normalizeText(this.value);renderAllInvoices(allInvoices.filter(inv=>normalizeText(inv.customerName||"").includes(v)||normalizeText(inv.invoiceNo||"").includes(v)));});

/* CUSTOMERS */
const CUSTOMERS_LOCAL_KEY="sallah_customers_data";
function getLocalCustomers(){try{return JSON.parse(localStorage.getItem(CUSTOMERS_LOCAL_KEY))||[];}catch(e){return[];}}
function saveLocalCustomers(a){localStorage.setItem(CUSTOMERS_LOCAL_KEY,JSON.stringify(a));}
function removeLocalCustomer(id){saveLocalCustomers(getLocalCustomers().filter(c=>c.id!==id));}

async function loadAllCustomers(){
  const list=document.getElementById("allCustomersList");if(!list)return;
  list.innerHTML=`<div class='loading-msg'>${t("loadingCustomers")}</div>`;
  allCustomers=getLocalCustomers();
  try{const snap=await getDocs(customersCollection);const fids=new Set();
   snap.forEach(d=>{fids.add(d.id);const data=d.data();const existing=allCustomers.find(c=>c.id===d.id);if(existing){existing.permissions=data.permissions||{};}else{allCustomers.push({id:d.id,name:data.name,pin:data.pin,accountType:data.accountType||"",permissions:data.permissions||{},createdAt:data.createdAt});}});
  const lids=new Set(allCustomers.map(c=>c.id));fids.forEach(fid=>{if(!lids.has(fid))allCustomers=allCustomers.filter(c=>c.id!==fid);});
  allCustomers.forEach(c=>{const s=snap.docs.find(dd=>dd.id===c.id);if(s&&!s.data().accountType){try{updateDoc(doc(db,"customers",c.id),{accountType:"حساب معمل"});c.accountType="حساب معمل";}catch(e){}}});
  saveLocalCustomers(allCustomers);}catch(e){}
  renderAllCustomers(allCustomers);
}
function renderAllCustomers(customers){
  const list=document.getElementById("allCustomersList");if(!list)return;
  if(!customers.length){list.innerHTML=`<div class='empty-msg'>${t("noCustomers")}</div>`;return;}
  list.innerHTML="";
  customers.forEach(cust=>{
    const ds=cust.createdAt?formatArabicDate(cust.createdAt):"";
    const acc=cust.accountType||"غير محدد";
    const card=document.createElement("div");card.className="customer-admin-card";
    card.innerHTML=`<div class="cust-header"><strong>👤 ${escapeHTML(cust.name)}</strong><span class="cust-acc-type">${escapeHTML(acc)}</span> <button class="cust-edit-acc-btn" type="button" style="font-size:11px;padding:2px 8px;border:1px solid var(--accent);border-radius:6px;background:var(--white);color:var(--accent);cursor:pointer;font-weight:700;">✏️</button></div><div style="font-size:12px;color:var(--secondary);margin-top:4px;">${ds?`${t("registrationDate")} ${ds}`:""}</div><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;"><button class="cust-toggle-btn" type="button">${t("showInvoices")}</button><button class="cust-del-btn" type="button">🗑 ${t("deleteBtn")}</button></div><div class="cust-invoices"></div>`;
    const toggleBtn=card.querySelector(".cust-toggle-btn");
    const delBtn=card.querySelector(".cust-del-btn");
    const editAccBtn=card.querySelector(".cust-edit-acc-btn");
    const accSpan=card.querySelector(".cust-acc-type");
    const invDiv=card.querySelector(".cust-invoices");
    delBtn.addEventListener("click",()=>openDeleteCustomerModal(cust.id,cust.name));
    editAccBtn.addEventListener("click",async()=>{
      const existingPerms=card.querySelector(".cust-perm-section");
      if(existingPerms){existingPerms.remove();return;}
      const permSection=document.createElement("div");permSection.className="cust-perm-section";
      permSection.style.cssText="margin-top:8px;padding:8px;border:1px solid var(--accent);border-radius:8px;background:var(--bg);";
      const curPerms=cust.permissions||{};
      const defPerms=CATEGORY_PERMISSIONS[cust.accountType]||CAT_ORDER_ADMIN;
      const hasCustom=typeof curPerms==='object'&&Object.keys(curPerms).length>0;
      let ph=`<div style="font-size:12px;font-weight:700;margin-bottom:6px;color:var(--accent);">${t("permissionsLabel")}</div>`;
      CAT_ORDER_ADMIN.forEach(cat=>{
        const checked=hasCustom?!!curPerms[cat]:defPerms.includes(cat);
        ph+=`<label class="perm-label"><input type="checkbox" class="perm-checkbox" data-cat="${cat}" ${checked?"checked":""}><span data-i18n-cat="${cat}">${catLabel(cat)}</span></label>`;
      });
      ph+=`<div style="display:flex;gap:8px;margin-top:8px;"><button class="perm-save-btn" type="button">${t("savePerms")}</button><button class="perm-reset-btn" type="button">${t("resetPerms")}</button></div>`;
      permSection.innerHTML=ph;
      card.appendChild(permSection);
      permSection.querySelector(".perm-save-btn").addEventListener("click",async()=>{
        const perms={};CAT_ORDER_ADMIN.forEach(cat=>{const cb=permSection.querySelector(`.perm-checkbox[data-cat="${cat}"]`);if(cb)perms[cat]=cb.checked;});
        cust.permissions=perms;
        const lcArr=getLocalCustomers();const lc2=lcArr.find(c=>c.id===cust.id);if(lc2)lc2.permissions=perms;
        saveLocalCustomers(lcArr);
        try{await updateDoc(doc(db,"customers",cust.id),{permissions:perms});alert(t("permsSaved"));}catch(e){alert(t("errorOccurredShort"));}
      });
      permSection.querySelector(".perm-reset-btn").addEventListener("click",async()=>{
        cust.permissions={};
        const lcArr2=getLocalCustomers();const lc3=lcArr2.find(c=>c.id===cust.id);if(lc3)lc3.permissions={};
        saveLocalCustomers(lcArr2);
        try{await updateDoc(doc(db,"customers",cust.id),{permissions:{}});alert(t("permsReset"));}catch(e){alert(t("errorOccurredShort"));}
        permSection.querySelectorAll(".perm-checkbox").forEach(cb=>{const cat=cb.dataset.cat;cb.checked=defPerms.includes(cat);});
      });
    });
    toggleBtn.addEventListener("click",async()=>{
      if(invDiv.classList.contains("show")){invDiv.classList.remove("show");invDiv.innerHTML="";toggleBtn.textContent=t("showInvoices");return;}
      toggleBtn.textContent=t("uploading");
      try{let snap;try{const q=query(invoicesCollection,where("customerId","==",cust.id),orderBy("createdAt","desc"));snap=await getDocs(q);}catch(e){snap=await getDocs(query(invoicesCollection,where("customerId","==",cust.id)));}
      invDiv.innerHTML="";if(snap.empty){invDiv.innerHTML=`<p style='color:var(--secondary);padding:10px;'>${t("noInvoicesAdmin")}</p>`;}
      else{snap.forEach(d=>{const inv=d.data();const ids=inv.branchName||inv.invoiceNo||"";const idv=document.createElement("div");idv.style.cssText="background:var(--bg);border-radius:8px;padding:10px;margin-bottom:6px;border-right:3px solid var(--accent);";idv.innerHTML=`<div style="display:flex;justify-content:space-between;font-size:13px;"><strong>${escapeHTML(ids)}</strong><span>${formatArabicDate(inv.createdAt||inv.date)}</span></div><div style="font-size:12px;color:var(--secondary);margin-top:3px;">المنتجات: ${inv.totalItems||0} | الكمية: ${inv.totalQty||0}</div>`;invDiv.appendChild(idv);});}
      invDiv.classList.add("show");toggleBtn.textContent=t("hideInvoices");
      }catch(e){invDiv.innerHTML=`<p style='color:#dc3545;padding:10px;'>${t("errorOccurred")}</p>`;invDiv.classList.add("show");}
    });
    list.appendChild(card);
  });
}

/* ADD CUSTOMER */
getElement("addCustBtn")?.addEventListener("click",async()=>{
  const name=getInputValue("newCustName");const pin=getInputValue("newCustPin");const acc=getInputValue("newCustAccountType");
  if(!name||name.length<2){alert(t("nameMinTwo"));return;}
  if(!pin||pin.length!==4||!/^\d{4}$/.test(pin)){alert(t("pinMustFourDigits"));return;}
  if(allCustomers.find(c=>String(c.name||"").trim().toLowerCase()===name.toLowerCase())){alert(t("customerExists"));return;}
  const id="local_"+Date.now()+"_"+Math.random().toString(36).slice(2,6);
  const local=getLocalCustomers();local.push({id,name,pin,accountType:acc,createdAt:Date.now()});saveLocalCustomers(local);
  getElement("newCustName").value="";getElement("newCustPin").value="";
  try{await addDoc(customersCollection,{name,pin,accountType:acc,createdAt:serverTimestamp()});}catch(e){}
  alert(t("customerAdded"));await loadAllCustomers();
});

/* DELETE CUSTOMER */
let deleteCustomerTargetId=null;
function openDeleteCustomerModal(id,name){deleteCustomerTargetId=id;const o=document.getElementById("deleteCustomerModal");if(!o)return;document.getElementById("deleteCustName").textContent=name;const i=document.getElementById("deleteCustConfirmInput");if(i)i.value="";const b=document.getElementById("deleteCustConfirmBtn");if(b)b.disabled=true;o.hidden=false;o.setAttribute("aria-hidden","false");requestAnimationFrame(()=>o.classList.add("active"));}
window.closeDeleteCustomerModal=function(){const o=document.getElementById("deleteCustomerModal");if(!o)return;o.classList.remove("active");o.setAttribute("aria-hidden","true");setTimeout(()=>{o.hidden=true;},200);deleteCustomerTargetId=null;};
window.confirmDeleteCustomer=async function(){if(!deleteCustomerTargetId)return;const id=deleteCustomerTargetId;deleteCustomerTargetId=null;removeLocalCustomer(id);closeDeleteCustomerModal();await loadAllCustomers();try{await deleteDoc(doc(db,"customers",id));}catch(e){}};
getElement("customerSearch")?.addEventListener("input",function(){const v=normalizeText(this.value);renderAllCustomers(allCustomers.filter(c=>normalizeText(c.name||"").includes(v)));});

/* DELETE INVOICE */
let deleteInvoiceTargetId=null;
window.openDeleteInvoiceModal=function(id,name){deleteInvoiceTargetId=id;const o=document.getElementById("deleteInvoiceModal");if(!o)return;document.getElementById("deleteInvoiceName").textContent=name;const i=document.getElementById("deleteInvoiceConfirmInput");if(i)i.value="";const b=document.getElementById("deleteInvoiceConfirmBtn");if(b)b.disabled=true;o.hidden=false;o.setAttribute("aria-hidden","false");requestAnimationFrame(()=>o.classList.add("active"));};
window.closeDeleteInvoiceModal=function(){const o=document.getElementById("deleteInvoiceModal");if(!o)return;o.classList.remove("active");o.setAttribute("aria-hidden","true");setTimeout(()=>{o.hidden=true;},200);deleteInvoiceTargetId=null;};
window.confirmDeleteInvoice=async function(){if(!deleteInvoiceTargetId)return;const id=deleteInvoiceTargetId;deleteInvoiceTargetId=null;try{await Promise.race([deleteDoc(doc(db,"invoices",id)),new Promise((_,r)=>setTimeout(()=>r(new Error("Timeout")),10000))]);closeDeleteInvoiceModal();await loadAllInvoices();}catch(e){alert(e.message==="Timeout"?t("timeout"):t("errorOccurredShort"));}};

/* BRANCHES */
const BRANCHES_KEY="sallah_branches";
const DEFAULT_BRANCHES=["فرع الحمدانية - Hamdanya","فرع الطائف - Altayf","فرع السامر - Al-Samer","فرع المعمل - Almamal"];
function getBranches(){try{const d=localStorage.getItem(BRANCHES_KEY);if(d){const p=JSON.parse(d);if(Array.isArray(p)&&p.length)return p;}}catch(e){}return[...DEFAULT_BRANCHES];}
function saveBranches(l){localStorage.setItem(BRANCHES_KEY,JSON.stringify(l));}
function renderBranches(){
  const list=document.getElementById("branchesList");if(!list)return;
  const branches=getBranches();
  if(!branches.length){list.innerHTML=`<div class='empty-msg'>${t("noBranches")}</div>`;return;}
  list.innerHTML="";
  branches.forEach((b,idx)=>{
    const card=document.createElement("div");card.className="customer-admin-card";
    card.innerHTML=`<div class="cust-header"><strong>${escapeHTML(b)}</strong></div><div style="display:flex;gap:8px;margin-top:8px;"><button class="branch-edit-btn" type="button" style="background:var(--accent);color:#fff;border:none;border-radius:var(--radius-sm);padding:8px 14px;cursor:pointer;font-size:12px;font-weight:700;" data-index="${idx}">✏️ ${t("editBtn")}</button><button class="branch-del-btn" type="button" style="background:rgba(220,53,69,.1);color:#dc3545;border:none;border-radius:var(--radius-sm);padding:8px 14px;cursor:pointer;font-size:12px;font-weight:700;" data-index="${idx}">🗑 ${t("deleteBtn")}</button></div>`;
    card.querySelector(".branch-del-btn").addEventListener("click",function(){const br=getBranches();const i=parseInt(this.dataset.index);if(i>=0&&i<br.length){if(confirm(`Delete "${br[i]}"?`)){br.splice(i,1);saveBranches(br);renderBranches();}}});
    card.querySelector(".branch-edit-btn").addEventListener("click",function(){const br=getBranches();const i=parseInt(this.dataset.index);if(i<0||i>=br.length)return;const cur=br[i];const parts=cur.split(" - ");const ar=parts[0]||cur;const en=parts[1]||"";const newName=prompt(`${t("editBtn")}: ${cur}\n\n${t("branchName")} (عربي - English):`,cur);if(!newName||newName.trim()===cur)return;const trimmed=newName.trim();br[i]=trimmed;saveBranches(br);renderBranches();});
    list.appendChild(card);
  });
}
getElement("addBranchBtn")?.addEventListener("click",function(){const n=getInputValue("newBranchName");if(!n){alert(t("enterBranchName"));return;}const b=getBranches();if(b.includes(n)){alert(t("branchExists"));return;}b.push(n);saveBranches(b);getElement("newBranchName").value="";renderBranches();});

/* CATEGORIES MANAGEMENT */
const CAT_ICONS={"قسم المعمل":"🔬","قسم السوبرماركت":"🛒","قسم محلات الجملة":"🏪","قسم المستودع":"🏭","احتياجات المعمل":"📋"};
const CAT_META_KEY="simsim_cat_meta";
let _renameCatOldName="";
function getCatMeta(){try{return JSON.parse(localStorage.getItem(CAT_META_KEY))||{};}catch(e){return{};}}
function saveCatMeta(m){localStorage.setItem(CAT_META_KEY,JSON.stringify(m));}
function getCatMetaObj(cat){const m=getCatMeta();return m[cat]||{nameEn:cat,desc:"",showDesc:true};}
function catDisplayName(cat){const meta=getCatMetaObj(cat);return getLang()==="en"?meta.nameEn:cat;}

function rebuildCatPickCards(){
  const cont=document.getElementById("catPickCardsContainer");if(!cont)return;
  const cats=[...new Set(allProducts.filter(p=>p.category).map(p=>p.category))];
  cont.innerHTML="";
  cats.forEach(cat=>{
    const meta=getCatMetaObj(cat);const icon=meta.icon||CAT_ICONS[cat]||"📦";
    const count=allProducts.filter(p=>p.category===cat).length;
    const btn=document.createElement("button");btn.type="button";btn.className="cat-pick-card";btn.dataset.cat=cat;
    btn.innerHTML=`${icon}<span class="cat-pick-badge">${count}</span><br><span class="cat-pick-label">${catDisplayName(cat)}</span>`;
    btn.addEventListener("click",()=>showProductForm(cat));
    cont.appendChild(btn);
  });
  // Also rebuild the category select in product form
  const catSelect=document.getElementById("category");
  if(catSelect){
    const curVal=catSelect.value;
    catSelect.innerHTML="";
    cats.forEach(cat=>{
      const meta=getCatMetaObj(cat);const icon=meta.icon||CAT_ICONS[cat]||"📦";
      const opt=document.createElement("option");opt.value=cat;
      opt.textContent=`${icon} ${catDisplayName(cat)}`;
      catSelect.appendChild(opt);
    });
    if(cats.includes(curVal))catSelect.value=curVal;
  }
  // Rebuild bulk category select
  const bulkSelect=document.getElementById("bulkCategorySelect");
  if(bulkSelect){
    const curVal2=bulkSelect.value;
    bulkSelect.innerHTML=`<option value="">-- ${t("selectCategory")} --</option>`;
    cats.forEach(cat=>{
      const meta=getCatMetaObj(cat);const icon=meta.icon||CAT_ICONS[cat]||"📦";
      const opt=document.createElement("option");opt.value=cat;
      opt.textContent=`${icon} ${catDisplayName(cat)}`;
      bulkSelect.appendChild(opt);
    });
    if(cats.includes(curVal2))bulkSelect.value=curVal2;
  }
}

window.openRenameCatModal=function(oldName){
  _renameCatOldName=oldName;
  document.getElementById("renameCatArInput").value="";
  document.getElementById("renameCatEnInput").value="";
  const meta=getCatMetaObj(oldName);
  document.getElementById("renameCatDescInput").value=meta.desc||"";
  document.getElementById("renameCatShowDesc").checked=meta.showDesc!==false;
  const m=document.getElementById("renameCatModal");m.classList.add("active");m.setAttribute("aria-hidden","false");
  setTimeout(()=>document.getElementById("renameCatArInput").focus(),100);
};
window.closeRenameCatModal=function(){
  const m=document.getElementById("renameCatModal");m.classList.remove("active");m.setAttribute("aria-hidden","true");
};

window.confirmRenameCat=async function(){
  if(document.getElementById("renameCatConfirmBtn").disabled)return;
  document.getElementById("renameCatConfirmBtn").disabled=true;
  const arName=document.getElementById("renameCatArInput").value.trim();
  const enName=document.getElementById("renameCatEnInput").value.trim();
  if(!arName){alert("Arabic name required");document.getElementById("renameCatConfirmBtn").disabled=false;return;}
  const oldName=_renameCatOldName;
  const desc=document.getElementById("renameCatDescInput").value.trim();
  const showDesc=document.getElementById("renameCatShowDesc").checked;
  if(arName===oldName&&enName===(getCatMetaObj(oldName).nameEn||oldName)&&desc===(getCatMetaObj(oldName).desc||"")&&showDesc===(getCatMetaObj(oldName).showDesc!==false)){closeRenameCatModal();document.getElementById("renameCatConfirmBtn").disabled=false;return;}
  const icon=getCatMetaObj(oldName).icon||CAT_ICONS[oldName]||"📦";
  const ids=allProducts.filter(p=>p.category===oldName).map(p=>p.id);let s=0,f=0;
  for(const id of ids){try{await updateDoc(doc(db,"products",id),{category:arName});s++;}catch(e){f++;}}
  if(oldName!==arName){
    try{const snap=await getDocs(collection(db,"customers"));for(const d of snap.docs){const perms=d.data().permissions;if(perms&&typeof perms==='object'&&perms[oldName]!==undefined){const np={...perms};np[arName]=np[oldName];delete np[oldName];await updateDoc(doc(db,"customers",d.id),{permissions:np});}}}catch(e){console.error(e);}
    const localC=getLocalCustomers();if(localC){let ch=false;localC.forEach(c=>{if(c.permissions&&c.permissions[oldName]!==undefined){c.permissions[arName]=c.permissions[oldName];delete c.permissions[oldName];ch=true;}});if(ch)saveLocalCustomers(localC);}
    if(CAT_ICONS[oldName]){CAT_ICONS[arName]=CAT_ICONS[oldName];delete CAT_ICONS[oldName];}
    const idx=CAT_ORDER_ADMIN.indexOf(oldName);if(idx!==-1)CAT_ORDER_ADMIN[idx]=arName;
    if(CAT_EN_NAMES_ADMIN[oldName]){CAT_EN_NAMES_ADMIN[arName]=CAT_EN_NAMES_ADMIN[oldName];delete CAT_EN_NAMES_ADMIN[oldName];}
    for(const at in CATEGORY_PERMISSIONS){const arr=CATEGORY_PERMISSIONS[at];const oi=arr.indexOf(oldName);if(oi!==-1)arr[oi]=arName;}
  }
  const allMeta=getCatMeta();
  if(allMeta[oldName]){allMeta[arName]=allMeta[oldName];delete allMeta[oldName];}
  if(!allMeta[arName])allMeta[arName]={};
  allMeta[arName].nameEn=enName||arName;allMeta[arName].icon=icon;
  allMeta[arName].desc=desc;allMeta[arName].showDesc=showDesc;
  saveCatMeta(allMeta);
  closeRenameCatModal();document.getElementById("renameCatConfirmBtn").disabled=false;
  await loadProducts();applyAdminLang();loadAllCustomers();
};
function renderCategories(){
  const list=document.getElementById("categoriesList");const sec=document.getElementById("catProdSection");
  if(!list)return;
  if(sec)sec.style.display="none";list.style.display="";
  const cats=[...new Set(allProducts.map(p=>p.category).filter(Boolean))];
  list.innerHTML="";
  if(cats.length===0){list.innerHTML=`<div class='empty-msg'>${t("noProductsInCat")}</div>`;return;}
  cats.forEach(cat=>{
    const count=allProducts.filter(p=>p.category===cat).length;const meta=getCatMetaObj(cat);
    const icon=meta.icon||CAT_ICONS[cat]||"📦";
    const dispName=catDisplayName(cat);
    const hasDesc=!!meta.desc;
    const showDesc=meta.showDesc!==false;
    const card=document.createElement("div");card.className="cat-admin-card";
    card.innerHTML=`<span class="cat-admin-icon">${icon}</span><div style="flex:1;min-width:0;"><div class="cat-admin-name">${escapeHTML(dispName)}</div>${hasDesc?`<div class="cat-admin-desc" style="display:${showDesc?'':'none'}">${escapeHTML(meta.desc)}</div>`:""}</div><span class="cat-admin-count">(${count})</span><div class="cat-admin-actions"><button class="cat-rename-btn" type="button">${t("renameCategory")}</button>${hasDesc?`<button class="cat-desc-toggle-btn" type="button" style="font-size:11px;">${showDesc?'🕶️':'👁️'}</button>`:""}<button class="cat-del-btn" type="button">${t("deleteCategory")}</button></div>`;
    card.querySelector(".cat-admin-name").addEventListener("click",()=>showCategoryProducts(cat));
    card.querySelector(".cat-rename-btn").addEventListener("click",e=>{e.stopPropagation();openRenameCatModal(cat);});
    card.querySelector(".cat-del-btn").addEventListener("click",e=>{e.stopPropagation();deleteCategory(cat);});
    const toggleBtn=card.querySelector(".cat-desc-toggle-btn");
    if(toggleBtn)toggleBtn.addEventListener("click",e=>{e.stopPropagation();const allMeta=getCatMeta();if(!allMeta[cat])allMeta[cat]={};allMeta[cat].showDesc=!showDesc;saveCatMeta(allMeta);renderCategories();});
    list.appendChild(card);
  });
}
function showCategoryProducts(cat){
  const list=document.getElementById("categoriesList");const sec=document.getElementById("catProdSection");
  const prodList=document.getElementById("catProdList");const title=document.getElementById("catProdTitle");
  const addBtn=document.getElementById("addProductFromCat");list.style.display="none";
  if(sec)sec.style.display="";if(title)title.textContent=`${catDisplayName(cat)} (${allProducts.filter(p=>p.category===cat).length})`;
  const products=allProducts.filter(p=>p.category===cat);
  if(!prodList)return;
  prodList.innerHTML=products.length===0?`<div class='empty-msg'>${t("noProductsInCat")}</div>`:"";
  products.forEach(p=>{prodList.insertAdjacentHTML("beforeend",`<div class="admin-product"><img src="${escapeHTML(getProductImage(p))}" alt="${escapeHTML(p.description||p.name||"")}" onerror="this.src='images/noimg.jpg'"><div class="admin-info"><h3>${escapeHTML(p.description||"")}</h3><p class="product-name-ar">${escapeHTML(p.name||"")}</p><p>SKU: ${escapeHTML(p.code||"")}</p></div><div class="admin-actions"><button class="edit-btn" type="button" onclick="editProduct('${escapeHTML(p.id)}')">${t("editBtn")}</button><button class="delete-btn" type="button" onclick="deleteProduct('${escapeHTML(p.id)}')">${t("deleteBtn")}</button></div></div>`);});
  if(addBtn)addBtn.onclick=()=>{clearForm();editingId=null;showProductForm(cat);document.querySelectorAll(".admin-tab").forEach(t=>t.classList.remove("active"));document.querySelectorAll(".admin-section").forEach(s=>s.classList.remove("active"));const pt=document.querySelector('[data-tab="products"]');const ps=document.getElementById("section-products");if(pt)pt.classList.add("active");if(ps)ps.classList.add("active");};
  const backBtn=document.getElementById("backToCategoriesList");
  if(backBtn)backBtn.onclick=()=>{if(sec)sec.style.display="none";list.style.display="";renderCategories();};
}
async function deleteCategory(cat){
  if(!confirm(`${t("deleteCategoryConfirm")}\n${t("products")} ${t("qty")}: ${allProducts.filter(p=>p.category===cat).length}`))return;
  const ids=allProducts.filter(p=>p.category===cat).map(p=>p.id);let s=0,f=0;
  for(const id of ids){try{await updateDoc(doc(db,"products",id),{category:""});s++;}catch(e){f++;}}
  const allMeta=getCatMeta();delete allMeta[cat];saveCatMeta(allMeta);
  alert(`${t("deleteCategorySuccess")} (${s}/${ids.length})`);await loadProducts();renderCategories();
}

/* PDF */
async function downloadInvoicePdf(inv){try{await generateInvoicePdf(inv);const fn=`${(inv.branchName||(inv.invoiceNo||"").replace("INV-","")||"invoice")}.pdf`;const m=document.getElementById("pdfSuccessMsg");if(m){m.textContent=`${t("pdfDownloaded")} ${fn}`;setTimeout(()=>{m.textContent="";},3000);}}catch(e){alert(t("pdfError"));}}

/* INIT */
function applyAdminLang(){
  const lang = getLang();
  const isEn = lang === "en";
  document.documentElement.lang = lang;
  document.documentElement.dir = isEn ? "ltr" : "rtl";
  const btn = document.getElementById("adminLangToggle");
  if(btn) btn.textContent = isEn ? "🌐 عربي" : "🌐 EN";

  // Admin login screen
  const loginH1 = document.querySelector("#adminLoginScreen h1");
  const loginP = document.querySelector("#adminLoginScreen p");
  const loginBtn = document.querySelector("#adminLoginForm button[type='submit']");
  if(loginH1) loginH1.textContent = t("adminLoginTitle");
  if(loginP) loginP.textContent = t("adminLoginSubtitle");
  if(loginBtn) loginBtn.textContent = t("adminLoginBtn");

  // Tabs
  const tabs = document.querySelectorAll(".admin-tab");
  const tabKeys = ["productsTab","invoicesTab","customersTab","branchesTab","categoriesTab"];
  tabs.forEach((tab,i) => {
    if(tabKeys[i]) tab.textContent = t(tabKeys[i]);
  });

  // Category picker title
  const pickerTitle = document.querySelector("#categoryPicker h2:first-child");
  if(pickerTitle) pickerTitle.textContent = t("selectCategory");

  // Category picker cards - rebuild dynamically
  rebuildCatPickCards();

  // All Products heading
  const allProdH2 = document.querySelector("#categoryPicker > hr + h2");
  if(allProdH2) allProdH2.textContent = t("allProducts");

  // Product form
  const backBtn = document.getElementById("backToCategories");
  if(backBtn) backBtn.textContent = t("backToCategories");
  const addTitle = document.querySelector("#productFormSection h2");
  if(addTitle) addTitle.innerHTML = `${t("addProductTo")} <span id="selectedCategoryName" style="color:var(--accent);"></span>`;
  const ph = {name:"arabicName",description:"englishName",code:"productCode",image:"imageLink"};
  Object.entries(ph).forEach(([id,key]) => {
    const el = document.getElementById(id);
    if(el) el.placeholder = t(key);
  });
  const saveBtn = document.getElementById("save");
  if(saveBtn) saveBtn.textContent = t("saveProduct");

  // Category select in product form
  const catSelect = document.getElementById("category");
  if(catSelect){
    CAT_ORDER_ADMIN.forEach(cat => {
      const opt = catSelect.querySelector(`option[value="${cat}"]`);
      if(opt) opt.textContent = catLabel(cat);
    });
  }

  // Upload image label
  const uploadLabel = document.querySelector("label[for='imageFile']");
  if(uploadLabel) uploadLabel.textContent = t("uploadImage");

  // Import/Export Excel buttons
  const importBtn = document.getElementById("importExcel");
  if(importBtn) importBtn.textContent = t("importExcelLabel");
  const exportBtn = document.getElementById("exportExcel");
  if(exportBtn) exportBtn.textContent = t("exportExcelLabel");

  // Bulk actions
  const selectAllLabel = document.getElementById("selectAllLabel");
  if(selectAllLabel) selectAllLabel.textContent = t("bulkSelectAll");
  const bulkCatSel = document.getElementById("bulkCategorySelect");
  if(bulkCatSel){
    const defOpt = bulkCatSel.querySelector("option[value='']");
    if(defOpt) defOpt.textContent = t("bulkCategoryPlaceholder");
  }
  const bulkBtn = document.getElementById("bulkChangeCatBtn");
  if(bulkBtn) bulkBtn.textContent = t("bulkChangeBtn");

  // Categories section
  const catBackBtn = document.getElementById("backToCategoriesList");
  if(catBackBtn) catBackBtn.textContent = t("catProductsBack");
  const catAddBtn = document.getElementById("addProductFromCat");
  if(catAddBtn) catAddBtn.textContent = t("addProductToCat");

  // Category names in dynamic sections (e.g. customer permissions)
  document.querySelectorAll("[data-i18n-cat]").forEach(el => {
    el.textContent = catLabel(el.getAttribute("data-i18n-cat"));
  });

  // Search and sort
  const searchAdmin = document.getElementById("searchAdmin");
  if(searchAdmin) searchAdmin.placeholder = t("searchProduct");
  const sortBtns = {sortNewest:"sortNewest",sortOldest:"sortOldest",sortNameAsc:"sortNameAsc"};
  Object.entries(sortBtns).forEach(([id,key]) => {
    const el = document.getElementById(id);
    if(el) el.textContent = t(key);
  });

  // Products table buttons
  document.querySelectorAll(".edit-btn").forEach(b => b.textContent = t("editBtn"));
  document.querySelectorAll(".delete-btn").forEach(b => b.textContent = t("deleteBtn"));

  // Invoices section
  const invTitle = document.querySelector("#section-invoices h2");
  if(invTitle) invTitle.textContent = t("allInvoices");
  const invSearch = document.getElementById("invoiceSearch");
  if(invSearch) invSearch.placeholder = t("searchInvoice");

  // Customers section
  const custTitle = document.querySelector("#section-customers h2");
  if(custTitle) custTitle.textContent = t("addCustomer");
  const custName = document.getElementById("newCustName");
  if(custName) custName.placeholder = t("customerName");
  const custPin = document.getElementById("newCustPin");
  if(custPin) custPin.placeholder = t("customerPin");
  const custBtn = document.getElementById("addCustBtn");
  if(custBtn) custBtn.textContent = t("addCustomerBtn");
  const custSearch = document.getElementById("customerSearch");
  if(custSearch) custSearch.placeholder = t("searchCustomer");

  // Account type dropdown
  const accSel = document.getElementById("newCustAccountType");
  if(accSel && accSel.options.length >= 2){
    accSel.options[0].textContent = t("accountTypeLab");
    accSel.options[1].textContent = t("accountTypeBranch");
  }

  // Branches section
  const brTitle = document.querySelector("#section-branches h2");
  if(brTitle) brTitle.textContent = t("manageBranches");
  const brName = document.getElementById("newBranchName");
  if(brName) brName.placeholder = t("branchName");
  const brBtn = document.getElementById("addBranchBtn");
  if(brBtn) brBtn.textContent = t("addBranchBtn");


  // Floating menu
  applyMenuLang();

  // Re-render category products / categories list on language switch
  if(selectedAdminCategory) renderCategoryProducts(selectedAdminCategory);
  const catSec = document.getElementById("section-categories");
  if(catSec && catSec.classList.contains("active")) renderCategories();
}
getElement("adminLangToggle")?.addEventListener("click", () => {
  setLang(getLang() === "ar" ? "en" : "ar");
  applyAdminLang();
});

// Rename category modal
document.getElementById("renameCatCancelBtn")?.addEventListener("click", closeRenameCatModal);
document.getElementById("renameCatConfirmBtn")?.addEventListener("click", confirmRenameCat);
document.getElementById("renameCatModal")?.addEventListener("click", e => {
  if(e.target === e.currentTarget) closeRenameCatModal();
});
document.getElementById("renameCatModal")?.addEventListener("keydown", e => {
  if(e.key === "Escape") closeRenameCatModal();
  if(e.key === "Enter" && !document.getElementById("renameCatConfirmBtn").disabled) confirmRenameCat();
});
['renameCatArInput','renameCatEnInput','renameCatDescInput'].forEach(id => {
  document.getElementById(id)?.addEventListener("keydown", e => {
    if(e.key === "Enter"){ e.stopPropagation(); document.getElementById("renameCatConfirmBtn")?.click(); }
  });
});

async function init(){await seedDefaultAdmin();const authed=await checkAdminAuth();if(!authed)return;sessionStorage.setItem(AUTH_KEY,"true");applyAdminLang();initTabs();await loadTabContent("products");}
init();
