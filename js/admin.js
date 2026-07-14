import { db } from "./firebase.js";
import { generateInvoicePdf } from "./invoice-pdf.js";
import {
  collection, addDoc, getDocs, deleteDoc, updateDoc, doc,
  query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

let editingId = null;
let allProducts = [];
let allInvoices = [];
let allCustomers = [];

const NEW_CATEGORIES = ["قسم المعمل","قسم السوبرماركت","قسم محلات الجملة","قسم المستودع","طلبات المعمل"];
const ARABIC_DAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const ARABIC_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

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
  revertToLoginScreen("اسم المستخدم أو كلمة المرور خاطئة");return false;
  }catch(e){revertToLoginScreen("خطأ في الاتصال");return false;}
}
async function seedDefaultAdmin(){try{const s=await getDocs(adminsCollection);if(s.empty)await addDoc(adminsCollection,{username:"admin",password:"admin"});}catch(e){}}

/* TABS */
const loadedTabs={};
async function loadTabContent(name){if(loadedTabs[name])return;loadedTabs[name]=true;switch(name){case"products":await loadProducts();break;case"invoices":await loadAllInvoices();break;case"customers":await loadAllCustomers();break;case"admins":await loadAdmins();break;case"branches":renderBranches();break;}}
function initTabs(){document.querySelectorAll(".admin-tab").forEach(tab=>{tab.addEventListener("click",function(){document.querySelectorAll(".admin-tab").forEach(t=>t.classList.remove("active"));document.querySelectorAll(".admin-section").forEach(s=>s.classList.remove("active"));this.classList.add("active");const n=this.dataset.tab;const sec=document.getElementById("section-"+n);if(sec)sec.classList.add("active");loadTabContent(n);});});}

/* PRODUCTS */
async function loadProducts(){const snap=await getDocs(productsCollection);allProducts=[];snap.forEach(d=>allProducts.push({id:d.id,...d.data()}));renderProducts(allProducts);}

function renderProducts(products){
  if(!productsTable)return;
  productsTable.innerHTML="";
  products.forEach(p=>{
    productsTable.insertAdjacentHTML("beforeend",`<div class="admin-product"><img src="${escapeHTML(getProductImage(p))}" alt="${escapeHTML(p.name||"")}" onerror="this.src='images/noimg.jpg'"><div class="admin-info"><h3>${escapeHTML(p.name||"")}</h3><p>${escapeHTML(p.description||"")}</p><p>SKU: ${escapeHTML(p.code||"")}</p><p style="color:var(--accent);font-weight:700;">${escapeHTML(p.category||"")}</p></div><div class="admin-actions"><button class="edit-btn" type="button" onclick="editProduct('${escapeHTML(p.id)}')">تعديل</button><button class="delete-btn" type="button" onclick="deleteProduct('${escapeHTML(p.id)}')">حذف</button></div></div>`);
  });
}

getElement("imageFile")?.addEventListener("change",function(){const f=this.files[0];if(!f)return;const r=new FileReader();r.onload=e=>{const pi=getElement("previewImage");if(pi)pi.src=e.target.result;};r.readAsDataURL(f);});

function clearForm(){["name","description","code","image"].forEach(id=>{const e=getElement(id);if(e)e.value="";});const f=getElement("imageFile");if(f)f.value="";const pi=getElement("previewImage");if(pi)pi.src="images/noimg.jpg";}

function compressImageFile(file){return new Promise((res,rej)=>{const img=new Image();const r=new FileReader();r.onload=e=>{img.onload=()=>{const c=document.createElement("canvas");let w=img.width,h=img.height;if(w>800){h=h*(800/w);w=800;}c.width=w;c.height=h;c.getContext("2d").drawImage(img,0,0,w,h);const d=c.toDataURL("image/jpeg",0.6);if(Math.ceil((d.length*3)/4)>1000000){rej(new Error("Image > 1MB"));return;}res(d);};img.onerror=()=>rej(new Error("Failed to load"));img.src=e.target.result;};r.onerror=()=>rej(new Error("Failed to read"));r.readAsDataURL(file);});}

