/**
 * Popup Window Printing Utility
 * Opens a new browser window with clean HTML and triggers print
 */

interface BarcodeItem {
  product_id: number;
  product_name: string;
  barcode: string | null;
  retail_price: number;
}

/**
 * Generates HTML for a single barcode label
 */
function generateBarcodeLabel(item: BarcodeItem, storeName: string): string {
  if (!item.barcode) return "";
  
  // Using JsBarcode CDN for rendering in the popup
  return `
    <div style="
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      background: #ffffff;
      page-break-inside: avoid;
    ">
      <p style="
        font-size: 10px;
        color: #6b7280;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin: 0 0 4px 0;
      ">${storeName}</p>
      
      <svg class="barcode" data-barcode="${item.barcode}"></svg>
      
      <p style="
        font-size: 18px;
        font-weight: 700;
        color: #000000;
        font-family: monospace;
        margin: 4px 0 0 0;
      ">₱${item.retail_price.toFixed(2)}</p>
      
      <p style="
        font-size: 9px;
        color: #4b5563;
        line-height: 1.3;
        margin: 4px 0 0 0;
        max-height: 2.6em;
        overflow: hidden;
      ">${item.product_name}</p>
    </div>
  `;
}

/**
 * Opens a popup window and prints barcode labels
 */
export function printBarcodesInPopup(
  items: BarcodeItem[],
  storeName: string = "Christian Minimart"
): void {
  const itemsWithBarcodes = items.filter((item) => item.barcode);
  
  if (itemsWithBarcodes.length === 0) {
    alert("No products with barcodes to print.");
    return;
  }

  // Generate all label HTML
  const labelsHtml = itemsWithBarcodes
    .map((item) => generateBarcodeLabel(item, storeName))
    .join("");

  // Open popup window
  const printWindow = window.open("", "_blank", "width=900,height=700");
  
  if (!printWindow) {
    alert("Please allow popups to print barcodes.");
    return;
  }

  // Write the complete HTML document
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print Barcodes - ${storeName}</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #ffffff;
            color: #000000;
            padding: 16px;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
          }
          @media print {
            @page {
              size: A4;
              margin: 10mm;
            }
            body {
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="grid">
          ${labelsHtml}
        </div>
        <script>
          // Wait for JsBarcode to load, then render all barcodes
          window.onload = function() {
            document.querySelectorAll('.barcode').forEach(function(svg) {
              var code = svg.getAttribute('data-barcode');
              if (code) {
                JsBarcode(svg, code, {
                  width: 1.2,
                  height: 40,
                  fontSize: 10,
                  margin: 0,
                  displayValue: true,
                  lineColor: '#000000',
                  background: '#ffffff'
                });
              }
            });
            // Small delay to ensure barcodes are rendered before print
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
}
