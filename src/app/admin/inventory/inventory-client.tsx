"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProductsTable } from "./products-table";
import { ProductDialog } from "./product-dialog";
import { DeleteProductDialog } from "./delete-product-dialog";
import { CSVImportDialog } from "./csv-import-dialog";
import { RestockDialog } from "./restock-dialog";
import { AdjustStockDialog } from "./adjust-stock-dialog";
import { StockHistoryView } from "./stock-history-view";
import { BarcodeModal } from "@/components/inventory/barcode-modal";
import { printBarcodesInPopup } from "@/lib/print-utils";
import { DynamicBreadcrumb } from "@/components/layout/dynamic-breadcrumb";

export interface ProductData {
  product_id: number;
  product_name: string;
  category: string;
  retail_price: number;
  wholesale_price: number;
  cost_price: number;
  current_stock: number;
  reorder_level: number;
  barcode: string | null;
  image_url: string | null;
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
}

interface InventoryClientProps {
  initialProducts: ProductData[];
}

export function InventoryClient({ initialProducts }: InventoryClientProps) {
  const router = useRouter();
  const [products, setProducts] = useState<ProductData[]>(initialProducts);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [barcodeProducts, setBarcodeProducts] = useState<ProductData[]>([]);
  const [editingProduct, setEditingProduct] = useState<ProductData | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ProductData | null>(null);
  
  // Stock management dialogs
  const [restockingProduct, setRestockingProduct] = useState<ProductData | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<ProductData | null>(null);
  const [historyProduct, setHistoryProduct] = useState<ProductData | null>(null);

  // Sync products state when initialProducts changes (after router.refresh())
  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  const handleProductCreated = (newProduct: ProductData) => {
    setProducts((prev) => [...prev, newProduct].sort((a, b) => 
      a.product_name.localeCompare(b.product_name)
    ));
  };

  const handleProductUpdated = (updatedProduct: ProductData) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.product_id === updatedProduct.product_id ? updatedProduct : p
      )
    );
  };

  const handleProductDeleted = (productId: number) => {
    setProducts((prev) => prev.filter((p) => p.product_id !== productId));
  };

  const handleBulkDeleted = (productIds: number[]) => {
    setProducts((prev) => prev.filter((p) => !productIds.includes(p.product_id)));
  };

  const handleImportSuccess = () => {
    // Refresh the page to get updated product list
    router.refresh();
  };

  // Handler for stock updates after restock/adjust operations
  const handleStockUpdated = (productId: number, newStock: number) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.product_id === productId) {
          const status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" = 
            newStock === 0 
              ? "OUT_OF_STOCK" 
              : newStock <= p.reorder_level 
                ? "LOW_STOCK" 
                : "IN_STOCK";
          return { ...p, current_stock: newStock, status };
        }
        return p;
      })
    );
  };

  // Print handler using popup window approach
  const handlePrint = () => {
    printBarcodesInPopup(barcodeProducts);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      

      <div className="flex-1 flex flex-col min-h-0">
        {/* Products Table */}
        <ProductsTable
          onImportClick={() => setIsImportDialogOpen(true)}
          onAddClick={() => setIsAddDialogOpen(true)}
          products={products}
          onEdit={setEditingProduct}
          onDelete={setDeletingProduct}
          onBulkDelete={handleBulkDeleted}
          onRestock={setRestockingProduct}
          onAdjust={setAdjustingProduct}
          onViewHistory={setHistoryProduct}
          onPrintBarcodes={(selectedProducts) => {
            setBarcodeProducts(selectedProducts);
            setIsBarcodeModalOpen(true);
          }}
        />

        {/* Add Product Dialog */}
        <ProductDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          onSuccess={handleProductCreated}
        />

        {/* Edit Product Dialog */}
        <ProductDialog
          open={!!editingProduct}
          onOpenChange={(open) => !open && setEditingProduct(null)}
          product={editingProduct}
          onSuccess={handleProductUpdated}
        />

        {/* Delete Confirmation Dialog */}
        <DeleteProductDialog
          open={!!deletingProduct}
          onOpenChange={(open) => !open && setDeletingProduct(null)}
          product={deletingProduct}
          onSuccess={() => deletingProduct && handleProductDeleted(deletingProduct.product_id)}
        />

        {/* CSV Import Dialog */}
        <CSVImportDialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          onSuccess={handleImportSuccess}
        />

        {/* Stock Management Dialogs */}
        <RestockDialog
          open={!!restockingProduct}
          onOpenChange={(open) => !open && setRestockingProduct(null)}
          product={restockingProduct}
          onSuccess={(newStock) => {
            if (restockingProduct) {
              handleStockUpdated(restockingProduct.product_id, newStock);
            }
          }}
        />

        <AdjustStockDialog
          open={!!adjustingProduct}
          onOpenChange={(open) => !open && setAdjustingProduct(null)}
          product={adjustingProduct}
          onSuccess={(newStock) => {
            if (adjustingProduct) {
              handleStockUpdated(adjustingProduct.product_id, newStock);
            }
          }}
        />

        <StockHistoryView
          open={!!historyProduct}
          onOpenChange={(open) => !open && setHistoryProduct(null)}
          product={historyProduct}
        />

        {/* Barcode Print Modal - Preview for user */}
        <BarcodeModal
          open={isBarcodeModalOpen}
          onClose={() => setIsBarcodeModalOpen(false)}
          products={barcodeProducts}
          onPrint={handlePrint}
        />
      </div>
    </div>
  );
}
