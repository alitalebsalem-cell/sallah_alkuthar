const COLUMNS = 3;
const A4_W = 210;
const A4_H = 297;

function escapeHTML(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function waitForImages(container) {
  return Promise.all(Array.from(container.querySelectorAll("img")).map(img =>
    new Promise(resolve => {
      if (img.complete) { resolve(); return; }
      img.onload = resolve;
      img.onerror = resolve;
      setTimeout(resolve, 2000);
    })
  ));
}

function populateTemplate(invoiceData) {
  const invNo = (invoiceData.invoiceNo || "").replace("INV-", "");
  const branchName = invoiceData.branchName || "";
  const customerName = invoiceData.customerName || "Direct Customer";

  let dateStr = "";
  const rawDate = invoiceData.createdAt || invoiceData.date || "";
  if (rawDate) {
    if (typeof rawDate === "string") dateStr = rawDate.split("T")[0];
    else if (rawDate.toDate) dateStr = rawDate.toDate().toLocaleDateString("en-CA");
    else dateStr = String(rawDate);
  }

  const noEl = document.getElementById("invoiceNo");
  const custEl = document.getElementById("invoiceCustomer");
  const dateEl = document.getElementById("invoiceDate");
  const recvEl = document.getElementById("invRecvBranch");
  if (noEl) noEl.textContent = invNo;
  if (custEl) custEl.textContent = customerName;
  if (dateEl) dateEl.textContent = dateStr;
  if (recvEl){
    const parts = branchName.split(" - ");
    let formattedBranch = branchName;
    if(parts.length === 2){
      formattedBranch = parts[1] + " - " + parts[0];
    }
    recvEl.textContent = formattedBranch;
  }
}

function getItemDetails(item) {
  const details = [];
  if (item.description) details.push(escapeHTML(item.description));
  return details.join(" | ");
}

function renderProductRows(items) {
  const tbody = document.getElementById("invoiceProducts");
  if (!tbody) return;
  tbody.innerHTML = "";
  for (let i = 0; i < items.length; i += COLUMNS) {
    const row = items.slice(i, i + COLUMNS);
    let html = "<tr>";
    row.forEach(it => {
      const description = it.description ? escapeHTML(it.description) : "";
      html += '<td class="invoice-check-cell" style="text-align:center;"><span class="invoice-check-box" style="display:inline-block;width:14px;height:14px;border:1.5px solid #111;background:white;"></span></td>';
      html += '<td class="invoice-product-cell" style="text-align:right;overflow:hidden;"><div class="invoice-product-main" style="display:grid;grid-template-columns:28px minmax(0,1fr);align-items:center;gap:5px;line-height:1.2;">';
      html += '<span class="invoice-product-qty" style="display:inline-flex;align-items:center;justify-content:center;width:24px;min-width:24px;height:24px;border:1.5px solid #555;border-radius:2px;background:#fff;font-size:11px;font-weight:900;color:#111;">' + (it.qty || 0) + '</span>';
      html += '<strong style="font-size:12px;font-weight:800;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><bdi>' + escapeHTML(it.name || "") + '</bdi></strong></div>';
      if (description) html += '<div class="invoice-product-details" style="padding-right:80px;font-size:11px;color:#000000;margin-top:2px;direction:ltr;">' + description + '</div>';
      html += '</td>';
    });
    for (let e = row.length; e < COLUMNS; e++) {
      html += '<td class="invoice-check-cell"></td><td class="invoice-product-cell"></td>';
    }
    html += "</tr>";
    tbody.insertAdjacentHTML("beforeend", html);
  }
}

function setFooterVisible(visible) {
  const template = document.getElementById("invoiceTemplate");
  if (!template) return;
  const summary = template.querySelector(".invoice-summary-row");
  const delivery = template.querySelector(".invoice-delivery-info");
  const display = visible ? "" : "none";
  if (summary) summary.style.display = display;
  if (delivery) delivery.style.display = display;
}

function updateTotals(items) {
  const totalEl = document.getElementById("invoiceTotal");
  const qtyEl = document.getElementById("invoiceQty");
  if (totalEl) totalEl.textContent = items.length;
  if (qtyEl) qtyEl.textContent = items.reduce((s, it) => s + (it.qty || 0), 0);
}

async function captureTemplate() {
  const template = document.getElementById("invoiceTemplate");
  if (!template) throw new Error("Template not found");
  await waitForImages(template);
  return html2canvas(template, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    windowWidth: template.scrollWidth,
    windowHeight: template.scrollHeight
  });
}

function canvasToPdfImage(canvas) {
  return {
    data: canvas.toDataURL("image/png"),
    height: Math.min((canvas.height * A4_W) / canvas.width, A4_H)
  };
}

function getFileName(invoiceData) {
  const shortNo = (invoiceData.invoiceNo || "").replace("INV-", "");
  const branch = invoiceData.branchName || "";
  return `${branch || shortNo || "invoice"}.pdf`;
}

export async function generateInvoicePdf(invoiceData) {
  populateTemplate(invoiceData);
  const items = invoiceData.items || [];
  renderProductRows(items);
  updateTotals(items);
  setFooterVisible(true);

  const canvas = await captureTemplate();
  const img = canvasToPdfImage(canvas);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("P", "mm", "A4");
  doc.addImage(img.data, "PNG", 0, 0, A4_W, img.height);

  const fileName = getFileName(invoiceData);
  doc.save(fileName);
}