getElement("save")?.addEventListener("click",async()=>{
  try{let img=getInputValue("image");const f=getElement("imageFile")?.files[0];if(f)img=await compressImageFile(f);if(!img)img="images/noimg.jpg";
  const p={name:getInputValue("name"),description:getInputValue("description"),code:getInputValue("code"),category:getInputValue("category"),image:img,createdAt:Date.now()};
  if(!p.name||!p.code){alert("يرجى تعبئة جميع الحقول المطلوبة");return;}
  if(editingId){await updateDoc(doc(db,"products",editingId),p);editingId=null;alert("تم تعديل المنتج");}
  else{await addDoc(productsCollection,p);alert("تم إضافة المنتج");}
  clearForm();await loadProducts();}catch(e){console.error(e);alert("حدث خطأ أثناء الحفظ");}
});

window.deleteProduct=async function(id){if(!confirm("حذف المنتج؟"))return;try{await deleteDoc(doc(db,"products",id));await loadProducts();}catch(e){alert("حدث خطأ");}};
window.editProduct=function(id){const p=allProducts.find(i=>String(i.id)===String(id));if(!p)return;editingId=id;getElement("name").value=p.name||"";getElement("description").value=p.description||"";getElement("code").value=p.code||"";getElement("category").value=p.category||"";getElement("image").value=p.image||"";const pi=getElement("previewImage");if(pi)pi.src=getProductImage(p);window.scrollTo({top:0,behavior:"smooth"});};

getElement("searchAdmin")?.addEventListener("input",function(){const v=normalizeText(this.value);renderProducts(allProducts.filter(p=>normalizeText(`${p.name||""} ${p.description||""} ${p.code||""} ${p.category||""}`).includes(v)));});
getElement("sortNewest")?.addEventListener("click",()=>renderProducts([...allProducts].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))));
getElement("sortOldest")?.addEventListener("click",()=>renderProducts([...allProducts].sort((a,b)=>(a.createdAt||0)-(b.createdAt||0))));
getElement("sortNameAsc")?.addEventListener("click",()=>renderProducts([...allProducts].sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"ar"))));

