'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import SalesAPI, { Item, SaleData, BulkSaleData } from '@/lib/SalesAPI';
import { useAuth } from '../context/AuthContext';
import BarcodeScanner from '../components/BarcodeScanner';

interface OrderEntry {
  category: string;
  brand: string;
  size: string;
  color: string;
  quantity: number;
  items: Item[];
}

// Helper function to get local date in YYYY-MM-DD format
function getLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function RecordSaleContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [quantity, setQuantity] = useState<number | ''>(1);

  // Order
  const [order, setOrder] = useState<OrderEntry[]>([]);
  const [checkoutMode, setCheckoutMode] = useState(false);

  const [formData, setFormData] = useState<SaleData>({
    itemId: '',
    salePrice: 0,
    dateSold: '',
    soldBy: '',
    buyer: '',
    platform: 'In Person',
    shippingStatus: 'Delivered',
    paymentMethod: 'Cash',
    trackingNumber: '',
    notes: '',
  });
  
  const [cashRecipient, setCashRecipient] = useState("Zach");
  const [zelleRecipient, setZelleRecipient] = useState("Zach's parents");
  const [appleCashRecipient, setAppleCashRecipient] = useState("Zach");
  const [showOrderCost, setShowOrderCost] = useState(false);
  const [showItemCost, setShowItemCost] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  useEffect(() => {
    // Set the date on client-side only to avoid hydration mismatch
    setFormData(prev => ({
      ...prev,
      dateSold: getLocalDateString()
    }));
    loadItems();
  }, []);

  // Auto-populate soldBy when user signs in
  useEffect(() => {
    if (user && (user.name === 'Zach' || user.name === 'Adi')) {
      setFormData(prev => ({
        ...prev,
        soldBy: user.name
      }));
    }
  }, [user]);

  const loadItems = async () => {
    setLoading(true);
    setError(null);

    try {
      const itemsData = await SalesAPI.getInStockItems();
      setItems(itemsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  // Pre-fill filters from URL params (from inventory summary)
  useEffect(() => {
    if (items.length === 0) return; // Wait for items to load

    const category = searchParams.get('category');
    const brand = searchParams.get('brand');
    const size = searchParams.get('size');
    const color = searchParams.get('color');

    if (category) setSelectedCategory(category);
    if (brand) setSelectedBrand(brand);
    if (size) setSelectedSize(size);
    if (color) setSelectedColor(color);
  }, [items, searchParams]);

  // Get filtered items based on current selections
  const getFilteredItems = () => {
    return items.filter((item) => {
      if (selectedCategory && item.category !== selectedCategory) return false;
      if (selectedBrand && item.brand !== selectedBrand) return false;
      if (selectedSize && item.size !== selectedSize) return false;
      if (selectedColor && item.color !== selectedColor) return false;
      return true;
    });
  };

  // Get unique values with counts for a given field
  const getOptionsWithCounts = (field: keyof Item, currentItems: Item[]) => {
    const counts = new Map<string, number>();
    currentItems.forEach((item) => {
      const value = String(item[field]);
      counts.set(value, (counts.get(value) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value));
  };

  // Get available categories
  const getAvailableCategories = () => {
    return getOptionsWithCounts('category', items);
  };

  // Get available brands based on selected category
  const getAvailableBrands = () => {
    if (!selectedCategory) return [];
    const filtered = items.filter((item) => item.category === selectedCategory);
    return getOptionsWithCounts('brand', filtered);
  };

  // Get available sizes based on selected category and brand
  const getAvailableSizes = () => {
    if (!selectedCategory || !selectedBrand) return [];
    const filtered = items.filter(
      (item) => item.category === selectedCategory && item.brand === selectedBrand
    );
    return getOptionsWithCounts('size', filtered);
  };

  // Get available colors based on selected category, brand, and size
  const getAvailableColors = () => {
    if (!selectedCategory || !selectedBrand || !selectedSize) return [];
    const filtered = items.filter(
      (item) =>
        item.category === selectedCategory &&
        item.brand === selectedBrand &&
        item.size === selectedSize
    );
    return getOptionsWithCounts('color', filtered);
  };

  // Auto-select item when all filters are chosen
  useEffect(() => {
    if (selectedCategory && selectedBrand && selectedSize && selectedColor) {
      const matches = items.filter(
        (item) =>
          item.category === selectedCategory &&
          item.brand === selectedBrand &&
          item.size === selectedSize &&
          item.color === selectedColor
      );

      if (matches.length > 0) {
        const item = matches[0];
        setSelectedItem(item);
        setFormData((prev) => ({ ...prev, itemId: item.itemId }));
      } else {
        setSelectedItem(null);
        setFormData((prev) => ({ ...prev, itemId: '' }));
      }
    } else {
      setSelectedItem(null);
      setFormData((prev) => ({ ...prev, itemId: '' }));
    }
  }, [selectedCategory, selectedBrand, selectedSize, selectedColor, items]);

  // Auto-select when only one option is available
  useEffect(() => {
    if (items.length === 0) return;

    // Auto-select category if only one
    const categories = getAvailableCategories();
    if (categories.length === 1 && !selectedCategory) {
      setSelectedCategory(categories[0].value);
    }
  }, [items]);

  useEffect(() => {
    if (!selectedCategory) return;
    const brands = getAvailableBrands();
    if (brands.length === 1 && !selectedBrand) {
      setSelectedBrand(brands[0].value);
    }
  }, [selectedCategory, items]);

  useEffect(() => {
    if (!selectedBrand) return;
    const sizes = getAvailableSizes();
    if (sizes.length === 1 && !selectedSize) {
      setSelectedSize(sizes[0].value);
    }
  }, [selectedBrand, items]);

  useEffect(() => {
    if (!selectedSize) return;
    const colors = getAvailableColors();
    if (colors.length === 1 && !selectedColor) {
      setSelectedColor(colors[0].value);
    }
  }, [selectedSize, items]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    
    // If platform is changed to "In Person", automatically set shipping status to "Delivered"
    if (name === 'platform' && value === 'In Person') {
      setFormData((prev) => ({
        ...prev,
        platform: value,
        shippingStatus: 'Delivered',
      }));
    } else if (name === 'paymentMethod' && value !== 'Zelle') {
      // If payment method changes away from Zelle, reset Zelle recipient
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: name === 'salePrice' ? parseFloat(value) || 0 : value,
      }));
    }
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setSelectedBrand('');
    setSelectedSize('');
    setSelectedColor('');
  };

  const handleBrandChange = (value: string) => {
    setSelectedBrand(value);
    setSelectedSize('');
    setSelectedColor('');
  };

  const handleSizeChange = (value: string) => {
    setSelectedSize(value);
    setSelectedColor('');
  };

  const handleAddToOrder = () => {
    const matches = getMatchingItems();

    if (matches.length === 0) {
      setError('No matching items in inventory');
      return;
    }

    const qty = quantity === '' ? 1 : quantity;

    if (qty > matches.length) {
      setError(`Only ${matches.length} items available in stock!`);
      return;
    }

    // Get the specific items to add
    const itemsToAdd = matches.slice(0, qty);

    // Add to order
    const orderEntry: OrderEntry = {
      category: selectedCategory,
      brand: selectedBrand,
      size: selectedSize,
      color: selectedColor,
      quantity: qty,
      items: itemsToAdd,
    };

    setOrder((prev) => [...prev, orderEntry]);

    // Remove sold items from available items
    const itemIdsToRemove = itemsToAdd.map((item) => item.itemId);
    setItems((prev) => prev.filter((item) => !itemIdsToRemove.includes(item.itemId)));

    // Reset selection
    setSelectedCategory('');
    setSelectedBrand('');
    setSelectedSize('');
    setSelectedColor('');
    setSelectedItem(null);
    setQuantity(1);

    setError(null);
  };

  const handleRemoveFromOrder = (index: number) => {
    const entry = order[index];

    // Add items back to inventory
    setItems((prev) => [...prev, ...entry.items]);

    // Remove from order
    const newOrder = order.filter((_, i) => i !== index);
    setOrder(newOrder);

    // If order is now empty, exit checkout mode
    if (newOrder.length === 0) {
      setCheckoutMode(false);
    }
  };

  const handleClearOrder = () => {
    if (order.length === 0) return;

    if (!confirm('Clear all items from order?')) return;

    // Add all items back to inventory
    order.forEach((entry) => {
      setItems((prev) => [...prev, ...entry.items]);
    });

    setOrder([]);
    setCheckoutMode(false);
  };

  const handleBarcodeScan = (barcode: string) => {
    console.log('Scanned barcode:', barcode);
    
    // Look up item by UPC (case-insensitive comparison)
    const matchedItem = items.find(item => 
      item.upc.toLowerCase() === barcode.toLowerCase()
    );
    
    if (matchedItem) {
      // Auto-populate filters with the matched item's details
      setSelectedCategory(matchedItem.category);
      setSelectedBrand(matchedItem.brand);
      setSelectedSize(matchedItem.size);
      setSelectedColor(matchedItem.color);
      setQuantity(1);
      
      // Clear any errors
      setError(null);
      
      console.log(`✓ Found: ${matchedItem.category} ${matchedItem.brand} - ${matchedItem.size} - ${matchedItem.color}`);
    } else {
      setError(`No item found with UPC: ${barcode}. Please check your inventory or enter manually.`);
      console.warn(`UPC not found: ${barcode}`);
      console.log('Available UPCs:', items.map(i => i.upc).join(', '));
    }
  };

  const getMatchingItems = () => {
    if (!selectedCategory || !selectedBrand || !selectedSize || !selectedColor) return [];
    return items.filter(
      (item) =>
        item.category === selectedCategory &&
        item.brand === selectedBrand &&
        item.size === selectedSize &&
        item.color === selectedColor
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (order.length === 0) {
      setError('Order is empty!');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      // Flatten order into array of item IDs
      const itemIds: string[] = [];
      order.forEach((entry) => {
        entry.items.forEach((item) => {
          itemIds.push(item.itemId);
        });
      });

      // Determine final payment method (combine Cash/Zelle/Apple Cash with recipient if needed)
      let finalPaymentMethod = formData.paymentMethod;
      if (formData.paymentMethod === 'Cash') {
        finalPaymentMethod = `Cash (${cashRecipient})`;
      } else if (formData.paymentMethod === 'Zelle') {
        finalPaymentMethod = `Zelle (${zelleRecipient})`;
      } else if (formData.paymentMethod === 'Apple Cash') {
        finalPaymentMethod = `Apple Cash (${appleCashRecipient})`;
      }

      // Use single sale API for 1 item, bulk sale API for multiple
      if (itemIds.length === 1) {
        const singleSaleData: SaleData = {
          itemId: itemIds[0],
          salePrice: formData.salePrice,
          dateSold: formData.dateSold,
          soldBy: formData.soldBy,
          buyer: formData.buyer,
          platform: formData.platform,
          shippingStatus: formData.shippingStatus,
          paymentMethod: finalPaymentMethod,
          trackingNumber: formData.trackingNumber,
          notes: formData.notes,
        };
        await SalesAPI.recordSale(singleSaleData);
      } else {
        const bulkSaleData: BulkSaleData = {
          salePrice: formData.salePrice,
          dateSold: formData.dateSold,
          soldBy: formData.soldBy,
          buyer: formData.buyer || '',
          platform: formData.platform,
          shippingStatus: formData.shippingStatus,
          paymentMethod: finalPaymentMethod,
          trackingNumber: formData.trackingNumber,
          notes: formData.notes,
          items: itemIds,
        };
        await SalesAPI.recordBulkSale(bulkSaleData);
      }

      setSuccess(true);

      // Reset form but keep seller name
      const soldBy = formData.soldBy;
      setFormData({
        itemId: '',
        salePrice: 0,
        dateSold: getLocalDateString(),
        soldBy,
        buyer: '',
        platform: 'In Person',
        shippingStatus: 'Delivered',
        paymentMethod: 'Cash',
        trackingNumber: '',
        notes: '',
      });

      // Clear order
      setOrder([]);
      setCheckoutMode(false);

      // Reload items
      await loadItems();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record sale');
    } finally {
      setSubmitting(false);
    }
  };

  const matchingItemsCount = getFilteredItems().length;
  const totalOrderItems = order.reduce((sum, entry) => sum + entry.quantity, 0);
  const totalOrderCost = order.reduce((sum, entry) => {
    return sum + entry.items.reduce((itemSum, item) => itemSum + item.cost, 0);
  }, 0);
  const matchingItems = getMatchingItems();
  const canAddToOrder =
    selectedCategory && selectedBrand && selectedSize && selectedColor && matchingItems.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-4">
      <div className="container mx-auto px-4 max-w-4xl relative">
        {/* Header */}
        <div className="relative flex items-center justify-center mb-4">
          <Link
            href="/"
            className="absolute left-0 flex items-center justify-center w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
            title="Back"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Sell
          </h1>
        </div>

        {/* Error Message */}
        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 mb-3 flex items-start gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="text-sm text-green-600 dark:text-green-400 mb-3 flex items-start gap-2">
            <span>✓</span>
            <span>Sale recorded successfully!</span>
          </div>
        )}

        {/* Order */}
        {order.length > 0 && (
          <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-3 mb-4 ${checkoutMode ? 'pb-2' : ''}`}>
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Order
              </h2>
              <div className="flex items-center gap-2">
                {showOrderCost && (
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Cost: ${totalOrderCost.toFixed(2)}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowOrderCost(!showOrderCost)}
                  className="text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white py-1 px-1 transition-colors"
                  title={showOrderCost ? "Hide cost" : "Show cost"}
                >
                  {showOrderCost ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div className={`space-y-1 ${checkoutMode ? '' : 'mb-2'}`}>
              {order.map((entry, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <div className="flex-1 text-sm">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {entry.category} {entry.brand} ×{entry.quantity}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Size: {entry.size} | Color: {entry.color}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFromOrder(index)}
                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-xs ml-2"
                    disabled={submitting}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {/* Checkout button when not in checkout mode */}
            {!checkoutMode && (
              <button
                type="button"
                onClick={() => setCheckoutMode(true)}
                disabled={submitting}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Checkout
              </button>
            )}
          </div>
        )}

        {/* Item Selection Form - Hide when in checkout mode */}
        {!checkoutMode && (
          <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
            {/* Filter Section - Progressive Disclosure */}
            <div className="mb-4">
            <div className="grid gap-3">
              {/* Category - Always shown first */}
              <div>
                {loading ? (
                  <div className="w-full px-3 py-1.5 flex items-center justify-center">
                    <svg
                      className="animate-spin h-5 w-5 text-gray-600 dark:text-gray-400"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading items...</span>
                  </div>
                ) : (
                  <>
                    {/* Category buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      {getAvailableCategories().map(({ value, count }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleCategoryChange(value)}
                          disabled={submitting}
                          className={`px-4 py-2 rounded font-medium transition-colors ${
                            selectedCategory === value
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {value} ({count})
                        </button>
                      ))}
                    </div>
                    
                    {/* Only show Scan button when Add to Order button is not visible */}
                    {!selectedColor && (
                      <>
                        {/* Divider */}
                        <div className="flex items-center gap-3 my-3">
                          <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
                          <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">or</span>
                          <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
                        </div>
                        
                        {/* Centered Scan button */}
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => setIsScannerOpen(true)}
                            disabled={submitting}
                            className="px-6 py-2 rounded font-medium transition-colors bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                            Scan Barcode
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Brand - Show only after Category is selected */}
              {selectedCategory && (
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="filterBrand"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap w-20"
                  >
                    Brand
                  </label>
                  <select
                    id="filterBrand"
                    value={selectedBrand}
                    onChange={(e) => handleBrandChange(e.target.value)}
                    required
                    disabled={submitting}
                    className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  >
                    <option value="">Choose brand...</option>
                    {getAvailableBrands().map(({ value, count }) => (
                      <option key={value} value={value}>
                        {value} ({count})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Size - Show only after Brand is selected */}
              {selectedBrand && (
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="filterSize"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap w-20"
                  >
                    Size
                  </label>
                  <select
                    id="filterSize"
                    value={selectedSize}
                    onChange={(e) => handleSizeChange(e.target.value)}
                    required
                    disabled={submitting}
                    className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  >
                    <option value="">Choose size...</option>
                    {getAvailableSizes().map(({ value, count }) => (
                      <option key={value} value={value}>
                        {value} ({count})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Color - Show only after Size is selected */}
              {selectedSize && (
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="filterColor"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap w-20"
                  >
                    Color
                  </label>
                  <select
                    id="filterColor"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    required
                    disabled={submitting}
                    className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  >
                    <option value="">Choose color...</option>
                    {getAvailableColors().map(({ value, count }) => (
                      <option key={value} value={value}>
                        {value} ({count})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quantity - Show only after Color is selected */}
              {selectedColor && (
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="quantity"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap w-20"
                  >
                    Quantity
                  </label>
                  <div className="flex flex-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setQuantity((prev) => Math.max(1, (prev === '' ? 1 : prev) - 1))}
                      disabled={!canAddToOrder || (quantity !== '' && quantity <= 1)}
                      className="w-10 h-10 flex items-center justify-center bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-bold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Decrease quantity"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      id="quantity"
                      value={quantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          setQuantity('');
                        } else {
                          const num = parseInt(val);
                          if (!isNaN(num)) {
                            setQuantity(Math.max(1, num));
                          }
                        }
                      }}
                      onBlur={() => {
                        // Ensure minimum value on blur
                        if (quantity === '' || quantity < 1) {
                          setQuantity(1);
                        }
                      }}
                      min="1"
                      max={matchingItems.length || 1}
                      disabled={!canAddToOrder}
                      className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 text-center"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity((prev) => Math.min(matchingItems.length || 1, (prev === '' ? 1 : prev) + 1))}
                      disabled={!canAddToOrder || (quantity !== '' && quantity >= (matchingItems.length || 1))}
                      className="w-10 h-10 flex items-center justify-center bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-bold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Matching Items Info */}
          {selectedItem && (
            <div className="mb-3 text-sm">
              <div className="font-medium text-green-600 dark:text-green-400">
                Item available
                {matchingItemsCount > 1 && (
                  <span className="text-xs ml-2 text-gray-500 dark:text-gray-400">
                    ({matchingItemsCount} available)
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                {showItemCost && (
                  <span>Cost: ${selectedItem.cost.toFixed(2)} • </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowItemCost(!showItemCost)}
                  className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors mr-2"
                  title={showItemCost ? "Hide cost" : "Show cost"}
                >
                  {showItemCost ? '👁️' : '👁️‍🗨️'}
                </button>
                <span>Location: {selectedItem.location}</span>
              </div>
            </div>
          )}

          {/* No matching items warning */}
          {selectedCategory && selectedBrand && selectedSize && selectedColor && !selectedItem && (
            <div className="mb-3 text-sm text-red-600 dark:text-red-400 border-l-2 border-red-500 pl-3">
              ⚠️ No items match these filters. Please adjust your selection.
            </div>
          )}

          {/* Add to Order Button - Only show after quantity field appears */}
          {selectedColor && (
            <button
              type="button"
              onClick={handleAddToOrder}
              disabled={!canAddToOrder}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ➕ Add to Order
            </button>
          )}
          </form>
        )}

        {/* Sale Details Form - Show when in checkout mode */}
        {order.length > 0 && checkoutMode && (
          <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"
          >
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Sale Details
              </h2>
              <button
                type="button"
                onClick={() => setCheckoutMode(false)}
                disabled={submitting}
                className="text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium py-1 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add items
              </button>
            </div>

          {/* Sale Price */}
          <div className="mb-3 flex items-center gap-3">
            <label
              htmlFor="salePrice"
              className="text-sm font-medium text-gray-700 dark:text-gray-300 w-16 flex-shrink-0"
            >
              $
            </label>
            <input
              type="number"
              id="salePrice"
              name="salePrice"
              value={formData.salePrice || ''}
              onChange={handleInputChange}
              step="0.01"
              min="0"
              required
              disabled={submitting}
              placeholder="150.00"
              className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
            />
          </div>

          {/* Payment Method */}
          <div className="mb-3 flex items-center gap-3">
            <label
              htmlFor="paymentMethod"
              className="text-sm font-medium text-gray-700 dark:text-gray-300 w-16 flex-shrink-0"
            >
              Via
            </label>
            <select
              id="paymentMethod"
              name="paymentMethod"
              value={formData.paymentMethod}
              onChange={handleInputChange}
              required
              disabled={submitting}
              className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
            >
              <option value="Cash">Cash</option>
              <option value="Zelle">Zelle</option>
              <option value="Apple Cash">Apple Cash</option>
              <option value="Depop">Depop</option>
            </select>
          </div>

          {/* Cash Recipient - Show only when Cash is selected */}
          {formData.paymentMethod === 'Cash' && (
            <div className="mb-3 flex items-center gap-3">
              <label
                htmlFor="cashRecipient"
                className="text-sm font-medium text-gray-700 dark:text-gray-300 w-16 flex-shrink-0"
              >
                To
              </label>
              <select
                id="cashRecipient"
                value={cashRecipient}
                onChange={(e) => setCashRecipient(e.target.value)}
                required
                disabled={submitting}
                className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              >
                <option value="Zach">Zach</option>
                <option value="Adi">Adi</option>
              </select>
            </div>
          )}

          {/* Zelle Recipient - Show only when Zelle is selected */}
          {formData.paymentMethod === 'Zelle' && (
            <div className="mb-3 flex items-center gap-3">
              <label
                htmlFor="zelleRecipient"
                className="text-sm font-medium text-gray-700 dark:text-gray-300 w-16 flex-shrink-0"
              >
                To
              </label>
              <select
                id="zelleRecipient"
                value={zelleRecipient}
                onChange={(e) => setZelleRecipient(e.target.value)}
                required
                disabled={submitting}
                className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              >
                <option value="Zach's parents">Zach's parents</option>
                <option value="Zach's Wells Fargo account">Zach (WF)</option>
              </select>
            </div>
          )}

          {/* Apple Cash Recipient - Show only when Apple Cash is selected */}
          {formData.paymentMethod === 'Apple Cash' && (
            <div className="mb-3 flex items-center gap-3">
              <label
                htmlFor="appleCashRecipient"
                className="text-sm font-medium text-gray-700 dark:text-gray-300 w-16 flex-shrink-0"
              >
                To
              </label>
              <select
                id="appleCashRecipient"
                value={appleCashRecipient}
                onChange={(e) => setAppleCashRecipient(e.target.value)}
                required
                disabled={submitting}
                className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              >
                <option value="Zach">Zach</option>
                <option value="Nicole">Nicole</option>
              </select>
            </div>
          )}

          {/* Platform */}
          <div className="mb-3 flex items-center gap-3">
            <label
              htmlFor="platform"
              className="text-sm font-medium text-gray-700 dark:text-gray-300 w-16 flex-shrink-0"
            >
              Platform
            </label>
            <select
              id="platform"
              name="platform"
              value={formData.platform}
              onChange={handleInputChange}
              required
              disabled={submitting}
              className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
            >
              <option value="In Person">In Person</option>
              <option value="eBay">eBay</option>
              <option value="Instagram">Instagram</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Buyer */}
          <div className="mb-3 flex items-center gap-3">
            <label
              htmlFor="buyer"
              className="text-sm font-medium text-gray-700 dark:text-gray-300 w-16 flex-shrink-0"
            >
              Buyer
            </label>
            <input
              type="text"
              id="buyer"
              name="buyer"
              value={formData.buyer}
              onChange={handleInputChange}
              required
              disabled={submitting}
              placeholder="Name"
              className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
            />
          </div>

          {/* Notes */}
          <div className="mb-3 flex items-start gap-3">
            <label
              htmlFor="notes"
              className="text-sm font-medium text-gray-700 dark:text-gray-300 w-16 flex-shrink-0 pt-1.5"
            >
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              disabled={submitting}
              rows={2}
              placeholder="Misc. notes (optional)"
              className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClearOrder}
              disabled={submitting}
              className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
          </form>
        )}

        {/* Barcode Scanner Modal */}
        <BarcodeScanner
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScan={handleBarcodeScan}
        />
      </div>
    </div>
  );
}

export default function RecordSale() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RecordSaleContent />
    </Suspense>
  );
}
