'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import SalesAPI, { AddInventoryData, InventoryCategories } from '@/lib/SalesAPI';
import { useAuth } from '../context/AuthContext';
import BarcodeScanner from '../components/BarcodeScanner';

// Helper function to get local date in YYYY-MM-DD format
function getLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function Inventory() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<InventoryCategories | null>(null);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string>('');
  const [lastScanTime, setLastScanTime] = useState<number>(0);
  const keepOptionalFieldsClosedRef = useRef(false);

  const [formData, setFormData] = useState<AddInventoryData>({
    upc: '',
    category: '',
    brand: '',
    size: '',
    color: '',
    cost: 0,
    datePurchased: '',
    location: '',
    notes: '',
    quantity: 1,
  });

  useEffect(() => {
    // Set the date on client-side only to avoid hydration mismatch
    setFormData(prev => {
      // Only set date if not already set to avoid triggering re-renders
      if (!prev.datePurchased) {
        return {
          ...prev,
          datePurchased: getLocalDateString()
        };
      }
      return prev;
    });
    loadCategories();
    loadInventoryItems();
  }, []);

  const loadInventoryItems = async () => {
    try {
      const items = await SalesAPI.getInStockItems();
      setInventoryItems(items);
    } catch (err) {
      console.warn('Failed to load inventory items for barcode lookup:', err);
    }
  };

  const loadCategories = async () => {
    setLoading(true);
    setError(null);

    try {
      const categoriesData = await SalesAPI.getInventoryCategories();
      setCategories(categoriesData);
    } catch (err) {
      // Silently fail for categories - not critical for form submission
      console.warn('Failed to load categories:', err);
      setCategories({ categories: [], brands: [], sizes: [], colors: [], locations: [] });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'cost' ? parseFloat(value) || 0 : 
              name === 'quantity' ? parseInt(value) || 1 : 
              value,
    }));
  };

  const toggleOptionalFields = () => {
    setShowOptionalFields(prev => {
      const newValue = !prev;
      // If user is closing the fields, remember not to auto-open them again
      if (!newValue) {
        keepOptionalFieldsClosedRef.current = true;
      } else {
        keepOptionalFieldsClosedRef.current = false;
      }
      return newValue;
    });
  };

  const handleCategoryChange = (category: string) => {
    setFormData(prev => ({
      ...prev,
      category,
      brand: '',
      size: '',
      color: '',
    }));
  };

  const handleBrandChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      brand: e.target.value,
      size: '',
      color: '',
    }));
  };

  const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      size: e.target.value,
      color: '',
    }));
  };

  const handleBarcodeScan = (barcode: string) => {
    const now = Date.now();
    
    // Prevent duplicate scans within 2 seconds
    if (barcode === lastScannedBarcode && (now - lastScanTime) < 2000) {
      console.log('Blocked duplicate scan:', barcode);
      return;
    }
    
    setLastScannedBarcode(barcode);
    setLastScanTime(now);
    console.log('Scanned barcode:', barcode);
    
    // Look up item by UPC in existing inventory (case-insensitive comparison)
    const matchedItem = inventoryItems.find(item => 
      item.upc && item.upc.toLowerCase() === barcode.toLowerCase()
    );
    
    if (matchedItem) {
      // Auto-populate all fields from the matched item
      setFormData(prev => ({
        ...prev,
        upc: barcode,
        category: matchedItem.category,
        brand: matchedItem.brand,
        size: matchedItem.size,
        color: matchedItem.color,
        cost: matchedItem.cost || 0,
        location: matchedItem.location || '',
      }));
      
      // Show optional fields so user can see location, notes, etc. (unless user explicitly closed them)
      if (!keepOptionalFieldsClosedRef.current) {
        setShowOptionalFields(true);
      }
      
      // Clear any errors
      setError(null);
      
      console.log(`✓ Found existing item: ${matchedItem.category} ${matchedItem.brand} - ${matchedItem.size} - ${matchedItem.color}`);
      console.log('Fields auto-populated from existing item. Adjust quantity or other details as needed.');
    } else {
      // Item not found - just populate the UPC field
      setFormData(prev => ({
        ...prev,
        upc: barcode
      }));
      
      // Show optional fields so user can see the UPC (unless user explicitly closed them)
      if (!keepOptionalFieldsClosedRef.current) {
        setShowOptionalFields(true);
      }
      
      setError(`UPC ${barcode} not found in inventory. Please fill in the details manually.`);
      console.log(`UPC ${barcode} not found. User needs to fill in details manually.`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      // Validate required fields
      if (!formData.category || !formData.brand || !formData.size || !formData.color) {
        throw new Error('Please fill in all required fields');
      }

      if (formData.cost <= 0) {
        throw new Error('Cost must be greater than 0');
      }

      if (formData.quantity && formData.quantity < 1) {
        throw new Error('Quantity must be at least 1');
      }

      await SalesAPI.addInventoryItem(formData);

      setSuccess(true);

      // Reset form but keep date
      setFormData({
        upc: '',
        category: '',
        brand: '',
        size: '',
        color: '',
        cost: 0,
        datePurchased: getLocalDateString(),
        location: '',
        notes: '',
        quantity: 1,
      });
      
      // Reset optional fields state
      setShowOptionalFields(false);
      keepOptionalFieldsClosedRef.current = false;
      setLastScannedBarcode('');
      setLastScanTime(0);

      // Reload categories to get updated lists
      await loadCategories();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add inventory item');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-3">
      <div className="container mx-auto px-4 max-w-2xl relative">
        {/* Header */}
        <div className="relative flex items-center justify-center mb-3">
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
            Add Inventory
          </h1>
        </div>

        {/* Error Message */}
        {error && (
          <div className="text-xs text-red-600 dark:text-red-400 mb-2 flex items-start gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="text-xs text-green-600 dark:text-green-400 mb-2 flex items-start gap-2">
            <span>✓</span>
            <span>Added successfully!</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow p-3">
          {loading ? (
            <div className="w-full px-3 py-6 flex items-center justify-center">
              <svg
                className="animate-spin h-6 w-6 text-gray-600 dark:text-gray-400"
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
              <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">Loading...</span>
            </div>
          ) : (
            <>
              {/* Category Buttons - Always shown first */}
              <div className="mb-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Category <span className="text-red-500">*</span>
                </label>
                {categories && categories.categories.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {categories.categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleCategoryChange(cat)}
                        disabled={submitting}
                        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                          formData.category === cat
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    type="text"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    required
                    disabled={submitting}
                    placeholder="Enter category"
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  />
                )}

                {/* Scan Barcode Button - Show only when Submit button is not visible */}
                {!formData.color && (
                  <>
                    {/* Divider */}
                    <div className="flex items-center gap-3 my-2">
                      <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">or</span>
                      <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
                    </div>
                    
                    {/* Centered Scan button */}
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => setIsScannerOpen(true)}
                        disabled={submitting}
                        className="px-4 py-1.5 rounded text-sm font-medium transition-colors bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                        Scan Barcode
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Brand Dropdown - Show only after Category is selected */}
              {formData.category && (
                <div className="mb-2 flex items-center gap-2">
                  <label
                    htmlFor="brand"
                    className="text-xs font-medium text-gray-700 dark:text-gray-300 w-20 flex-shrink-0"
                  >
                    Brand <span className="text-red-500">*</span>
                  </label>
                  {categories && categories.brands.length > 0 ? (
                    <select
                      id="brand"
                      name="brand"
                      value={formData.brand}
                      onChange={handleBrandChange}
                      required
                      disabled={submitting}
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                    >
                      <option value="">Choose brand...</option>
                      {categories.brands.map((brand) => (
                        <option key={brand} value={brand}>
                          {brand}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      id="brand"
                      name="brand"
                      value={formData.brand}
                      onChange={handleBrandChange}
                      required
                      disabled={submitting}
                      placeholder="Enter brand"
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                    />
                  )}
                </div>
              )}

              {/* Size - Show only after Brand is selected */}
              {formData.brand && (
                <div className="mb-2 flex items-center gap-2">
                  <label
                    htmlFor="size"
                    className="text-xs font-medium text-gray-700 dark:text-gray-300 w-20 flex-shrink-0"
                  >
                    Size <span className="text-red-500">*</span>
                  </label>
                  {categories && categories.sizes.length > 0 ? (
                    <select
                      id="size"
                      name="size"
                      value={formData.size}
                      onChange={handleSizeChange}
                      required
                      disabled={submitting}
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                    >
                      <option value="">Choose size...</option>
                      {categories.sizes.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      id="size"
                      name="size"
                      value={formData.size}
                      onChange={handleSizeChange}
                      required
                      disabled={submitting}
                      placeholder="M, 10"
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                    />
                  )}
                </div>
              )}

              {/* Color - Show only after Size is selected */}
              {formData.size && (
                <div className="mb-2 flex items-center gap-2">
                  <label
                    htmlFor="color"
                    className="text-xs font-medium text-gray-700 dark:text-gray-300 w-20 flex-shrink-0"
                  >
                    Color <span className="text-red-500">*</span>
                  </label>
                  {categories && categories.colors.length > 0 ? (
                    <select
                      id="color"
                      name="color"
                      value={formData.color}
                      onChange={handleInputChange}
                      required
                      disabled={submitting}
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                    >
                      <option value="">Choose color...</option>
                      {categories.colors.map((color) => (
                        <option key={color} value={color}>
                          {color}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      id="color"
                      name="color"
                      value={formData.color}
                      onChange={handleInputChange}
                      required
                      disabled={submitting}
                      placeholder="Black, Red"
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                    />
                  )}
                </div>
              )}

              {/* Cost & Quantity - Show only after Color is selected */}
              {formData.color && (
                <>
                  <div className="mb-2 grid grid-cols-2 gap-8">
                    {/* Cost */}
                    <div className="flex flex-col">
                      <label htmlFor="cost" className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Cost <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center">
                        <span className="text-sm text-gray-700 dark:text-gray-300 mr-1">$</span>
                        <input
                          type="number"
                          id="cost"
                          name="cost"
                          value={formData.cost !== undefined && formData.cost !== null ? formData.cost.toFixed(2) : ''}
                          onChange={handleInputChange}
                          step="0.01"
                          min="0"
                          required
                          disabled={submitting}
                          placeholder="0.00"
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                        />
                      </div>
                    </div>

                    {/* Quantity */}
                    <div className="flex flex-col">
                      <label htmlFor="quantity" className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Quantity
                      </label>
                      <input
                        type="number"
                        id="quantity"
                        name="quantity"
                        value={formData.quantity}
                        onChange={handleInputChange}
                        min="1"
                        disabled={submitting}
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Optional Fields Toggle */}
                  <button
                    type="button"
                    onClick={toggleOptionalFields}
                    className="w-full text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-2 py-1 transition-colors"
                  >
                    {showOptionalFields ? '▼' : '▶'} Optional Fields (UPC, Date, Location, Notes)
                  </button>

                  {/* Optional Fields */}
                  {showOptionalFields && (
                    <>
                      {/* UPC */}
                      <div className="mb-2 flex items-center gap-2">
                        <label htmlFor="upc" className="text-xs font-medium text-gray-700 dark:text-gray-300 w-20 flex-shrink-0">
                          UPC
                        </label>
                        <input
                          type="text"
                          id="upc"
                          name="upc"
                          value={formData.upc}
                          onChange={handleInputChange}
                          disabled={submitting}
                          placeholder="Optional"
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                        />
                      </div>

                      {/* Date Purchased */}
                      <div className="mb-2 flex items-center gap-2">
                        <label htmlFor="datePurchased" className="text-xs font-medium text-gray-700 dark:text-gray-300 w-20 flex-shrink-0">
                          Date
                        </label>
                        <input
                          type="date"
                          id="datePurchased"
                          name="datePurchased"
                          value={formData.datePurchased}
                          onChange={handleInputChange}
                          disabled={submitting}
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                        />
                      </div>

                      {/* Location */}
                      <div className="mb-2 flex items-center gap-2">
                        <label htmlFor="location" className="text-xs font-medium text-gray-700 dark:text-gray-300 w-20 flex-shrink-0">
                          Location
                        </label>
                        <input
                          type="text"
                          id="location"
                          name="location"
                          value={formData.location}
                          onChange={handleInputChange}
                          disabled={submitting}
                          list="location-list"
                          placeholder="Optional"
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                        />
                        {categories && categories.locations.length > 0 && (
                          <datalist id="location-list">
                            {categories.locations.map((loc) => (
                              <option key={loc} value={loc} />
                            ))}
                          </datalist>
                        )}
                      </div>

                      {/* Notes */}
                      <div className="mb-2 flex items-start gap-2">
                        <label htmlFor="notes" className="text-xs font-medium text-gray-700 dark:text-gray-300 w-20 flex-shrink-0 pt-1">
                          Notes
                        </label>
                        <textarea
                          id="notes"
                          name="notes"
                          value={formData.notes}
                          onChange={handleInputChange}
                          disabled={submitting}
                          rows={2}
                          placeholder="Optional notes"
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                        />
                      </div>
                    </>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  >
                    {submitting ? 'Adding...' : 'Add to Inventory'}
                  </button>
                </>
              )}
            </>
          )}
        </form>

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

