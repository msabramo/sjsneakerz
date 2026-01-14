'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SalesAPI, { InventorySummaryItem } from '@/lib/SalesAPI';

interface CategorySummary {
  category: string;
  quantity: number;
  totalValue: number;
  items: InventorySummaryItem[];
}

export default function InventorySummary() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<InventorySummaryItem[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await SalesAPI.getInventorySummary();
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory summary');
    } finally {
      setLoading(false);
    }
  };

  // Group by category
  const categorySummaries: CategorySummary[] = [];
  const categoryMap = new Map<string, CategorySummary>();

  summary.forEach(item => {
    if (!categoryMap.has(item.category)) {
      categoryMap.set(item.category, {
        category: item.category,
        quantity: 0,
        totalValue: 0,
        items: []
      });
    }
    const catSummary = categoryMap.get(item.category)!;
    catSummary.quantity += item.quantity;
    catSummary.totalValue += item.totalCost;
    catSummary.items.push(item);
  });

  categorySummaries.push(...Array.from(categoryMap.values()).sort((a, b) => 
    a.category.localeCompare(b.category)
  ));

  // Calculate grand totals
  const totalItems = summary.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = summary.reduce((sum, item) => sum + item.totalCost, 0);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const handleSellClick = (item: InventorySummaryItem) => {
    // Navigate to record-sale page with pre-filled filters
    const params = new URLSearchParams({
      category: item.category,
      brand: item.brand,
      size: item.size,
      color: item.color,
    });
    router.push(`/record-sale?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-3">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="relative flex items-center justify-between mb-3">
          <Link
            href="/"
            className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
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
            Inventory
          </h1>
          <Link
            href="/inventory"
            className="flex items-center justify-center px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors"
            title="Add Inventory"
          >
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span className="hidden sm:inline">Add</span>
          </Link>
        </div>

        {/* Grand Total - Hidden while loading */}
        {!loading && (
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-6 mb-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm opacity-90 mb-1">Total Inventory</div>
                <div className="text-3xl font-bold">{totalItems} items</div>
              </div>
              <div className="text-right">
                <div className="text-sm opacity-90 mb-1">Total Value</div>
                <div className="text-3xl font-bold">${totalValue.toFixed(2)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
            <div className="text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <svg
              className="animate-spin h-8 w-8 text-gray-600 dark:text-gray-400"
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
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading inventory...</span>
          </div>
        )}

        {/* No Items */}
        {!loading && categorySummaries.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <div className="text-gray-500 dark:text-gray-400">
              No inventory items found
            </div>
          </div>
        )}

        {/* Category Breakdown */}
        {!loading && categorySummaries.length > 0 && (
          <div className="space-y-3">
            {categorySummaries.map((catSummary) => (
              <div
                key={catSummary.category}
                className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
              >
                {/* Category Header - Clickable */}
                <button
                  onClick={() => toggleCategory(catSummary.category)}
                  className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform ${
                        expandedCategories.has(catSummary.category) ? 'rotate-90' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                    <div className="text-left">
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">
                        {catSummary.category}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {catSummary.quantity} items • ${catSummary.totalValue.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {catSummary.quantity}
                  </div>
                </button>

                {/* Expanded Details */}
                {expandedCategories.has(catSummary.category) && (
                  <div className="border-t border-gray-200 dark:border-gray-700">
                    {/* Desktop Table View (md and up) */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                              Brand
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                              Size
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                              Color
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                              Qty
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                              Avg Cost
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                              Total
                            </th>
                            <th className="px-2 py-2 text-center text-xs font-medium text-gray-700 dark:text-gray-300">
                              
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {catSummary.items.map((item, idx) => (
                            <tr
                              key={idx}
                              className="hover:bg-gray-50 dark:hover:bg-gray-700/30"
                            >
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                {item.brand}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                {item.size}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                {item.color}
                              </td>
                              <td className="px-4 py-2 text-sm text-right font-semibold text-gray-900 dark:text-white">
                                {item.quantity}
                              </td>
                              <td className="px-4 py-2 text-sm text-right text-gray-600 dark:text-gray-400">
                                ${item.avgCost.toFixed(2)}
                              </td>
                              <td className="px-4 py-2 text-sm text-right font-semibold text-gray-900 dark:text-white">
                                ${item.totalCost.toFixed(2)}
                              </td>
                              <td className="px-2 py-2">
                                <button
                                  onClick={() => handleSellClick(item)}
                                  className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                                  title="Sell this item"
                                  aria-label="Sell"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                                    />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View (sm and below) */}
                    <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
                      {catSummary.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                        >
                          {/* Item Details */}
                          <div className="space-y-2 mb-3">
                            <div className="flex justify-between items-start">
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {item.brand}
                              </div>
                              <div className="text-lg font-bold text-gray-900 dark:text-white">
                                {item.quantity}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Size:</span>
                                <span className="ml-1 text-gray-900 dark:text-white">{item.size}</span>
                              </div>
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Color:</span>
                                <span className="ml-1 text-gray-900 dark:text-white">{item.color}</span>
                              </div>
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Avg:</span>
                                <span className="ml-1 text-gray-900 dark:text-white">
                                  ${item.avgCost.toFixed(2)}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Total:</span>
                                <span className="ml-1 font-semibold text-gray-900 dark:text-white">
                                  ${item.totalCost.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Sell Button */}
                          <button
                            onClick={() => handleSellClick(item)}
                            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                          >
                            <span>Sell</span>
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17 8l4 4m0 0l-4 4m4-4H3"
                              />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

