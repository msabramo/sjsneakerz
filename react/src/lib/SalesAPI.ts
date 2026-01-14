// API client for Sales Management API v2.0
// Uses Next.js API proxy to avoid CORS issues with Google Apps Script

// Use proxy in development (localhost or local network IP), direct URL in production
const USE_PROXY = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' || 
  window.location.hostname.startsWith('10.') ||
  window.location.hostname.startsWith('192.168.')
);
const PROXY_URL = '/api/proxy';
const DIRECT_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://script.google.com/macros/s/{YOUR_DEPLOYMENT_ID}/exec';

const BASE_URL = USE_PROXY ? PROXY_URL : DIRECT_URL;

interface ApiError extends Error {
  statusCode?: number;
}

export interface Item {
  itemId: string;
  upc: string;
  category: string;
  brand: string;
  size: string;
  color: string;
  cost: number;
  datePurchased: string | null;
  status: string;
  location: string;
  notes: string;
}

export interface SaleData {
  itemId: string;
  salePrice: number;
  dateSold: string;
  soldBy: string;
  platform: string;
  shippingStatus: string;
  paymentMethod?: string;
  buyer?: string;
  trackingNumber?: string;
  notes?: string;
}

export interface BulkSaleData extends Omit<SaleData, 'itemId'> {
  items: string[];
  buyer: string;
}

export interface SaleResult {
  itemId: string;
  salePrice: number;
  row: number;
}

export interface BulkSaleResult {
  itemCount: number;
  totalPrice: number;
  pricePerItem: number;
}

export interface Stats {
  inStock: number;
  sold: number;
  totalSales: number;
  salesCount: number;
  avgSalePrice: number;
}

export interface MoneyFlowEntry {
  transferId: string;
  saleId: string;
  amount: number;
  date: string | null;
  sourceLocation: string;
  destinationLocation: string;
  status: 'Pending' | 'Completed';
  completedDate?: string | null;
  completedBy?: string;
  responsibleParty?: string;
  isActionable?: boolean;
  notes?: string;
}

export interface MoneyDashboard {
  balances: Record<string, number>;
  pendingTransfers: MoneyFlowEntry[];
  completedTransfers: MoneyFlowEntry[];
  totalInTransit: number;
  totalInVault: number;
}

export interface TransferFilters {
  status?: 'Pending' | 'Completed';
  location?: string;
  responsibleParty?: string;
}

export interface CompleteTransferRequest {
  transferId: string;
  completedBy: string;
}

export interface CompleteTransferResult {
  transferId: string;
  status: string;
  completedDate: string;
  completedBy: string;
}

export interface InventoryCategories {
  categories: string[];
  brands: string[];
  sizes: string[];
  colors: string[];
  locations: string[];
}

export interface AddInventoryData {
  upc?: string;
  category: string;
  brand: string;
  size: string;
  color: string;
  cost: number;
  datePurchased?: string;
  location?: string;
  notes?: string;
  quantity?: number;
}

export interface AddInventoryResult {
  itemId: string;
  itemCount: number;
  itemIds: string[];
}

export interface InventorySummaryItem {
  category: string;
  brand: string;
  size: string;
  color: string;
  quantity: number;
  totalCost: number;
  avgCost: number;
}

