const fs = require("fs");
const PDFDocument = require("pdfkit");
const path = require('path');


async function createPaymentInvoice(invoice) {
    return new Promise((resolve, reject) => {
        try {
            let doc = new PDFDocument({ size: "A4", margin: 50 });

            generateHeader(doc);
            generateCustomerInformation(doc, invoice);
            generateProductDetails(doc, invoice);
            generateFooter(doc);

            // Create a buffer to hold the PDF document
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
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
        .image(path.join(__dirname, "logo.png"), { width: 120, height: 40 })
        .fillColor("#444444")
        .fontSize(20)
        .fontSize(10)
        .text("2nd Floor, RSMJ Tower,", 200, 50, { align: "right" })
        .text("Post office,40th A Cross", 200, 50, { align: "right" })
        .text("Road,Near Jayanagar", 200, 50, { align: "right" })
        .text("9th Block, Kottapalya", 200, 50, { align: "right" })
        .text("Bengaluru,Karnataka-560069 ", 200, 80, { align: "right" })
        .text("+91 8310021990", 200, 95, { align: "right" })
        .text("info@sellmycell.in", 200, 110, { align: "right" })
        .moveDown();
}

function generateCustomerInformation(doc, invoice) {
    doc
        .fillColor("#444444")
        .fontSize(20)
        .text("Partner Details", 50, 160);

    generateHr(doc, 185);

    const customerInformationTop = 200;

    doc
        .fontSize(10)
        .font("Helvetica")
        .text("Name:", 50, customerInformationTop + 0)
        .text(invoice.user.name, 150, customerInformationTop + 0)
        .font("Helvetica")
        .text("Address:", 50, customerInformationTop + 20)
        .text(invoice.user.address, 150, customerInformationTop + 20)
        .text("Phone:", 50, customerInformationTop + 40)
        .text(invoice.user.phone, 150, customerInformationTop + 40)
        .text("State:", 50, customerInformationTop + 60)
        .text(invoice.user.state, 150, customerInformationTop + 60)
        .text("GSTIN:", 50, customerInformationTop + 80)
        .text(invoice.user.gstIN, 150, customerInformationTop + 80)
        .text("Company Name:", 50, customerInformationTop + 100)
        .text(invoice.user.companyName, 150, customerInformationTop + 100)


    // generateHr(doc, 252);
}

function generateProductDetails(doc, invoice) {
    const productDetailsTop = 360;

    doc
        .fillColor("#444444")
        .fontSize(15)
        .text("Payment Details", 50, productDetailsTop);

    generateHr(doc, productDetailsTop + 20);

    doc
        .fontSize(10)
        .text("Payment ID:", 50, productDetailsTop + 30)
        .font("Helvetica")
        .text(`${invoice.transaction.paymentId} (${invoice.transaction.message})`, 150, productDetailsTop + 30) // 
        .font("Helvetica")
        .text("Coins Added:", 50, productDetailsTop + 50)
        .text(`${invoice.transaction.coins}`, 150, productDetailsTop + 50)
        .font("Helvetica")
        .text("Price:", 50, productDetailsTop + 70)
        .font("Helvetica")
        .text(`Rs ${invoice.transaction.price}`, 150, productDetailsTop + 70)
        .font("Helvetica")
        .text("GST:", 50, productDetailsTop + 90)
    if (invoice.transaction.HomeState !== invoice.transaction.partnerState) {
        doc.text(`IGST: Rs ${invoice.transaction.gstPrice} (${invoice.transaction.gstPercentage}%)`, 150, productDetailsTop + 90);
    } else {
        // If different, split the GST percentage into half
        const halfGSTPrice = invoice.transaction.gstPrice / 2
        const halfGstPercentage = invoice.transaction.gstPercentage / 2;
        doc.text(`CSGT : Rs ${halfGSTPrice} (${halfGstPercentage}%)`, 150, productDetailsTop + 90);
        doc.text(`SGST : Rs ${halfGSTPrice} (${halfGstPercentage}%) `, 150, productDetailsTop + 110);
    }
    doc
        .font("Helvetica")
        .text("Total:", 50, productDetailsTop + 130)
        .text(`Rs ${invoice.transaction.price + invoice.transaction.gstPrice}`, 150, productDetailsTop + 130)
        .font("Helvetica")
        .font("Helvetica")
        .text("Date:", 50, productDetailsTop + 150)
        .text(`${invoice.transaction.timestamp}`, 150, productDetailsTop + 150)
        .font("Helvetica")



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
    doc
        .strokeColor("#aaaaaa")
        .lineWidth(1)
        .moveTo(50, y)
        .lineTo(550, y)
        .stroke();
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

module.exports = createPaymentInvoice;