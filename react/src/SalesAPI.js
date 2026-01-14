// API client for Sales Management API v2.0
// Update the BASE_URL with your actual Apps Script deployment URL

const BASE_URL = 'https://script.google.com/macros/s/{YOUR_DEPLOYMENT_ID}/exec';

class SalesAPI {
  /**
   * Make a GET request to the API
   * @param {string} resource - Resource name (e.g., 'items', 'stats')
   * @param {Object} params - Additional query parameters
   */
  static async get(resource, params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (resource) {
        queryParams.append('resource', resource);
      }
      
      // Add any additional parameters
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          queryParams.append(key, params[key]);
        }
      });
      
      const url = `${BASE_URL}?${queryParams.toString()}`;
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow', // Apps Script may redirect
      });

      const data = await response.json();
      
      if (!data.success) {
        const error = new Error(data.error || 'API request failed');
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
   * @param {string} resource - Resource name (e.g., 'sales')
   * @param {Object} data - Request body data
   * @param {Object} params - Additional query parameters
   */
  static async post(resource, data, params = {}) {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('resource', resource);
      
      // Add any additional parameters
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
        redirect: 'follow', // Apps Script may redirect
      });

      const result = await response.json();
      
      if (!result.success) {
        const error = new Error(result.error || 'API request failed');
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
   * Get API documentation as JSON (OpenAPI spec)
   */
  static async getApiSpec() {
    return this.get('', { format: 'json' });
  }

  /**
   * Get all in-stock items
   * @returns {Promise<Array>} Array of item objects
   */
  static async getInStockItems() {
    return this.get('items');
  }

  /**
   * Get a specific item by ID
   * @param {string} itemId - Item ID to fetch
   * @returns {Promise<Object>} Item object
   */
  static async getItem(itemId) {
    if (!itemId) {
      throw new Error('Item ID is required');
    }
    return this.get('items', { id: itemId });
  }

  /**
   * Get summary statistics
   * @returns {Promise<Object>} Statistics object
   */
  static async getSummaryStats() {
    return this.get('stats');
  }

  /**
   * Record a single sale
   * @param {Object} saleData - Sale information
   * @param {string} saleData.itemId - Item ID
   * @param {number} saleData.salePrice - Sale price
   * @param {string} saleData.dateSold - Date sold (YYYY-MM-DD)
   * @param {string} saleData.soldBy - Seller name
   * @param {string} saleData.platform - Sales platform
   * @param {string} saleData.shippingStatus - Shipping status
   * @param {string} [saleData.buyer] - Buyer name (optional)
   * @param {string} [saleData.trackingNumber] - Tracking number (optional)
   * @param {string} [saleData.notes] - Notes (optional)
   * @returns {Promise<Object>} Result with itemId, salePrice, and row number
   */
  static async recordSale(saleData) {
    // Validate required fields
    const requiredFields = ['itemId', 'salePrice', 'dateSold', 'soldBy', 'platform', 'shippingStatus'];
    for (const field of requiredFields) {
      if (!saleData[field]) {
        throw new Error(`${field} is required`);
      }
    }
    
    return this.post('sales', saleData);
  }

  /**
   * Record a bulk sale (multiple items to same buyer)
   * @param {Object} saleData - Sale information
   * @param {string[]} saleData.items - Array of item IDs
   * @param {number} saleData.salePrice - Total sale price
   * @param {string} saleData.dateSold - Date sold (YYYY-MM-DD)
   * @param {string} saleData.soldBy - Seller name
   * @param {string} saleData.buyer - Buyer name (required for bulk sales)
   * @param {string} saleData.platform - Sales platform
   * @param {string} saleData.shippingStatus - Shipping status
   * @param {string} [saleData.trackingNumber] - Tracking number (optional)
   * @param {string} [saleData.notes] - Notes (optional)
   * @returns {Promise<Object>} Result with itemCount, totalPrice, and pricePerItem
   */
  static async recordBulkSale(saleData) {
    // Validate required fields
    const requiredFields = ['items', 'salePrice', 'dateSold', 'soldBy', 'buyer', 'platform', 'shippingStatus'];
    for (const field of requiredFields) {
      if (!saleData[field]) {
        throw new Error(`${field} is required`);
      }
    }
    
    if (!Array.isArray(saleData.items) || saleData.items.length === 0) {
      throw new Error('items must be a non-empty array');
    }
    
    return this.post('sales', saleData, { bulk: 'true' });
  }
}

export default SalesAPI;