/* EXCEL */
function loadXLSXLibrary(){return new Promise((res,rej)=>{if(window.XLSX){res(window.XLSX);return;}const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";s.onload=()=>{if(window.XLSX)res(window.XLSX);else rej(new Error("XLSX not available"));};s.onerror=()=>rej(new Error("Failed to load XLSX"));document.head.appendChild(s);});}
function makeExcelFileName(){const n=new Date();return`products-${n.getFullYear()}${String(n.getMonth()+1).padStart(2,"0")}${String(n.getDate()).padStart(2,"0")}-${String(n.getHours()).padStart(2,"0")}${String(n.getMinutes()).padStart(2,"0")}.xlsx`;}

getElement("importExcel")?.addEventListener("click",async()=>{try{await loadXLSXLibrary();getElement("excelFile")?.click();}catch(e){alert("تعذر تحميل مكتبة Excel");}});
getElement("excelFile")?.addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{const XLSX=await loadXLSXLibrary();const d=await f.arrayBuffer();const wb=XLSX.read(d,{type:"array"});const sh=wb.Sheets[wb.SheetNames[0]];const prods=XLSX.utils.sheet_to_json(sh,{defval:""});const snap=await getDocs(productsCollection);let mc=9999;snap.forEach(i=>{const c=parseInt(i.data().code,10);if(!isNaN(c)&&c>mc)mc=c;});let nc=mc+1;const existing=allProducts.map(p=>normalizeText(p.name));let imp=0;for(const p of prods){const pn=normalizeText(p.name);if(!pn||existing.includes(pn))continue;await addDoc(productsCollection,{name:p.name||"",description:p.description||"",code:p.code||String(nc++),category:p.category||"",image:p.image||"images/noimg.jpg",createdAt:Date.now()});imp++;}e.target.value="";alert(`${imp} منتج تم استيراده`);await loadProducts();}catch(e){alert("حدث خطأ أثناء الاستيراد");}});
getElement("exportExcel")?.addEventListener("click",async()=>{const btn=getElement("exportExcel");const orig=btn?btn.innerHTML:"";try{if(btn){btn.disabled=true;btn.textContent="جاري التصدير...";}const XLSX=await loadXLSXLibrary();const rows=allProducts.map(p=>[p.name||"",p.description||"",p.category||"",getExportImageValue(p.image)]);if(!rows.length){alert("لا توجد منتجات");return;}const ws=XLSX.utils.aoa_to_sheet([["name","description","category","image"],...rows]);ws["!cols"]=[{wch:34},{wch:40},{wch:24},{wch:70}];const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Products");XLSX.writeFile(wb,makeExcelFileName(),{compression:true});}catch(e){alert("حدث خطأ أثناء التصدير");}finally{if(btn){btn.disabled=false;btn.innerHTML=orig;}}});

/* INVOICES */
async function loadAllInvoices(){
  const list=document.getElementById("allInvoicesList");if(!list)return;
  list.innerHTML="<div class='loading-msg'>جاري تحميل الفواتير...</div>";
  try{let snap;try{const q=query(invoicesCollection,orderBy("createdAt","desc"));snap=await getDocs(q);}catch(e){snap=await getDocs(invoicesCollection);}
  allInvoices=[];snap.forEach(d=>allInvoices.push({id:d.id,...d.data()}));renderAllInvoices(allInvoices);
  }catch(e){list.innerHTML="<div class='empty-msg'>حدث خطأ</div>";}
}
function renderAllInvoices(invoices){
  const list=document.getElementById("allInvoicesList");if(!list)return;
  if(!invoices.length){list.innerHTML="<div class='empty-msg'>لا توجد فواتير</div>";return;}
  list.innerHTML="";
  invoices.forEach(inv=>{
    const ds=formatArabicDate(inv.createdAt||inv.date);
    let preview="";if(inv.items?.length){preview=inv.items.slice(0,3).map(i=>i.name).join("، ");if(inv.items.length>3)preview+=`...+${inv.items.length-3}`;}
    let rows="";if(inv.items?.length)inv.items.forEach((it,i)=>{rows+=`<tr><td>${i+1}</td><td>${escapeHTML(it.name||"")}</td><td>${escapeHTML(it.code||"")}</td><td>${it.qty||0}</td></tr>`;});
    const dn=inv.branchName||inv.invoiceNo||"";const acc=inv.accountType||"";
    const card=document.createElement("div");card.className="invoice-admin-card";
    card.innerHTML=`<div class="inv-header"><strong>${escapeHTML(dn)}</strong><span>${ds}</span></div><div class="inv-customer">👤 ${escapeHTML(inv.customerName||"")}</div>${acc?`<div style="font-size:11px;color:var(--accent);font-weight:700;margin-bottom:4px;">${escapeHTML(acc)}</div>`:""}<div class="inv-items-preview">${escapeHTML(preview)}</div><div class="inv-footer"><span>المنتجات: ${inv.totalItems||0}</span><span>الكمية: ${inv.totalQty||0}</span></div><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;"><button class="inv-toggle-btn" type="button">عرض التفاصيل</button><button class="inv-print-btn" type="button">📥 PDF</button><button class="inv-del-btn" type="button">🗑 حذف</button></div><table class="inv-detail-table"><thead><tr><th>#</th><th>المنتج</th><th>KOD</th><th>الكمية</th></tr></thead><tbody>${rows}</tbody></table>`;
    card.querySelector(".inv-toggle-btn").addEventListener("click",()=>{const t=card.querySelector(".inv-detail-table");t.classList.toggle("show");card.querySelector(".inv-toggle-btn").textContent=t.classList.contains("show")?"إخفاء":"عرض التفاصيل";});
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
  list.innerHTML="<div class='loading-msg'>جاري تحميل العملاء...</div>";
  allCustomers=getLocalCustomers();
  try{const snap=await getDocs(customersCollection);const fids=new Set();
  snap.forEach(d=>{fids.add(d.id);const data=d.data();if(!allCustomers.find(c=>c.id===d.id))allCustomers.push({id:d.id,name:data.name,pin:data.pin,accountType:data.accountType||"",createdAt:data.createdAt});});
  const lids=new Set(allCustomers.map(c=>c.id));fids.forEach(fid=>{if(!lids.has(fid))allCustomers=allCustomers.filter(c=>c.id!==fid);});
  saveLocalCustomers(allCustomers);}catch(e){}
  renderAllCustomers(allCustomers);
}
function renderAllCustomers(customers){
  const list=document.getElementById("allCustomersList");if(!list)return;
  if(!customers.length){list.innerHTML="<div class='empty-msg'>لا يوجد عملاء</div>";return;}
  list.innerHTML="";
  customers.forEach(cust=>{
    const ds=cust.createdAt?formatArabicDate(cust.createdAt):"";
    const acc=cust.accountType||"غير محدد";
    const card=document.createElement("div");card.className="customer-admin-card";
    card.innerHTML=`<div class="cust-header"><strong>👤 ${escapeHTML(cust.name)}</strong><span>${escapeHTML(acc)}</span></div><div style="font-size:12px;color:var(--secondary);margin-top:4px;">${ds?`تاريخ التسجيل: ${ds}`:""}</div><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;"><button class="cust-toggle-btn" type="button">عرض الفواتير</button><button class="cust-del-btn" type="button">🗑 حذف</button></div><div class="cust-invoices"></div>`;
    const toggleBtn=card.querySelector(".cust-toggle-btn");
    const delBtn=card.querySelector(".cust-del-btn");
    const invDiv=card.querySelector(".cust-invoices");
    delBtn.addEventListener("click",()=>openDeleteCustomerModal(cust.id,cust.name));
    toggleBtn.addEventListener("click",async()=>{
      if(invDiv.classList.contains("show")){invDiv.classList.remove("show");invDiv.innerHTML="";toggleBtn.textContent="عرض الفواتير";return;}
      toggleBtn.textContent="جاري التحميل...";
      try{let snap;try{const q=query(invoicesCollection,where("customerId","==",cust.id),orderBy("createdAt","desc"));snap=await getDocs(q);}catch(e){snap=await getDocs(query(invoicesCollection,where("customerId","==",cust.id)));}
      invDiv.innerHTML="";if(snap.empty){invDiv.innerHTML="<p style='color:var(--secondary);padding:10px;'>لا توجد فواتير</p>";}
      else{snap.forEach(d=>{const inv=d.data();const ids=inv.branchName||inv.invoiceNo||"";const idv=document.createElement("div");idv.style.cssText="background:var(--bg);border-radius:8px;padding:10px;margin-bottom:6px;border-right:3px solid var(--accent);";idv.innerHTML=`<div style="display:flex;justify-content:space-between;font-size:13px;"><strong>${escapeHTML(ids)}</strong><span>${formatArabicDate(inv.createdAt||inv.date)}</span></div><div style="font-size:12px;color:var(--secondary);margin-top:3px;">المنتجات: ${inv.totalItems||0} | الكمية: ${inv.totalQty||0}</div>`;invDiv.appendChild(idv);});}
      invDiv.classList.add("show");toggleBtn.textContent="إخفاء الفواتير";
      }catch(e){invDiv.innerHTML="<p style='color:#dc3545;padding:10px;'>حدث خطأ</p>";invDiv.classList.add("show");}
    });
    list.appendChild(card);
  });
}

/* ADD CUSTOMER */
getElement("addCustBtn")?.addEventListener("click",async()=>{
  const name=getInputValue("newCustName");const pin=getInputValue("newCustPin");const acc=getInputValue("newCustAccountType");
  if(!name||name.length<2){alert("الاسم يجب أن يكون حرفين على الأقل");return;}
  if(!pin||pin.length!==4||!/^\d{4}$/.test(pin)){alert("كلمة المرور يجب أن تكون 4 أرقام");return;}
  if(allCustomers.find(c=>String(c.name||"").trim().toLowerCase()===name.toLowerCase())){alert("العميل موجود مسبقاً");return;}
  const id="local_"+Date.now()+"_"+Math.random().toString(36).slice(2,6);
  const local=getLocalCustomers();local.push({id,name,pin,accountType:acc,createdAt:Date.now()});saveLocalCustomers(local);
  getElement("newCustName").value="";getElement("newCustPin").value="";
  try{await addDoc(customersCollection,{name,pin,accountType:acc,createdAt:serverTimestamp()});}catch(e){}
  alert("تم إضافة العميل بنجاح");await loadAllCustomers();
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
window.confirmDeleteInvoice=async function(){if(!deleteInvoiceTargetId)return;const id=deleteInvoiceTargetId;deleteInvoiceTargetId=null;try{await Promise.race([deleteDoc(doc(db,"invoices",id)),new Promise((_,r)=>setTimeout(()=>r(new Error("Timeout")),10000))]);closeDeleteInvoiceModal();await loadAllInvoices();}catch(e){alert(e.message==="Timeout"?"انتهت المهلة":"حدث خطأ");}};

/* ADMINS */
async function loadAdmins(){
  const list=document.getElementById("adminsList");if(!list)return;
  try{const snap=await getDocs(adminsCollection);list.innerHTML="";
  if(snap.empty){list.innerHTML="<div class='empty-msg'>لا يوجد مدراء</div>";return;}
  snap.forEach(d=>{const data=d.data();const div=document.createElement("div");div.className="admin-user-card";div.innerHTML=`<strong>🔑 ${escapeHTML(data.username)}</strong><button class="del-admin-btn" data-id="${d.id}" type="button">حذف</button>`;list.appendChild(div);});
  list.querySelectorAll(".del-admin-btn").forEach(btn=>{btn.addEventListener("click",async()=>{if(!confirm("حذف المدير؟"))return;try{await deleteDoc(doc(db,"admins",btn.dataset.id));await loadAdmins();}catch(e){alert("حدث خطأ");}});});
  }catch(e){list.innerHTML="<div class='empty-msg'>حدث خطأ</div>";}
}
getElement("addAdminBtn")?.addEventListener("click",async()=>{
  const u=getInputValue("newAdminUser");const p=getInputValue("newAdminPass");
  if(!u||!p){alert("أدخل اسم المستخدم وكلمة المرور");return;}
  if(u.length<3||p.length<3){alert("3 أحرف على الأقل");return;}
  try{const q=query(adminsCollection,where("username","==",u));const snap=await getDocs(q);if(!snap.empty){alert("الاسم موجود مسبقاً");return;}
  await addDoc(adminsCollection,{username:u,password:p});getElement("newAdminUser").value="";getElement("newAdminPass").value="";alert("تم إضافة المدير");await loadAdmins();}catch(e){alert("حدث خطأ");}
});

/* BRANCHES */
const BRANCHES_KEY="sallah_branches";
const DEFAULT_BRANCHES=["فرع الحمدانية - Hamdanya","فرع الطائف - Altayf","فرع السامر - Al-Samer","فرع المعمل - Almamal"];
function getBranches(){try{const d=localStorage.getItem(BRANCHES_KEY);if(d){const p=JSON.parse(d);if(Array.isArray(p)&&p.length)return p;}}catch(e){}return[...DEFAULT_BRANCHES];}
function saveBranches(l){localStorage.setItem(BRANCHES_KEY,JSON.stringify(l));}
function renderBranches(){
  const list=document.getElementById("branchesList");if(!list)return;
  const branches=getBranches();
  if(!branches.length){list.innerHTML="<div class='empty-msg'>لا توجد فروع</div>";return;}
  list.innerHTML="";
  branches.forEach((b,idx)=>{
    const card=document.createElement("div");card.className="customer-admin-card";
    card.innerHTML=`<div class="cust-header"><strong>${escapeHTML(b)}</strong></div><div style="display:flex;gap:8px;margin-top:8px;"><button class="branch-del-btn" type="button" style="background:rgba(220,53,69,.1);color:#dc3545;border:none;border-radius:var(--radius-sm);padding:8px 14px;cursor:pointer;font-size:12px;font-weight:700;" data-index="${idx}">🗑 حذف</button></div>`;
    card.querySelector(".branch-del-btn").addEventListener("click",function(){const br=getBranches();const i=parseInt(this.dataset.index);if(i>=0&&i<br.length){if(confirm(`حذف "${br[i]}"؟`)){br.splice(i,1);saveBranches(br);renderBranches();}}});
    list.appendChild(card);
  });
}
getElement("addBranchBtn")?.addEventListener("click",function(){const n=getInputValue("newBranchName");if(!n){alert("أدخل اسم الفرع");return;}const b=getBranches();if(b.includes(n)){alert("الفرع موجود مسبقاً");return;}b.push(n);saveBranches(b);getElement("newBranchName").value="";renderBranches();});

/* PDF */
async function downloadInvoicePdf(inv){try{await generateInvoicePdf(inv);const fn=`${(inv.branchName||(inv.invoiceNo||"").replace("INV-","")||"invoice")}.pdf`;const m=document.getElementById("pdfSuccessMsg");if(m){m.textContent=`تم تحميل ${fn}`;setTimeout(()=>{m.textContent="";},3000);}}catch(e){alert("خطأ في إنشاء PDF");}}

/* INIT */
async function init(){await seedDefaultAdmin();const authed=await checkAdminAuth();if(!authed)return;sessionStorage.setItem(AUTH_KEY,"true");initTabs();await loadTabContent("products");}
init();
