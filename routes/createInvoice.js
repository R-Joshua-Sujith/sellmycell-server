const fs = require("fs");
const PDFDocument = require("pdfkit");
const path = require("path");

async function createInvoice(invoice) {
  return new Promise((resolve, reject) => {
    try {
      let doc = new PDFDocument({ size: "A4", margin: 50 });

      generateHeader(doc);
      generateCustomerInformation(doc, invoice);
      generateProductDetails(doc, invoice);
      generatePaymentDetails(doc, invoice);
      generateFooter(doc);

      // Create a buffer to hold the PDF document
      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function generateHeader(doc) {
  doc
    .image(path.join(__dirname, "logo.png"), { width: 140, height: 50 })
    .fillColor("#444444")
    .fontSize(20)
    .fontSize(10)
    .text("2nd Floor, RSMJ Tower,", 200, 50, { align: "right" })
    .text("Post Office, 40th A Cross", 200, 65, { align: "right" })
    .text("Road, Near Jayanagar", 200, 80, { align: "right" })
    .text("9th Block, Kottapalya", 200, 95, { align: "right" })
    .text("Bengaluru, Karnataka-560069", 200, 110, { align: "right" })
    .text("+91 8310021990", 200, 125, { align: "right" })
    .text("info@sellmycell.in", 200, 140, { align: "right" })
    .moveDown();
}

function generateCustomerInformation(doc, invoice) {
  doc.fillColor("#444444").fontSize(20).text("Invoice", 50, 160);

  generateHr(doc, 185);

  const customerInformationTop = 200;

  doc
    .fontSize(10)
    .text("Order ID:", 50, customerInformationTop + 0)
    .font("Helvetica-Bold")
    .text(invoice.orderId, 150, customerInformationTop + 0) //
    .font("Helvetica")
    .text("Customer Name:", 50, customerInformationTop + 20)
    .text(invoice.user.name, 150, customerInformationTop + 20)
    .font("Helvetica")
    .text("Customer Address:", 50, customerInformationTop + 40)
    .text(invoice.user.address, 150, customerInformationTop + 40)
    .text("Customer Phone:", 50, customerInformationTop + 60)
    .text(invoice.user.phone, 150, customerInformationTop + 60);

  // generateHr(doc, 252);
}

function generateProductDetails(doc, invoice) {
  const productDetailsTop = 300;

  doc
    .fillColor("#444444")
    .fontSize(15)
    .text("Product Details", 50, productDetailsTop);

  generateHr(doc, productDetailsTop + 20);

  doc
    .fontSize(10)
    .text("Product Name:", 50, productDetailsTop + 30)
    .font("Helvetica")
    .text(invoice.productDetails.name, 150, productDetailsTop + 30) //
    .font("Helvetica")
    .text("IMEI Number:", 50, productDetailsTop + 50)
    .text(invoice.deviceInfo.imeiNumber, 150, productDetailsTop + 50)
    .font("Helvetica")

    // Assuming price is in cents and needs to be converted to a number
    .moveDown();
}

function generatePaymentDetails(doc, invoice) {
  const productDetailsTop = 390;
  const finalPrice = parseInt(invoice.deviceInfo.finalPrice);
  const promoPrice = invoice?.promo?.price
    ? parseInt(invoice?.promo?.price)
    : 0;
  const devicePrice = finalPrice - promoPrice;

  doc
    .fillColor("#444444")
    .fontSize(15)
    .text("Payment Details", 50, productDetailsTop);

  generateHr(doc, productDetailsTop + 20);

  doc
    .fontSize(10)
    .text("Device Price:", 50, productDetailsTop + 30)
    .font("Helvetica")
    .text(`Rs ${devicePrice}`, 150, productDetailsTop + 30) //
    .text("Promo Price:", 50, productDetailsTop + 50)
    .font("Helvetica")
    .text(
      `${
        invoice?.promo?.price ? `Rs ${invoice?.promo?.price}` : "Not Applicable"
      }`,
      150,
      productDetailsTop + 50
    ) //
    .text("Total Price:", 50, productDetailsTop + 70)
    .font("Helvetica")
    .text(`Rs ${invoice.deviceInfo.finalPrice}`, 150, productDetailsTop + 70) //
    .font("Helvetica-Bold")
    .text("Status:", 50, productDetailsTop + 90)
    .text("Paid", 150, productDetailsTop + 90)
    // Assuming price is in cents and needs to be converted to a number
    .moveDown();
}

function generateFooter(doc) {
  doc
    .fontSize(10)
    .text(
      "THIS IS A COMPUTER - GENERATED DOCUMENT AND DOES NOT REQUIRE A SEAL OR SIGNATURE.",
      50,
      750,
      { align: "center", width: 500 }
    );
}

function generateHr(doc, y) {
  doc.strokeColor("#aaaaaa").lineWidth(1).moveTo(50, y).lineTo(550, y).stroke();
}

function formatCurrency(cents) {
  return "$" + (cents / 100).toFixed(2);
}

function formatDate(date) {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  return year + "/" + month + "/" + day;
}

module.exports = createInvoice;