class SalesAPI {
  /**
   * Make a GET request to the API
   */
  static async get<T>(resource: string, params: Record<string, string> = {}): Promise<T> {
    try {
      const queryParams = new URLSearchParams();
      
      if (resource) {
        queryParams.append('resource', resource);
      }
      
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          queryParams.append(key, params[key]);
        }
      });
      
      const url = `${BASE_URL}?${queryParams.toString()}`;
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
      });

      const data = await response.json();
      
      if (!data.success) {
        const error = new Error(data.error || 'API request failed') as ApiError;
        error.statusCode = data.statusCode;
        throw error;
      }

      return data.data;
    } catch (error) {
      console.error(`API GET Error (${resource}):`, error);
      throw error;
    }
  }

  /**
   * Make a POST request to the API
   */
  static async post<T>(resource: string, data: unknown, params: Record<string, string> = {}): Promise<T> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('resource', resource);
      
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          queryParams.append(key, params[key]);
        }
      });
      
      const url = `${BASE_URL}?${queryParams.toString()}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        redirect: 'follow',
      });

      const result = await response.json();
      
      if (!result.success) {
        const error = new Error(result.error || 'API request failed') as ApiError;
        error.statusCode = result.statusCode;
        throw error;
      }

      return result.data;
    } catch (error) {
      console.error(`API POST Error (${resource}):`, error);
      throw error;
    }
  }

  /**
   * Get all in-stock items
   */
  static async getInStockItems(): Promise<Item[]> {
    return this.get<Item[]>('items');
  }

  /**
   * Get a specific item by ID
   */
  static async getItem(itemId: string): Promise<Item> {
    if (!itemId) {
      throw new Error('Item ID is required');
    }
    return this.get<Item>('items', { id: itemId });
  }

  /**
   * Get summary statistics
   */
  static async getSummaryStats(): Promise<Stats> {
    return this.get<Stats>('stats');
  }

  /**
   * Record a single sale
   */
  static async recordSale(saleData: SaleData): Promise<SaleResult> {
    const requiredFields: (keyof SaleData)[] = ['itemId', 'salePrice', 'dateSold', 'soldBy', 'platform', 'shippingStatus'];
    for (const field of requiredFields) {
      if (!saleData[field]) {
        throw new Error(`${field} is required`);
      }
    }
    
    return this.post<SaleResult>('sales', saleData);
  }

  /**
   * Record a bulk sale
   */
  static async recordBulkSale(saleData: BulkSaleData): Promise<BulkSaleResult> {
    const requiredFields: (keyof BulkSaleData)[] = ['items', 'salePrice', 'dateSold', 'soldBy', 'buyer', 'platform', 'shippingStatus'];
    for (const field of requiredFields) {
      if (!saleData[field]) {
        throw new Error(`${field} is required`);
      }
    }
    
    if (!Array.isArray(saleData.items) || saleData.items.length === 0) {
      throw new Error('items must be a non-empty array');
    }
    
    return this.post<BulkSaleResult>('sales', saleData, { bulk: 'true' });
  }

  /**
   * Get money dashboard data with balances and transfers
   */
  static async getMoneyDashboard(): Promise<MoneyDashboard> {
    return this.get<MoneyDashboard>('money-dashboard');
  }

  /**
   * Mark a transfer as complete
   */
  static async markTransferComplete(transferId: string, completedBy: string): Promise<CompleteTransferResult> {
    if (!transferId) {
      throw new Error('transferId is required');
    }
    if (!completedBy) {
      throw new Error('completedBy is required');
    }
    
    return this.post<CompleteTransferResult>('complete-transfer', { transferId, completedBy });
  }

  /**
   * Get transfer history with optional filters
   */
  static async getTransferHistory(filters?: TransferFilters): Promise<MoneyFlowEntry[]> {
    const params: Record<string, string> = {};
    
    if (filters) {
      if (filters.status) params.status = filters.status;
      if (filters.location) params.location = filters.location;
      if (filters.responsibleParty) params.responsibleParty = filters.responsibleParty;
    }
    
    return this.get<MoneyFlowEntry[]>('transfer-history', params);
  }

  /**
   * Get inventory categories and other dropdown options
   */
  static async getInventoryCategories(): Promise<InventoryCategories> {
    return this.get<InventoryCategories>('inventory-categories');
  }

  /**
   * Add a new inventory item (supports quantity for adding multiple identical items)
   */
  static async addInventoryItem(itemData: AddInventoryData): Promise<AddInventoryResult> {
    const requiredFields: (keyof AddInventoryData)[] = ['category', 'brand', 'size', 'color', 'cost'];
    for (const field of requiredFields) {
      if (!itemData[field]) {
        throw new Error(`${field} is required`);
      }
    }
    
    if (itemData.cost < 0) {
      throw new Error('Cost must be a positive number');
    }
    
    if (itemData.quantity && itemData.quantity < 1) {
      throw new Error('Quantity must be at least 1');
    }
    
    return this.post<AddInventoryResult>('inventory', itemData);
  }

  /**
   * Get inventory summary - grouped count of items by category/brand/size/color
   */
  static async getInventorySummary(): Promise<InventorySummaryItem[]> {
    return this.get<InventorySummaryItem[]>('inventory-summary');
  }
}

export default SalesAPI;

