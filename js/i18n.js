const LANG_KEY = "sallah_lang";
const CAT_LABELS = {
  ar: {"قسم المعمل":"قسم المعمل","قسم السوبرماركت":"قسم السوبرماركت","قسم محلات الجملة":"محلات الجملة","قسم المستودع":"قسم المستودع","احتياجات المعمل":"احتياجات المعمل","الكل":"الكل"},
  en: {"قسم المعمل":"Lab","قسم السوبرماركت":"Supermarket","قسم محلات الجملة":"Wholesale","قسم المستودع":"Warehouse","احتياجات المعمل":"Lab Needs","الكل":"All"}
};
const T = {
  ar: {
    searchPlaceholder: "🔍 ابحث عن منتج...",
    login: "🔑 دخول",
    loginTitle: "تسجيل الدخول",
    loginSubtitle: "اختر نوع الحساب والاسم وأدخل كلمة المرور",
    accountType: "-- نوع الحساب --",
    accountTypeLab: "حساب معمل",
    accountTypeBranch: "حساب فرع",
    selectName: "-- اختر الاسم --",
    pinPlaceholder: "كلمة المرور (4 أرقام)",
    submit: "دخول",
    name: "الاسم:",
    type: "النوع:",
    show: "إظهار",
    hide: "إخفاء",
    changePin: "🔑 تغيير كلمة المرور",
    myInvoices: "📄 فواتيري",
    logout: "🚪 تسجيل الخروج",
    logoutConfirm: "هل تريد تسجيل الخروج؟",
    welcomeMsg: "مرحباً بك في سمسم",
    welcomeSub: "سجّل دخولك للوصول إلى المنتجات",
    loginBtnOverlay: "🔑 تسجيل الدخول",
    addedToCart: "تمت الإضافة",
    addToCart: "إضافة إلى السلة",
    noProducts: "لا توجد منتجات في هذا القسم",
    loading: "جاري تحميل المنتجات...",
    selectAccountType: "اختر نوع الحساب",
    selectNameErr: "اختر الاسم",
    pinFourDigits: "كلمة المرور 4 أرقام",
    accountNotFound: "الحساب غير موجود",
    wrongPassword: "كلمة المرور خاطئة",
    invoiceNum: "رقم الفاتورة",
    customer: "العميل",
    date: "التاريخ",
    products: "المنتجات",
    qty: "الكمية",
    close: "إغلاق",
    myInvoicesTitle: "📄 فواتيري",
    loadingInvoices: "جاري تحميل الفواتير...",
    noInvoices: "لا توجد فواتير",
    invoiceDetails: "تفاصيل الفاتورة",
    changePinPrompt: "أدخل كلمة المرور الجديدة (4 أرقام):",
    pinMustBeFour: "يجب أن تكون 4 أرقام",
    pinChanged: "تم تغيير كلمة المرور",
    cartTitle: "سلة المشتريات",
    itemCount: "عدد المنتجات",
    selectBranch: "-- اختر الفرع --",
    createInvoice: "📄 إنشاء فاتورة",
    whatsapp: "💬 واتساب",
    clearCart: "🗑 حذف جميع المحتويات",
    backToStore: "← العودة للمتجر",
    cartEmpty: "🛒 السلة فارغة",
    noResults: "لا توجد نتائج",
    cartSearchPlaceholder: "🔍 ابحث في السلة...",
    cartRequiredMsg: "سجّل دخولك أولاً",
    cartRequiredSub: "سجّل دخولك للوصول إلى السلة",
    confirmDeleteCart: "تأكيد حذف السلة",
    confirmDeleteCartMsg: "سيتم حذف جميع المنتجات. للتأكيد اكتب",
    cancel: "إلغاء",
    delete: "حذف",
    emptyCart: "السلة فارغة",
    loginFirst: "سجل الدخول أولاً",
    chooseBranch: "اختر الفرع أولاً",
    adminPanel: "لوحة الإدارة",
    invoicesView: "عرض الفواتير",
    dashboard: "Dashboard",
    menuStore: "المتجر",
    menuCart: "السلة",
    menuAdmin: "لوحة الإدارة",
    menuInvoices: "عرض الفواتير",
    menuDashboard: "Dashboard",
    adminLoginTitle: "لوحة الإدارة",
    adminLoginSubtitle: "الرجاء إدخال اسم المستخدم وكلمة المرور",
    adminUsername: "اسم المستخدم",
    adminPassword: "كلمة السر",
    adminLoginBtn: "دخول",
    adminLoginError: "",
    langToggle: "EN",
    selectCategory: "📦 اختر القسم لإضافة منتج جديد",
    backToCategories: "← العودة",
    addProductTo: "إضافة إلى:",
    arabicName: "الاسم بالعربي",
    englishName: "الاسم بالإنجليزي",
    productCode: "كود المنتج",
    imageLink: "رابط الصورة",
    importExcel: "📥 استيراد من ملف إكسل",
    exportExcel: "📤 تصدير إلى إكسل",
    saveProduct: "💾 حفظ المنتج",
    allProducts: "جميع المنتجات",
    searchProduct: "🔍 البحث عن منتج...",
    sortNewest: "الأحدث",
    sortOldest: "الأقدم",
    sortNameAsc: "أ → ي",
    invoicesTab: "📄 الفواتير",
    productsTab: "🛒 المنتجات",
    customersTab: "👥 العملاء",
    branchesTab: "🏪 الفروع",
    adminsTab: "🔐 المدراء",
    allInvoices: "📄 جميع الفواتير",
    searchInvoice: "🔍 البحث بالعميل أو رقم الفاتورة...",
    addCustomer: "👥 إضافة عميل جديد",
    customerName: "اسم العميل",
    customerPin: "كلمة المرور (4 أرقام)",
    addCustomerBtn: "➕ إضافة عميل",
    searchCustomer: "🔍 البحث عن عميل...",
    manageBranches: "🏪 إدارة الفروع",
    branchName: "اسم الفرع",
    addBranchBtn: "➕ إضافة فرع",
    manageAdmins: "🔐 إدارة المدراء",
    adminUsernameLabel: "اسم المستخدم",
    adminPasswordLabel: "كلمة السر",
    addAdminBtn: "➕ إضافة مدير",
    labNeeds: "احتياجات المعمل",
    confirmDelete: "Yes",
    cancelDelete: "إلغاء",
    deleteConfirm: "حذف",
    deleteCustomerTitle: "حذف العميل",
    deleteCustomerMsg: "هل أنت متأكد من حذف",
    deleteInvoiceTitle: "حذف الفاتورة",
    deleteInvoiceMsg: "هل أنت متأكد من حذف فاتورة",
    adminLoginChecking: "جاري التحقق...",
    adminLoginError: "اسم المستخدم أو كلمة المرور خاطئة",
    adminConnError: "خطأ في الاتصال",
    loadingProducts: "جاري تحميل المنتجات...",
    loadingCustomers: "جاري تحميل العملاء...",
    loadingInvoicesAdmin: "جاري تحميل الفواتير...",
    errorOccurred: "حدث خطأ",
    noCustomers: "لا يوجد عملاء",
    noInvoicesAdmin: "لا توجد فواتير",
    noBranches: "لا توجد فروع",
    noAdmins: "لا يوجد مدراء",
    showDetails: "عرض التفاصيل",
    hideDetails: "إخفاء",
    showInvoices: "عرض الفواتير",
    hideInvoices: "إخفاء الفواتير",
    deleteProduct: "حذف المنتج؟",
    deleteAdmin: "حذف المدير؟",
    fillRequired: "يرجى تعبئة جميع الحقول المطلوبة",
    productUpdated: "تم تعديل المنتج",
    productAdded: "تم إضافة المنتج",
    errorSaving: "حدث خطأ أثناء الحفظ",
    customerAdded: "تم إضافة العميل بنجاح",
    customerExists: "العميل موجود مسبقاً",
    nameMinTwo: "الاسم يجب أن يكون حرفين على الأقل",
    pinMustFourDigits: "كلمة المرور يجب أن تكون 4 أرقام",
    adminAdded: "تم إضافة المدير",
    adminExists: "الاسم موجود مسبقاً",
    adminMinThree: "3 أحرف على الأقل",
    fillUserPass: "أدخل اسم المستخدم وكلمة المرور",
    branchAdded: "تمت إضافة الفرع",
    branchExists: "الفرع موجود مسبقاً",
    enterBranchName: "أدخل اسم الفرع",
    deletedSuccessfully: "تم الحذف بنجاح",
    errorOccurredShort: "حدث خطأ",
    timeout: "انتهت المهلة",
    importing: "جاري التصدير...",
    productsExported: " منتج تم استيراده",
    noProductsExport: "لا توجد منتجات",
    excelLoadError: "تعذر تحميل مكتبة Excel",
    errorImport: "حدث خطأ أثناء الاستيراد",
    errorExport: "حدث خطأ أثناء التصدير",
    pdfDownloaded: "تم تحميل",
    pdfError: "خطأ في إنشاء PDF",
    uploading: "جاري التحميل...",
    invoicesViewTitle: "📄 عرض الفواتير",
    invoicesViewSub: "عرض الفواتير - للقراءة فقط",
    searchInvoiceView: "🔍 البحث بالعميل أو رقم الفاتورة...",
    loadingInvoicesView: "جاري تحميل الفواتير...",
    noInvoicesView: "لا توجد فواتير",
    showDetailsView: "عرض التفاصيل",
    hideDetailsView: "إخفاء",
    printBtn: "🖨 طباعة",
    dashboardTitle: "لوحة التحكم",
    dashboardSub: "اختر القسم",
    dashStore: "🛒 المتجر",
    dashAdmin: "⚙️ لوحة الإدارة",
    dashInvoices: "📄 عرض الفواتير",
    editBtn: "تعديل",
    deleteBtn: "حذف",
    registrationDate: "تاريخ التسجيل:",
  },
  en: {
    searchPlaceholder: "🔍 Search products...",
    login: "🔑 Login",
    loginTitle: "Login",
    loginSubtitle: "Select account type, name and enter PIN",
    accountType: "-- Account Type --",
    accountTypeLab: "Lab Account",
    accountTypeBranch: "Branch Account",
    selectName: "-- Select Name --",
    pinPlaceholder: "PIN (4 digits)",
    submit: "Login",
    name: "Name:",
    type: "Type:",
    show: "Show",
    hide: "Hide",
    changePin: "🔑 Change PIN",
    myInvoices: "📄 My Invoices",
    logout: "🚪 Logout",
    logoutConfirm: "Are you sure you want to logout?",
    welcomeMsg: "Welcome to SimSim",
    welcomeSub: "Login to access products",
    loginBtnOverlay: "🔑 Login",
    addedToCart: "Added!",
    addToCart: "Add to Cart",
    noProducts: "No products in this section",
    loading: "Loading products...",
    selectAccountType: "Select account type",
    selectNameErr: "Select a name",
    pinFourDigits: "PIN must be 4 digits",
    accountNotFound: "Account not found",
    wrongPassword: "Wrong PIN",
    invoiceNum: "Invoice No",
    customer: "Customer",
    date: "Date",
    products: "Products",
    qty: "Qty",
    close: "Close",
    myInvoicesTitle: "📄 My Invoices",
    loadingInvoices: "Loading invoices...",
    noInvoices: "No invoices yet",
    invoiceDetails: "Invoice Details",
    changePinPrompt: "Enter new PIN (4 digits):",
    pinMustBeFour: "Must be 4 digits",
    pinChanged: "PIN changed successfully",
    cartTitle: "Shopping Cart",
    itemCount: "Item Count",
    selectBranch: "-- Select Branch --",
    createInvoice: "📄 Create Invoice",
    whatsapp: "💬 WhatsApp",
    clearCart: "🗑 Clear All Items",
    backToStore: "← Back to Store",
    cartEmpty: "🛒 Cart is empty",
    noResults: "No results found",
    cartSearchPlaceholder: "🔍 Search in cart...",
    cartRequiredMsg: "Please login first",
    cartRequiredSub: "Login to access the cart",
    confirmDeleteCart: "Confirm Cart Deletion",
    confirmDeleteCartMsg: "All items will be deleted. Type to confirm:",
    cancel: "Cancel",
    delete: "Delete",
    emptyCart: "Cart is empty",
    loginFirst: "Please login first",
    chooseBranch: "Select a branch first",
    adminPanel: "Admin Panel",
    invoicesView: "Invoices View",
    dashboard: "Dashboard",
    menuStore: "Store",
    menuCart: "Cart",
    menuAdmin: "Admin Panel",
    menuInvoices: "Invoices",
    menuDashboard: "Dashboard",
    adminLoginTitle: "Admin Panel",
    adminLoginSubtitle: "Enter username and password",
    adminUsername: "Username",
    adminPassword: "Password",
    adminLoginBtn: "Login",
    adminLoginError: "",
    langToggle: "عربي",
    selectCategory: "📦 Select a category to add products",
    backToCategories: "← Back",
    addProductTo: "Add to:",
    arabicName: "Arabic Name",
    englishName: "English Name",
    productCode: "Product Code",
    imageLink: "Image URL",
    importExcel: "📥 Import from Excel",
    exportExcel: "📤 Export to Excel",
    saveProduct: "💾 Save Product",
    allProducts: "All Products",
    searchProduct: "🔍 Search products...",
    sortNewest: "Newest",
    sortOldest: "Oldest",
    sortNameAsc: "A → Z",
    invoicesTab: "📄 Invoices",
    productsTab: "🛒 Products",
    customersTab: "👥 Customers",
    branchesTab: "🏪 Branches",
    adminsTab: "🔐 Admins",
    allInvoices: "📄 All Invoices",
    searchInvoice: "🔍 Search by customer or invoice...",
    addCustomer: "👥 Add New Customer",
    customerName: "Customer Name",
    customerPin: "PIN (4 digits)",
    addCustomerBtn: "➕ Add Customer",
    searchCustomer: "🔍 Search customer...",
    manageBranches: "🏪 Manage Branches",
    branchName: "Branch Name",
    addBranchBtn: "➕ Add Branch",
    manageAdmins: "🔐 Manage Admins",
    adminUsernameLabel: "Username",
    adminPasswordLabel: "Password",
    addAdminBtn: "➕ Add Admin",
    labNeeds: "Lab Needs",
    confirmDelete: "Yes",
    cancelDelete: "Cancel",
    deleteConfirm: "Delete",
    deleteCustomerTitle: "Delete Customer",
    deleteCustomerMsg: "Are you sure you want to delete",
    deleteInvoiceTitle: "Delete Invoice",
    deleteInvoiceMsg: "Are you sure you want to delete invoice",
    adminLoginChecking: "Checking...",
    adminLoginError: "Wrong username or password",
    adminConnError: "Connection error",
    loadingProducts: "Loading products...",
    loadingCustomers: "Loading customers...",
    loadingInvoicesAdmin: "Loading invoices...",
    errorOccurred: "An error occurred",
    noCustomers: "No customers",
    noInvoicesAdmin: "No invoices",
    noBranches: "No branches",
    noAdmins: "No admins",
    showDetails: "Show Details",
    hideDetails: "Hide",
    showInvoices: "Show Invoices",
    hideInvoices: "Hide Invoices",
    deleteProduct: "Delete product?",
    deleteAdmin: "Delete admin?",
    fillRequired: "Please fill all required fields",
    productUpdated: "Product updated",
    productAdded: "Product added",
    errorSaving: "Error saving",
    customerAdded: "Customer added successfully",
    customerExists: "Customer already exists",
    nameMinTwo: "Name must be at least 2 characters",
    pinMustFourDigits: "PIN must be 4 digits",
    adminAdded: "Admin added",
    adminExists: "Name already exists",
    adminMinThree: "At least 3 characters",
    fillUserPass: "Enter username and password",
    branchAdded: "Branch added",
    branchExists: "Branch already exists",
    enterBranchName: "Enter branch name",
    deletedSuccessfully: "Deleted successfully",
    errorOccurredShort: "An error occurred",
    timeout: "Timeout",
    importing: "Exporting...",
    productsExported: " products imported",
    noProductsExport: "No products",
    excelLoadError: "Failed to load Excel library",
    errorImport: "Error importing",
    errorExport: "Error exporting",
    pdfDownloaded: "Downloaded",
    pdfError: "Error generating PDF",
    loading: "Loading...",
    invoicesViewTitle: "📄 Invoices View",
    invoicesViewSub: "Read-only invoice listing",
    searchInvoiceView: "🔍 Search by customer or invoice number...",
    loadingInvoicesView: "Loading invoices...",
    noInvoicesView: "No invoices found",
    showDetailsView: "Show Details",
    hideDetailsView: "Hide",
    printBtn: "🖨 Print",
    dashboardTitle: "Dashboard",
    dashboardSub: "Choose a section",
    dashStore: "🛒 Store",
    dashAdmin: "⚙️ Admin Panel",
    dashInvoices: "📄 Invoices View",
    editBtn: "Edit",
    deleteBtn: "Delete",
    registrationDate: "Registration date:",
  }
};

