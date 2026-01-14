'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import SalesAPI, { MoneyDashboard, MoneyFlowEntry } from '@/lib/SalesAPI';
import { useAuth } from '../context/AuthContext';

export default function MoneyDashboardPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<MoneyDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [filterResponsibleParty, setFilterResponsibleParty] = useState<string>('all');
  const [showHistory, setShowHistory] = useState(false);
  const [showBalances, setShowBalances] = useState(false);
  const [showLater, setShowLater] = useState(false);
  const [expandedTransfers, setExpandedTransfers] = useState<Set<string>>(new Set());
  const [historySortColumn, setHistorySortColumn] = useState<keyof MoneyFlowEntry | null>(null);
  const [historySortDirection, setHistorySortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await SalesAPI.getMoneyDashboard();
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load money dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkComplete = async (transferId: string, responsibleParty: string) => {
    const completedBy = user?.name || 'Unknown';
    
    if (!confirm(`Mark this transfer as complete?\n\nResponsible Party: ${responsibleParty}\nCompleted By: ${completedBy}`)) {
      return;
    }

    setSubmitting(transferId);
    setError(null);

    try {
      await SalesAPI.markTransferComplete(transferId, completedBy);
      await loadDashboard(); // Reload to get updated data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark transfer complete');
    } finally {
      setSubmitting(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return 'N/A';
    }
  };

  const toggleTransferExpand = (transferId: string) => {
    setExpandedTransfers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transferId)) {
        newSet.delete(transferId);
      } else {
        newSet.add(transferId);
      }
      return newSet;
    });
  };

  const handleHistorySort = (column: keyof MoneyFlowEntry) => {
    if (historySortColumn === column) {
      // Toggle direction if clicking the same column
      setHistorySortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to descending
      setHistorySortColumn(column);
      setHistorySortDirection('desc');
    }
  };

  const getSortedHistory = () => {
    if (!dashboard?.completedTransfers) return [];
    
    const transfers = [...dashboard.completedTransfers];
    
    if (!historySortColumn) {
      // Default: reverse chronological order
      return transfers.reverse();
    }
    
    return transfers.sort((a, b) => {
      let aVal = a[historySortColumn];
      let bVal = b[historySortColumn];
      
      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      // Handle different types
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal);
        return historySortDirection === 'asc' ? comparison : -comparison;
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        const comparison = aVal - bVal;
        return historySortDirection === 'asc' ? comparison : -comparison;
      }
      
      // Handle dates
      if (historySortColumn === 'completedDate' || historySortColumn === 'date') {
        const aTime = aVal ? new Date(aVal as string).getTime() : 0;
        const bTime = bVal ? new Date(bVal as string).getTime() : 0;
        const comparison = aTime - bTime;
        return historySortDirection === 'asc' ? comparison : -comparison;
      }
      
      // Default string comparison
      const comparison = String(aVal).localeCompare(String(bVal));
      return historySortDirection === 'asc' ? comparison : -comparison;
    });
  };

  const getSortIcon = (column: keyof MoneyFlowEntry) => {
    if (historySortColumn !== column) {
      return <span className="ml-1 text-gray-400">⇅</span>;
    }
    return historySortDirection === 'asc' ? 
      <span className="ml-1">↑</span> : 
      <span className="ml-1">↓</span>;
  };

  // Group pending transfers by responsible party and actionability
  const groupTransfersByParty = (actionableOnly: boolean) => {
    if (!dashboard) return {};
    
    const grouped: Record<string, MoneyFlowEntry[]> = {};
    
    dashboard.pendingTransfers.forEach(transfer => {
      const party = transfer.responsibleParty || 'Unknown';
      // Skip Auto transfers (they're already completed)
      if (party === 'Auto') return;
      
      // Filter by actionability
      if (actionableOnly && !transfer.isActionable) return;
      if (!actionableOnly && transfer.isActionable) return;
      
      if (!grouped[party]) {
        grouped[party] = [];
      }
      grouped[party].push(transfer);
    });
    
    return grouped;
  };

  // Get unique responsible parties from pending transfers
  const getResponsibleParties = () => {
    if (!dashboard) return [];
    const parties = new Set<string>();
    dashboard.pendingTransfers.forEach(t => {
      const party = t.responsibleParty || 'Unknown';
      if (party && party !== 'Auto') {
        parties.add(party);
      }
    });
    return Array.from(parties).sort();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">Error</h2>
            <p className="text-red-600 dark:text-red-300">{error}</p>
            <button
              onClick={loadDashboard}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
          <Link
            href="/"
            className="mt-4 inline-block text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const actionableTransfers = groupTransfersByParty(true);
  const futureTransfers = groupTransfersByParty(false);
  const responsibleParties = getResponsibleParties();
  
  const hasActionableTransfers = Object.keys(actionableTransfers).length > 0;
  const hasFutureTransfers = Object.keys(futureTransfers).length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="relative flex items-center justify-center mb-8">
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
            💰 Money
          </h1>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-600 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* To Do Now - Actionable Transfers */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
          <h2 
            className="text-2xl font-bold text-gray-900 dark:text-white cursor-help mb-4"
            title="Next actionable transfers - these can be completed right now"
          >
            👉 To Do
          </h2>

          {hasActionableTransfers ? (
            <div className="space-y-6">
              {Object.entries(actionableTransfers).map(([party, transfers]) => (
                <div key={party}>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    {party} ({transfers.length})
                  </h3>
                  <div className="space-y-3">
                    {transfers.map((transfer) => (
                      <div
                        key={transfer.transferId}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {formatCurrency(transfer.amount)}
                          </span>
                          
                          <button
                            onClick={() => handleMarkComplete(transfer.transferId, transfer.responsibleParty || party)}
                            disabled={submitting === transfer.transferId}
                            className="flex items-center justify-center gap-2 px-4 py-2 sm:px-3 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium whitespace-nowrap"
                            title="Mark this transfer as complete"
                          >
                            {submitting === transfer.transferId ? (
                              <>
                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span className="hidden sm:inline">Saving...</span>
                              </>
                            ) : (
                              <>
                                {/* Empty checkbox icon for mobile, text for desktop */}
                                <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <rect x="3" y="3" width="18" height="18" rx="2" />
                                </svg>
                                <span className="hidden sm:inline">Mark Done</span>
                              </>
                            )}
                          </button>
                        </div>
                        
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          <span className="font-medium">{transfer.sourceLocation}</span>
                          <span className="mx-2">→</span>
                          <span className="font-medium">{transfer.destinationLocation}</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {formatDate(transfer.date)}
                          </span>
                          
                          <button
                            onClick={() => toggleTransferExpand(transfer.transferId)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {expandedTransfers.has(transfer.transferId) ? 'Less ▲' : 'More ▼'}
                          </button>
                        </div>
                        
                        {expandedTransfers.has(transfer.transferId) && (
                          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-500 space-y-1">
                            <div>Sale ID: {transfer.saleId}</div>
                            <div>Transfer ID: {transfer.transferId}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-gray-500 dark:text-gray-400">Nothing to do right now!</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                {hasFutureTransfers ? 'Complete the transfers below to unlock the next steps' : 'All transfers are complete!'}
              </p>
            </div>
          )}
        </div>

        {/* To Do Later - Future Transfers */}
        {hasFutureTransfers && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
            <button
              onClick={() => setShowLater(!showLater)}
              className="w-full flex items-center justify-between text-left mb-4"
              title="Future transfers - these will become actionable after earlier steps are completed"
            >
              <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                ⏳ To Do Later
              </h2>
              <span className="text-2xl text-gray-400">
                {showLater ? '▼' : '▶'}
              </span>
            </button>

            {showLater && (
              <div className="space-y-6 opacity-60">
              {Object.entries(futureTransfers).map(([party, transfers]) => (
                <div key={party}>
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-400 mb-3">
                    {party} ({transfers.length})
                  </h3>
                  <div className="space-y-3">
                    {transfers.map((transfer) => (
                      <div
                        key={transfer.transferId}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900"
                      >
                        <div className="text-xl font-bold text-gray-600 dark:text-gray-400 mb-2">
                          {formatCurrency(transfer.amount)}
                        </div>
                        
                        <div className="text-sm text-gray-500 dark:text-gray-500 mb-2">
                          <span className="font-medium">{transfer.sourceLocation}</span>
                          <span className="mx-2">→</span>
                          <span className="font-medium">{transfer.destinationLocation}</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(transfer.date)}
                          </span>
                          
                          <button
                            onClick={() => toggleTransferExpand(transfer.transferId)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {expandedTransfers.has(transfer.transferId) ? 'Less ▲' : 'More ▼'}
                          </button>
                        </div>
                        
                        {expandedTransfers.has(transfer.transferId) && (
                          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-600 space-y-1">
                            <div>Sale ID: {transfer.saleId}</div>
                            <div>Transfer ID: {transfer.transferId}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              </div>
            )}
          </div>
        )}

        {/* Transfer History Toggle */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between text-left"
          >
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              History
            </h2>
            <span className="text-2xl text-gray-400">
              {showHistory ? '▼' : '▶'}
            </span>
          </button>

          {showHistory && (
            <div className="mt-6">
              {dashboard?.completedTransfers && dashboard.completedTransfers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th 
                          className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 select-none"
                          onClick={() => handleHistorySort('amount')}
                        >
                          <div className="flex items-center">
                            Amount
                            {getSortIcon('amount')}
                          </div>
                        </th>
                        <th 
                          className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 select-none"
                          onClick={() => handleHistorySort('sourceLocation')}
                        >
                          <div className="flex items-center">
                            From → To
                            {getSortIcon('sourceLocation')}
                          </div>
                        </th>
                        <th 
                          className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 select-none"
                          onClick={() => handleHistorySort('saleId')}
                        >
                          <div className="flex items-center">
                            Sale ID
                            {getSortIcon('saleId')}
                          </div>
                        </th>
                        <th 
                          className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 select-none"
                          onClick={() => handleHistorySort('completedDate')}
                        >
                          <div className="flex items-center">
                            Completed Date
                            {getSortIcon('completedDate')}
                          </div>
                        </th>
                        <th 
                          className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 select-none"
                          onClick={() => handleHistorySort('completedBy')}
                        >
                          <div className="flex items-center">
                            Completed By
                            {getSortIcon('completedBy')}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedHistory().map((transfer) => (
                          <tr
                            key={transfer.transferId}
                            className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          >
                            <td className="py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                              {formatCurrency(transfer.amount)}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                              {transfer.sourceLocation} → {transfer.destinationLocation}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                              {transfer.saleId}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                              {formatDateTime(transfer.completedDate || null)}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                              {transfer.completedBy || 'N/A'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  No completed transfers yet
                </p>
              )}
            </div>
          )}
        </div>

        {/* Current Balances - Collapsible */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <button
            onClick={() => setShowBalances(!showBalances)}
            className="w-full flex items-center justify-between text-left"
          >
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Balances
            </h2>
            <span className="text-2xl text-gray-400">
              {showBalances ? '▼' : '▶'}
            </span>
          </button>

          {showBalances && (
            <div className="mt-6">
              {dashboard?.balances && Object.keys(dashboard.balances).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(dashboard.balances)
                    .filter(([_, balance]) => balance > 0)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([location, balance]) => (
                      <div
                        key={location}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                      >
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                          {location}
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatCurrency(balance)}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No money in any locations</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

