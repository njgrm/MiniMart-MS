"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProductsTable } from "./products-table";
import { ProductDialog } from "./product-dialog";
import { DeleteProductDialog } from "./delete-product-dialog";
import { CSVImportDialog } from "./csv-import-dialog";
import { DynamicBreadcrumb } from "@/components/layout/dynamic-breadcrumb";

export interface ProductData {
  product_id: number;
  product_name: string;
  category: string;
  retail_price: number;
  wholesale_price: number;
  current_stock: number;
  reorder_level: number;
  barcode: string | null;
  image_url: string | null;
  status: "IN_STOCK" | "LOW_STOCK";
}

interface InventoryClientProps {
  initialProducts: ProductData[];
}

export function InventoryClient({ initialProducts }: InventoryClientProps) {
  const router = useRouter();
  const [products, setProducts] = useState<ProductData[]>(initialProducts);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductData | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ProductData | null>(null);

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
      </div>
    </div>
  );
}