export function getLang(){ return localStorage.getItem(LANG_KEY) || "ar"; }
export function setLang(lang){ localStorage.setItem(LANG_KEY, lang); }
export function t(key){ return (T[getLang()] || T.ar)[key] || key; }
export function catLabel(catKey){ return (CAT_LABELS[getLang()] || CAT_LABELS.ar)[catKey] || catKey; }

export function applyMenuLang(){
  const lang = getLang();
  const isEn = lang === "en";
  document.querySelectorAll("#dashMenuDropdown a").forEach(a => {
    const key = a.getAttribute("data-i18n-menu");
    if(!key) return;
    const icon = a.querySelector(".dash-icon");
    const iconHtml = icon ? icon.outerHTML : '';
    a.innerHTML = iconHtml + ' ' + t(key);
  });
}

export function applyFullLang(selectors){
  const lang = getLang();
  const isEn = lang === "en";
  document.documentElement.lang = lang;
  document.documentElement.dir = isEn ? "ltr" : "rtl";

  if(selectors?.langToggle){
    const btn = document.getElementById(selectors.langToggle);
    if(btn) btn.textContent = isEn ? "عربي" : "EN";
  }

  if(selectors?.search) {
    const el = document.getElementById(selectors.search);
    if(el) el.placeholder = t("searchPlaceholder");
  }

  if(selectors?.loginBtn){
    const el = document.getElementById(selectors.loginBtn);
    if(el) el.innerHTML = t("login");
  }

  if(selectors?.loginRequiredOverlay){
    const ov = document.getElementById(selectors.loginRequiredOverlay);
    if(ov){
      const h2 = ov.querySelector("h2");
      const p = ov.querySelector("p");
      const btn = ov.querySelector("button");
      if(h2) h2.textContent = t("welcomeMsg");
      if(p) p.textContent = t("welcomeSub");
      if(btn) btn.textContent = t("loginBtnOverlay");
    }
  }

  if(selectors?.loginModal){
    const m = document.getElementById(selectors.loginModal);
    if(m){
      const h2 = m.querySelector("h2");
      const sub = m.querySelector(".login-subtitle");
      if(h2) h2.textContent = t("loginTitle");
      if(sub) sub.textContent = t("loginSubtitle");
      const sel = m.querySelector("#loginAccountType");
      if(sel && sel.options.length >= 3){
        sel.options[0].textContent = t("accountType");
        sel.options[1].textContent = t("accountTypeLab");
        sel.options[2].textContent = t("accountTypeBranch");
      }
      const nameSel = m.querySelector("#loginName");
      if(nameSel){
        const def = nameSel.querySelector('option[value=""]');
        if(def) def.textContent = t("selectName");
      }
      const pin = m.querySelector("#loginPin");
      if(pin) pin.placeholder = t("pinPlaceholder");
      const subBtn = m.querySelector("#loginSubmit");
      if(subBtn) subBtn.textContent = t("submit");
    }
  }

  if(selectors?.profile){
    const items = document.querySelectorAll("#profileDropdown .profile-dropdown-item");
    if(items[0]){ const s = items[0].querySelector("strong"); if(s) s.textContent = t("name"); }
    if(items[1]){ const s = items[1].querySelector("strong"); if(s) s.textContent = t("type"); }
    if(items[3]){ const b = items[3].querySelector("button"); if(b) b.textContent = t("changePin"); }
    if(items[4]){ const b = items[4].querySelector("button"); if(b) b.textContent = t("myInvoices"); }
    if(items[5]){ const b = items[5].querySelector("button"); if(b) b.textContent = t("logout"); }
    const pt = document.getElementById("profileType");
    if(pt && !pt.dataset.raw) pt.textContent = pt.textContent;
    const profileTogglePin = document.getElementById("profileTogglePin");
    if(profileTogglePin){
      const el = document.getElementById("profilePin");
      if(el) profileTogglePin.textContent = el.textContent === "****" ? t("show") : t("hide");
    }
  }

  document.querySelectorAll(".cat-label[data-i18n-cat]").forEach(el => {
    el.textContent = catLabel(el.getAttribute("data-i18n-cat"));
  });

  applyMenuLang();
}
