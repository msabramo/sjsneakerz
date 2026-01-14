// Google Apps Script RESTful API for Sales Management
// Deploy this as a web app with "Execute as: Me" and "Who has access: Anyone"

/**
 * Handle OPTIONS requests (CORS preflight)
 */
function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle GET requests
 * 
 * Routes:
 * - GET /exec → API Documentation (HTML or JSON)
 * - GET /exec?resource=items → List all in-stock items
 * - GET /exec?resource=items&id={itemId} → Get specific item
 * - GET /exec?resource=stats → Get summary statistics
 */
function doGet(e) {
  try {
    var resource = e.parameter.resource || '';
    var format = e.parameter.format || 'html';
    var id = e.parameter.id || '';
    
    // Root endpoint - return documentation
    if (!resource) {
      if (format === 'json') {
        return createJsonResponse(getOpenAPISpec(), 200);
      } else {
        return HtmlService.createHtmlOutput(getApiDocumentationHTML())
          .setTitle('Sales Management API')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      }
    }
    
    var response;
    var statusCode = 200;
    
    switch(resource) {
      case 'items':
        if (id) {
          // Get specific item
          response = getItemById(id);
          if (!response) {
            return createJsonResponse({ error: 'Item not found: ' + id }, 404);
          }
        } else {
          // Get all in-stock items
          response = getInStockItems();
        }
        break;
        
      case 'stats':
        response = getSummaryStats();
        break;
        
      case 'money-dashboard':
        response = getMoneyDashboard();
        break;
        
      case 'transfer-history':
        var filters = {};
        if (e.parameter.status) filters.status = e.parameter.status;
        if (e.parameter.location) filters.location = e.parameter.location;
        if (e.parameter.responsibleParty) filters.responsibleParty = e.parameter.responsibleParty;
        response = getTransferHistory(filters);
        break;
        
      case 'inventory-categories':
        response = getInventoryCategories();
        break;
        
      case 'inventory-summary':
        response = getInventorySummary();
        break;
        
      default:
        return createJsonResponse({ error: 'Unknown resource: ' + resource }, 404);
    }
    
    return createJsonResponse(response, statusCode);
    
  } catch (error) {
    Logger.log('Error in doGet: ' + error.toString());
    return createJsonResponse({ error: error.toString() }, 500);
  }
}

/**
 * Handle POST requests
 * 
 * Routes:
 * - POST /exec?resource=sales → Create single sale
 * - POST /exec?resource=sales&bulk=true → Create bulk sale
 */
function doPost(e) {
  try {
    var resource = e.parameter.resource || '';
    var bulk = e.parameter.bulk === 'true';
    
    // Validate resource
    if (!resource) {
      return createJsonResponse({ error: 'Resource parameter is required' }, 400);
    }
    
    // Parse request body
    var requestData;
    if (e.postData && e.postData.contents) {
      try {
        requestData = JSON.parse(e.postData.contents);
      } catch (parseError) {
        return createJsonResponse({ error: 'Invalid JSON in request body' }, 400);
      }
    } else {
      return createJsonResponse({ error: 'Request body is required' }, 400);
    }
    
    var response;
    var statusCode = 201; // Created
    
    switch(resource) {
      case 'sales':
        if (bulk) {
          response = recordBulkSale(requestData);
        } else {
          response = recordSale(requestData);
        }
        break;
        
      case 'complete-transfer':
        if (!requestData.transferId) {
          return createJsonResponse({ error: 'transferId is required' }, 400);
        }
        response = markTransferComplete(requestData.transferId, requestData.completedBy);
        break;
        
      case 'inventory':
        response = addInventoryItem(requestData);
        break;
        
      default:
        return createJsonResponse({ error: 'Unknown resource: ' + resource }, 404);
    }
    
    return createJsonResponse(response, statusCode);
    
  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    
    // Check for specific error types
    if (error.message.includes('not found') || error.message.includes('not in stock')) {
      return createJsonResponse({ error: error.toString() }, 422);
    } else if (error.message.includes('required')) {
      return createJsonResponse({ error: error.toString() }, 400);
    }
    
    return createJsonResponse({ error: error.toString() }, 500);
  }
}

/**
 * Create a JSON response with proper structure
 * Note: Google Apps Script automatically handles CORS when deployed with "Anyone" access
 */
function createJsonResponse(data, statusCode) {
  statusCode = statusCode || 200;
  
  var responseBody = {
    success: statusCode >= 200 && statusCode < 300,
    timestamp: new Date().toISOString()
  };
  
  if (responseBody.success) {
    responseBody.data = data;
  } else {
    responseBody.error = data.error || 'An error occurred';
    responseBody.statusCode = statusCode;
  }
  
  return ContentService.createTextOutput(JSON.stringify(responseBody))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Get all in-stock items from the Inventory tab
 */
function getInStockItems() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var inventorySheet = ss.getSheetByName('Inventory');
  
  if (!inventorySheet) {
    throw new Error('Inventory sheet not found');
  }
  
  var lastRow = inventorySheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }
  
  var data = inventorySheet.getRange(2, 1, lastRow - 1, 11).getValues();
  var items = [];
  
  data.forEach(function(row) {
    var itemId = row[0];
    var status = row[8];
    
    if (itemId && status === 'In Stock') {
      items.push({
        itemId: itemId,
        upc: row[1],
        category: row[2],
        brand: row[3],
        size: row[4],
        color: row[5],
        cost: row[6],
        datePurchased: row[7] ? row[7].toISOString() : null,
        status: status,
        location: row[9],
        notes: row[10]
      });
    }
  });
  
  items.sort(function(a, b) {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if (a.brand !== b.brand) return a.brand.localeCompare(b.brand);
    return String(a.size).localeCompare(String(b.size));
  });
  
  return items;
}

/**
 * Get a specific item by ID
 */
function getItemById(itemId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var inventorySheet = ss.getSheetByName('Inventory');
  
  if (!inventorySheet) {
    throw new Error('Inventory sheet not found');
  }
  
  var lastRow = inventorySheet.getLastRow();
  if (lastRow < 2) {
    return null;
  }
  
  var data = inventorySheet.getRange(2, 1, lastRow - 1, 11).getValues();
  
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (row[0] === itemId) {
      return {
        itemId: row[0],
        upc: row[1],
        category: row[2],
        brand: row[3],
        size: row[4],
        color: row[5],
        cost: row[6],
        datePurchased: row[7] ? row[7].toISOString() : null,
        status: row[8],
        location: row[9],
        notes: row[10]
      };
    }
  }
  
  return null;
}

/**
 * Get summary statistics
 */
function getSummaryStats() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var inventorySheet = ss.getSheetByName('Inventory');
  var salesSheet = ss.getSheetByName('Sales');
  
  if (!inventorySheet || !salesSheet) {
    throw new Error('Required sheets not found');
  }
  
  var inventoryLastRow = inventorySheet.getLastRow();
  var salesLastRow = salesSheet.getLastRow();
  
  var inventoryData = inventoryLastRow > 1 
    ? inventorySheet.getRange(2, 1, inventoryLastRow - 1, 9).getValues()
    : [];
    
  var salesData = salesLastRow > 1
    ? salesSheet.getRange(2, 1, salesLastRow - 1, 2).getValues()
    : [];
  
  var inStockCount = 0;
  var soldCount = 0;
  
  inventoryData.forEach(function(row) {
    if (row[0]) {
      if (row[8] === 'In Stock') inStockCount++;
      else if (row[8] === 'Sold') soldCount++;
    }
  });
  
  var totalSales = 0;
  var salesCount = 0;
  
  salesData.forEach(function(row) {
    if (row[0] && row[1]) {
      totalSales += parseFloat(row[1]);
      salesCount++;
    }
  });
  
  return {
    inStock: inStockCount,
    sold: soldCount,
    totalSales: totalSales,
    salesCount: salesCount,
    avgSalePrice: salesCount > 0 ? totalSales / salesCount : 0
  };
}

/**
 * Record a sale
 */
function recordSale(saleData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var salesSheet = ss.getSheetByName('Sales');
  
  if (!salesSheet) {
    throw new Error('Sales sheet not found');
  }
  
  // Validate required fields
  if (!saleData.itemId) throw new Error('Item ID is required');
  if (!saleData.salePrice) throw new Error('Sale price is required');
  if (!saleData.dateSold) throw new Error('Date sold is required');
  if (!saleData.soldBy) throw new Error('Sold by is required');
  if (!saleData.platform) throw new Error('Platform is required');
  if (!saleData.shippingStatus) throw new Error('Shipping status is required');
  
  // Verify item exists and is in stock
  var inventorySheet = ss.getSheetByName('Inventory');
  var lastRow = inventorySheet.getLastRow();
  
  if (lastRow < 2) {
    throw new Error('No items in inventory');
  }
  
  var inventoryData = inventorySheet.getRange(2, 1, lastRow - 1, 9).getValues();
  var itemFound = false;
  var itemStatus = '';
  
  for (var i = 0; i < inventoryData.length; i++) {
    if (inventoryData[i][0] === saleData.itemId) {
      itemFound = true;
      itemStatus = inventoryData[i][8];
      break;
    }
  }
  
  if (!itemFound) {
    throw new Error('Item ID not found in inventory: ' + saleData.itemId);
  }
  
  if (itemStatus !== 'In Stock') {
    throw new Error('Item is not in stock (Status: ' + itemStatus + ')');
  }
  
  var dateSold = typeof saleData.dateSold === 'string' 
    ? new Date(saleData.dateSold) 
    : saleData.dateSold;
  
  var newRow = [
    saleData.itemId,
    saleData.salePrice,
    dateSold,
    saleData.soldBy,
    saleData.buyer || '',
    saleData.platform,
    saleData.shippingStatus,
    saleData.trackingNumber || '',
    saleData.notes || '',
    saleData.paymentMethod || ''
  ];
  
  salesSheet.appendRow(newRow);
  var lastSalesRow = salesSheet.getLastRow();
  
  salesSheet.getRange(lastSalesRow, 2).setNumberFormat('$#,##0.00');
  salesSheet.getRange(lastSalesRow, 3).setNumberFormat('M/d/yyyy');
  
  Logger.log('Sale recorded: ' + saleData.itemId);
  
  // Create money flow entries if payment method is provided
  if (saleData.paymentMethod) {
    var saleId = saleData.itemId + '-' + lastSalesRow;
    createMoneyFlowEntries(saleId, saleData.salePrice, saleData.paymentMethod, dateSold);
  }
  
  return {
    itemId: saleData.itemId,
    salePrice: saleData.salePrice,
    row: lastSalesRow
  };
}

/**
 * Record bulk sale
 */
function recordBulkSale(saleData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var salesSheet = ss.getSheetByName('Sales');
  
  if (!salesSheet) {
    throw new Error('Sales sheet not found');
  }
  
  // Validate required fields
  if (!saleData.items || saleData.items.length === 0) {
    throw new Error('No items provided');
  }
  if (!saleData.salePrice) throw new Error('Sale price is required');
  if (!saleData.dateSold) throw new Error('Date sold is required');
  if (!saleData.soldBy) throw new Error('Sold by is required');
  if (!saleData.buyer) throw new Error('Buyer is required for bulk sales');
  if (!saleData.platform) throw new Error('Platform is required');
  if (!saleData.shippingStatus) throw new Error('Shipping status is required');
  
  // Verify all items
  var inventorySheet = ss.getSheetByName('Inventory');
  var lastRow = inventorySheet.getLastRow();
  
  if (lastRow < 2) {
    throw new Error('No items in inventory');
  }
  
  var inventoryData = inventorySheet.getRange(2, 1, lastRow - 1, 9).getValues();
  var inventoryMap = {};
  
  inventoryData.forEach(function(row) {
    if (row[0]) {
      inventoryMap[row[0]] = row[8];
    }
  });
  
  for (var i = 0; i < saleData.items.length; i++) {
    var itemId = saleData.items[i];
    if (!inventoryMap[itemId]) {
      throw new Error('Item ID not found in inventory: ' + itemId);
    }
    if (inventoryMap[itemId] !== 'In Stock') {
      throw new Error('Item is not in stock: ' + itemId + ' (Status: ' + inventoryMap[itemId] + ')');
    }
  }
  
  var pricePerItem = saleData.salePrice / saleData.items.length;
  var dateSold = typeof saleData.dateSold === 'string' 
    ? new Date(saleData.dateSold) 
    : saleData.dateSold;
  
  var rows = [];
  saleData.items.forEach(function(itemId) {
    rows.push([
      itemId,
      pricePerItem,
      dateSold,
      saleData.soldBy,
      saleData.buyer,
      saleData.platform,
      saleData.shippingStatus,
      saleData.trackingNumber || '',
      saleData.notes || '',
      saleData.paymentMethod || ''
    ]);
  });
  
  if (rows.length > 0) {
    var startRow = salesSheet.getLastRow() + 1;
    salesSheet.getRange(startRow, 1, rows.length, 10).setValues(rows);
    salesSheet.getRange(startRow, 2, rows.length, 1).setNumberFormat('$#,##0.00');
    salesSheet.getRange(startRow, 3, rows.length, 1).setNumberFormat('M/d/yyyy');
    
    // Create money flow entries if payment method is provided
    if (saleData.paymentMethod) {
      var bulkSaleId = 'BULK-' + saleData.buyer + '-' + startRow;
      createMoneyFlowEntries(bulkSaleId, saleData.salePrice, saleData.paymentMethod, dateSold);
    }
  }
  
  Logger.log('Bulk sale recorded: ' + rows.length + ' items');
  
  return {
    itemCount: rows.length,
    totalPrice: saleData.salePrice,
    pricePerItem: pricePerItem
  };
}

/**
 * Get OpenAPI 3.0 specification
 */
function getOpenAPISpec() {
  return {
    openapi: '3.0.0',
    info: {
      title: 'Sales Management API',
      version: '2.0.0',
      description: 'RESTful API for managing sneaker inventory and sales',
      contact: {
        name: 'API Support'
      }
    },
    servers: [
      {
        url: ScriptApp.getService().getUrl(),
        description: 'Production server'
      }
    ],
    paths: {
      '/exec': {
        get: {
          summary: 'API Documentation or List Resources',
          description: 'Returns API documentation (HTML by default, JSON with ?format=json) or fetches resources',
          parameters: [
            {
              name: 'format',
              in: 'query',
              description: 'Response format (html or json)',
              schema: { type: 'string', enum: ['html', 'json'], default: 'html' }
            },
            {
              name: 'resource',
              in: 'query',
              description: 'Resource to fetch (items or stats)',
              schema: { type: 'string', enum: ['items', 'stats'] }
            },
            {
              name: 'id',
              in: 'query',
              description: 'Specific item ID (only with resource=items)',
              schema: { type: 'string' }
            }
          ],
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessResponse' }
                },
                'text/html': {
                  schema: { type: 'string' }
                }
              }
            },
            '404': {
              description: 'Resource not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' }
                }
              }
            }
          }
        },
        post: {
          summary: 'Create Resource',
          description: 'Create a new sale (single or bulk)',
          parameters: [
            {
              name: 'resource',
              in: 'query',
              required: true,
              description: 'Resource type (sales)',
              schema: { type: 'string', enum: ['sales'] }
            },
            {
              name: 'bulk',
              in: 'query',
              description: 'Whether this is a bulk sale',
              schema: { type: 'boolean', default: false }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SaleRequest' }
              }
            }
          },
          responses: {
            '201': {
              description: 'Sale created successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessResponse' }
                }
              }
            },
            '400': {
              description: 'Bad request - validation error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' }
                }
              }
            },
            '422': {
              description: 'Unprocessable entity - item not in stock',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' }
                }
              }
            }
          }
        }
      }
    },
    components: {
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
            statusCode: { type: 'integer' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        },
        Item: {
          type: 'object',
          properties: {
            itemId: { type: 'string', example: 'SJ-001' },
            upc: { type: 'string' },
            category: { type: 'string', example: 'Sneakers' },
            brand: { type: 'string', example: 'Nike' },
            size: { type: 'string', example: '10' },
            color: { type: 'string', example: 'Black/White' },
            cost: { type: 'number', example: 120.00 },
            datePurchased: { type: 'string', format: 'date-time' },
            status: { type: 'string', example: 'In Stock' },
            location: { type: 'string' },
            notes: { type: 'string' }
          }
        },
        SaleRequest: {
          type: 'object',
          required: ['itemId', 'salePrice', 'dateSold', 'soldBy', 'platform', 'shippingStatus'],
          properties: {
            itemId: { type: 'string', example: 'SJ-001' },
            salePrice: { type: 'number', example: 150.00 },
            dateSold: { type: 'string', format: 'date', example: '2025-12-31' },
            soldBy: { type: 'string', example: 'John Doe' },
            buyer: { type: 'string', example: 'Jane Smith' },
            platform: { type: 'string', example: 'In Person' },
            shippingStatus: { type: 'string', example: 'Picked Up' },
            trackingNumber: { type: 'string' },
            notes: { type: 'string' }
          }
        },
        BulkSaleRequest: {
          type: 'object',
          required: ['items', 'salePrice', 'dateSold', 'soldBy', 'buyer', 'platform', 'shippingStatus'],
          properties: {
            items: { type: 'array', items: { type: 'string' }, example: ['SJ-001', 'SJ-002'] },
            salePrice: { type: 'number', example: 300.00 },
            dateSold: { type: 'string', format: 'date' },
            soldBy: { type: 'string' },
            buyer: { type: 'string' },
            platform: { type: 'string' },
            shippingStatus: { type: 'string' },
            trackingNumber: { type: 'string' },
            notes: { type: 'string' }
          }
        },
        Stats: {
          type: 'object',
          properties: {
            inStock: { type: 'integer', example: 45 },
            sold: { type: 'integer', example: 23 },
            totalSales: { type: 'number', example: 3450.00 },
            salesCount: { type: 'integer', example: 23 },
            avgSalePrice: { type: 'number', example: 150.00 }
          }
        }
      }
    }
  };
}

// ========================================
// MONEY FLOW TRACKING FUNCTIONS
// ========================================

/**
 * Initialize money flow sheets with proper structure
 * Run this once to set up the money tracking system
 */
function initializeMoneyFlowSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Create MoneyFlow sheet
  var moneyFlowSheet = ss.getSheetByName('MoneyFlow');
  if (!moneyFlowSheet) {
    moneyFlowSheet = ss.insertSheet('MoneyFlow');
  } else {
    moneyFlowSheet.clear();
  }
  
  var moneyFlowHeaders = [
    'Transfer ID', 'Sale ID', 'Amount', 'Date', 'Source Location', 
    'Destination Location', 'Status', 'Completed Date', 'Completed By', 'Notes'
  ];
  moneyFlowSheet.getRange(1, 1, 1, moneyFlowHeaders.length).setValues([moneyFlowHeaders]);
  moneyFlowSheet.getRange(1, 1, 1, moneyFlowHeaders.length).setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
  moneyFlowSheet.setFrozenRows(1);
  moneyFlowSheet.setColumnWidth(1, 150);
  moneyFlowSheet.setColumnWidth(2, 120);
  moneyFlowSheet.setColumnWidth(3, 100);
  moneyFlowSheet.setColumnWidth(4, 120);
  moneyFlowSheet.setColumnWidth(5, 180);
  moneyFlowSheet.setColumnWidth(6, 180);
  moneyFlowSheet.setColumnWidth(7, 100);
  moneyFlowSheet.setColumnWidth(8, 120);
  moneyFlowSheet.setColumnWidth(9, 120);
  moneyFlowSheet.setColumnWidth(10, 200);
  
  // Create PaymentLocations sheet
  var locationsSheet = ss.getSheetByName('PaymentLocations');
  if (!locationsSheet) {
    locationsSheet = ss.insertSheet('PaymentLocations');
  } else {
    locationsSheet.clear();
  }
  
  var locationHeaders = ['Location ID', 'Location Name', 'Location Type', 'Owner', 'Notes'];
  locationsSheet.getRange(1, 1, 1, locationHeaders.length).setValues([locationHeaders]);
  locationsSheet.getRange(1, 1, 1, locationHeaders.length).setFontWeight('bold').setBackground('#34a853').setFontColor('#ffffff');
  locationsSheet.setFrozenRows(1);
  
  // Add default locations
  var defaultLocations = [
    ['LOC-001', 'Cash (Zach)', 'Receiving Account', 'Zach', 'Physical cash received by Zach'],
    ['LOC-002', 'Cash (Adi)', 'Receiving Account', 'Adi', 'Physical cash received by Adi'],
    ['LOC-003', 'Cash (Nicole)', 'Intermediate Account', 'Nicole', 'Cash handed to Nicole'],
    ['LOC-004', 'Wells Fargo Checking', 'Intermediate Account', 'Marc/Nicole', 'Main checking account'],
    ['LOC-005', 'Zach Wells Fargo', 'Intermediate Account', 'Zach', 'Zach\'s Wells Fargo account'],
    ['LOC-006', 'SoFi Checking', 'Intermediate Account', 'Marc/Nicole', 'SoFi checking account'],
    ['LOC-007', 'SoFi Savings', 'Intermediate Account', 'Marc/Nicole', 'SoFi savings account'],
    ['LOC-008', 'Zach Apple Cash', 'Receiving Account', 'Zach', 'Zach\'s Apple Cash'],
    ['LOC-009', 'Nicole Apple Cash', 'Intermediate Account', 'Nicole', 'Nicole\'s Apple Cash'],
    ['LOC-010', 'San Jose Sneakers Vault', 'Final Vault', 'SJ Sneakers', 'Final destination for business funds'],
    ['LOC-011', 'Depop Account', 'Receiving Account', 'SJ Sneakers', 'Depop payments']
  ];
  locationsSheet.getRange(2, 1, defaultLocations.length, locationHeaders.length).setValues(defaultLocations);
  
  // Create PaymentMethodFlows sheet
  var flowsSheet = ss.getSheetByName('PaymentMethodFlows');
  if (!flowsSheet) {
    flowsSheet = ss.insertSheet('PaymentMethodFlows');
  } else {
    flowsSheet.clear();
  }
  
  var flowHeaders = ['Payment Method', 'Step Number', 'From Location', 'To Location', 'Responsible Party'];
  flowsSheet.getRange(1, 1, 1, flowHeaders.length).setValues([flowHeaders]);
  flowsSheet.getRange(1, 1, 1, flowHeaders.length).setFontWeight('bold').setBackground('#fbbc04').setFontColor('#000000');
  flowsSheet.setFrozenRows(1);
  
  // Define payment method flows
  var defaultFlows = [
    // Cash (Zach) flow
    ['Cash (Zach)', 1, 'Customer', 'Cash (Zach)', 'Auto'],
    ['Cash (Zach)', 2, 'Cash (Zach)', 'Cash (Nicole)', 'Zach'],
    ['Cash (Zach)', 3, 'Cash (Nicole)', 'Wells Fargo Checking', 'Nicole'],
    ['Cash (Zach)', 4, 'Wells Fargo Checking', 'SoFi Savings', 'Marc/Nicole'],
    ['Cash (Zach)', 5, 'SoFi Savings', 'San Jose Sneakers Vault', 'Marc/Nicole'],
    
    // Cash (Adi) flow
    ['Cash (Adi)', 1, 'Customer', 'Cash (Adi)', 'Auto'],
    ['Cash (Adi)', 2, 'Cash (Adi)', 'Cash (Nicole)', 'Adi'],
    ['Cash (Adi)', 3, 'Cash (Nicole)', 'Wells Fargo Checking', 'Nicole'],
    ['Cash (Adi)', 4, 'Wells Fargo Checking', 'SoFi Savings', 'Marc/Nicole'],
    ['Cash (Adi)', 5, 'SoFi Savings', 'San Jose Sneakers Vault', 'Marc/Nicole'],
    
    // Zelle (Zach's parents) flow
    ['Zelle (Zach\'s parents)', 1, 'Customer', 'SoFi Checking', 'Auto'],
    ['Zelle (Zach\'s parents)', 2, 'SoFi Checking', 'SoFi Savings', 'Marc/Nicole'],
    ['Zelle (Zach\'s parents)', 3, 'SoFi Savings', 'San Jose Sneakers Vault', 'Marc/Nicole'],
    
    // Zelle (Zach's Wells Fargo) flow
    ['Zelle (Zach\'s Wells Fargo account)', 1, 'Customer', 'Zach Wells Fargo', 'Auto'],
    ['Zelle (Zach\'s Wells Fargo account)', 2, 'Zach Wells Fargo', 'SoFi Savings', 'Zach'],
    ['Zelle (Zach\'s Wells Fargo account)', 3, 'SoFi Savings', 'San Jose Sneakers Vault', 'Marc/Nicole'],
    
    // Apple Cash (Nicole) flow
    ['Apple Cash (Nicole)', 1, 'Customer', 'Nicole Apple Cash', 'Auto'],
    ['Apple Cash (Nicole)', 2, 'Nicole Apple Cash', 'SoFi Savings', 'Nicole'],
    ['Apple Cash (Nicole)', 3, 'SoFi Savings', 'San Jose Sneakers Vault', 'Marc/Nicole'],
    
    // Apple Cash (Zach) flow
    ['Apple Cash (Zach)', 1, 'Customer', 'Zach Apple Cash', 'Auto'],
    ['Apple Cash (Zach)', 2, 'Zach Apple Cash', 'Nicole Apple Cash', 'Zach'],
    ['Apple Cash (Zach)', 3, 'Nicole Apple Cash', 'SoFi Savings', 'Nicole'],
    ['Apple Cash (Zach)', 4, 'SoFi Savings', 'San Jose Sneakers Vault', 'Marc/Nicole'],
    
    // Depop flow
    ['Depop', 1, 'Customer', 'Depop Account', 'Auto'],
    ['Depop', 2, 'Depop Account', 'SoFi Savings', 'Auto'],
    ['Depop', 3, 'SoFi Savings', 'San Jose Sneakers Vault', 'Marc/Nicole']
  ];
  flowsSheet.getRange(2, 1, defaultFlows.length, flowHeaders.length).setValues(defaultFlows);
  
  // Update Sales sheet to include Payment Method column if not present
  var salesSheet = ss.getSheetByName('Sales');
  if (salesSheet) {
    var lastCol = salesSheet.getLastColumn();
    var headers = salesSheet.getRange(1, 1, 1, lastCol).getValues()[0];
    if (headers.indexOf('Payment Method') === -1) {
      salesSheet.getRange(1, lastCol + 1).setValue('Payment Method').setFontWeight('bold');
    }
  }
  
  Logger.log('Money flow sheets initialized successfully');
  return 'Money flow sheets created and initialized!';
}

/**
 * Get payment method flow steps
 */
function getPaymentMethodFlow(paymentMethod) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var flowsSheet = ss.getSheetByName('PaymentMethodFlows');
  
  if (!flowsSheet) {
    throw new Error('PaymentMethodFlows sheet not found. Run initializeMoneyFlowSheets() first.');
  }
  
  var lastRow = flowsSheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }
  
  var data = flowsSheet.getRange(2, 1, lastRow - 1, 5).getValues();
  var flows = [];
  
  data.forEach(function(row) {
    if (row[0] === paymentMethod) {
      flows.push({
        paymentMethod: row[0],
        stepNumber: row[1],
        fromLocation: row[2],
        toLocation: row[3],
        responsibleParty: row[4]
      });
    }
  });
  
  flows.sort(function(a, b) {
    return a.stepNumber - b.stepNumber;
  });
  
  return flows;
}

/**
 * Create money flow entries when a sale is recorded
 */
function createMoneyFlowEntries(saleId, amount, paymentMethod, dateSold) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var moneyFlowSheet = ss.getSheetByName('MoneyFlow');
  
  if (!moneyFlowSheet) {
    Logger.log('MoneyFlow sheet not found. Skipping money flow creation.');
    return;
  }
  
  var flows = getPaymentMethodFlow(paymentMethod);
  
  if (flows.length === 0) {
    Logger.log('No flow defined for payment method: ' + paymentMethod);
    return;
  }
  
  var timestamp = new Date();
  var rows = [];
  
  flows.forEach(function(flow, index) {
    var transferId = saleId + '-T' + (index + 1);
    var status = (flow.responsibleParty === 'Auto') ? 'Completed' : 'Pending';
    var completedDate = status === 'Completed' ? timestamp : '';
    var completedBy = status === 'Completed' ? flow.responsibleParty : '';
    
    rows.push([
      transferId,
      saleId,
      amount,
      dateSold || timestamp,
      flow.fromLocation,
      flow.toLocation,
      status,
      completedDate,
      completedBy,
      'Auto-generated from sale'
    ]);
  });
  
  if (rows.length > 0) {
    var startRow = moneyFlowSheet.getLastRow() + 1;
    moneyFlowSheet.getRange(startRow, 1, rows.length, 10).setValues(rows);
    moneyFlowSheet.getRange(startRow, 3, rows.length, 1).setNumberFormat('$#,##0.00');
    moneyFlowSheet.getRange(startRow, 4, rows.length, 1).setNumberFormat('M/d/yyyy');
    moneyFlowSheet.getRange(startRow, 8, rows.length, 1).setNumberFormat('M/d/yyyy h:mm');
    
    Logger.log('Created ' + rows.length + ' money flow entries for sale: ' + saleId);
  }
}

/**
 * Get money dashboard data
 */
function getMoneyDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var moneyFlowSheet = ss.getSheetByName('MoneyFlow');
  
  if (!moneyFlowSheet) {
    throw new Error('MoneyFlow sheet not found. Run initializeMoneyFlowSheets() first.');
  }
  
  var lastRow = moneyFlowSheet.getLastRow();
  if (lastRow < 2) {
    return {
      balances: {},
      pendingTransfers: [],
      completedTransfers: [],
      totalInTransit: 0,
      totalInVault: 0
    };
  }
  
  // Get payment flows to determine responsible parties
  var flowsSheet = ss.getSheetByName('PaymentMethodFlows');
  var flowsMap = {};
  if (flowsSheet) {
    var flowsLastRow = flowsSheet.getLastRow();
    if (flowsLastRow > 1) {
      var flowsData = flowsSheet.getRange(2, 1, flowsLastRow - 1, 5).getValues();
      flowsData.forEach(function(row) {
        var key = row[2] + '→' + row[3]; // fromLocation→toLocation
        flowsMap[key] = row[4]; // responsibleParty
      });
    }
  }
  
  var data = moneyFlowSheet.getRange(2, 1, lastRow - 1, 10).getValues();
  var balances = {};
  var pendingTransfers = [];
  var completedTransfers = [];
  var totalInVault = 0;
  
  // Track the first pending transfer for each sale (for "To Do Now" vs "To Do Later")
  var saleFirstPending = {}; // Map of saleId -> first pending transfer ID
  
  // First pass: find the first pending transfer for each sale
  data.forEach(function(row) {
    var transferId = row[0];
    var saleId = row[1];
    var status = row[6];
    
    if (status === 'Pending' && !saleFirstPending[saleId]) {
      saleFirstPending[saleId] = transferId;
    }
  });
  
  // Second pass: process all transfers
  data.forEach(function(row) {
    var transferId = row[0];
    var saleId = row[1];
    var amount = row[2];
    var date = row[3];
    var sourceLocation = row[4];
    var destinationLocation = row[5];
    var status = row[6];
    var completedDate = row[7];
    var completedBy = row[8];
    var notes = row[9];
    
    // Look up responsible party from flows
    var flowKey = sourceLocation + '→' + destinationLocation;
    var responsibleParty = flowsMap[flowKey] || completedBy || 'Unknown';
    
    // Determine if this is the next actionable transfer for this sale
    var isActionable = (status === 'Pending' && saleFirstPending[saleId] === transferId);
    
    var transfer = {
      transferId: transferId,
      saleId: saleId,
      amount: amount,
      date: date ? date.toISOString() : null,
      sourceLocation: sourceLocation,
      destinationLocation: destinationLocation,
      status: status,
      completedDate: completedDate ? completedDate.toISOString() : null,
      completedBy: completedBy,
      responsibleParty: responsibleParty,
      isActionable: isActionable,
      notes: notes
    };
    
    if (status === 'Completed') {
      completedTransfers.push(transfer);
      // Update balances for completed transfers
      if (!balances[destinationLocation]) {
        balances[destinationLocation] = 0;
      }
      balances[destinationLocation] += amount;
      
      // Track money that left a location
      if (!balances[sourceLocation]) {
        balances[sourceLocation] = 0;
      }
      if (sourceLocation !== 'Customer' && sourceLocation !== 'Opening Balance' && 
          sourceLocation !== 'Manual Adjustment (Credit)' && sourceLocation !== 'Manual Adjustment (Debit)') {
        balances[sourceLocation] -= amount;
      }
      
      // Track vault total
      if (destinationLocation === 'San Jose Sneakers Vault') {
        totalInVault += amount;
      }
    } else {
      // For pending transfers, just add to the list - don't modify balances
      // The money is already at the destination of the last completed transfer
      pendingTransfers.push(transfer);
    }
  });
  
  // Calculate total in transit
  var totalInTransit = pendingTransfers.reduce(function(sum, transfer) {
    return sum + transfer.amount;
  }, 0);
  
  return {
    balances: balances,
    pendingTransfers: pendingTransfers,
    completedTransfers: completedTransfers,
    totalInTransit: totalInTransit,
    totalInVault: totalInVault
  };
}

/**
 * Mark a transfer as complete
 */
function markTransferComplete(transferId, completedBy) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var moneyFlowSheet = ss.getSheetByName('MoneyFlow');
  
  if (!moneyFlowSheet) {
    throw new Error('MoneyFlow sheet not found');
  }
  
  var lastRow = moneyFlowSheet.getLastRow();
  if (lastRow < 2) {
    throw new Error('No transfers found');
  }
  
  var data = moneyFlowSheet.getRange(2, 1, lastRow - 1, 10).getValues();
  var rowIndex = -1;
  
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === transferId) {
      rowIndex = i + 2; // +2 because array is 0-indexed and sheet starts at row 2
      break;
    }
  }
  
  if (rowIndex === -1) {
    throw new Error('Transfer not found: ' + transferId);
  }
  
  var currentStatus = data[rowIndex - 2][6];
  if (currentStatus === 'Completed') {
    throw new Error('Transfer already completed');
  }
  
  var completedDate = new Date();
  moneyFlowSheet.getRange(rowIndex, 7).setValue('Completed');
  moneyFlowSheet.getRange(rowIndex, 8).setValue(completedDate).setNumberFormat('M/d/yyyy h:mm');
  moneyFlowSheet.getRange(rowIndex, 9).setValue(completedBy || 'Unknown');
  
  Logger.log('Transfer marked complete: ' + transferId);
  
  return {
    transferId: transferId,
    status: 'Completed',
    completedDate: completedDate.toISOString(),
    completedBy: completedBy
  };
}

/**
 * Get transfer history with optional filters
 */
function getTransferHistory(filters) {
  filters = filters || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var moneyFlowSheet = ss.getSheetByName('MoneyFlow');
  
  if (!moneyFlowSheet) {
    throw new Error('MoneyFlow sheet not found');
  }
  
  var lastRow = moneyFlowSheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }
  
  var data = moneyFlowSheet.getRange(2, 1, lastRow - 1, 10).getValues();
  var transfers = [];
  
  data.forEach(function(row) {
    var transfer = {
      transferId: row[0],
      saleId: row[1],
      amount: row[2],
      date: row[3] ? row[3].toISOString() : null,
      sourceLocation: row[4],
      destinationLocation: row[5],
      status: row[6],
      completedDate: row[7] ? row[7].toISOString() : null,
      completedBy: row[8],
      notes: row[9]
    };
    
    // Apply filters
    var include = true;
    
    if (filters.status && transfer.status !== filters.status) {
      include = false;
    }
    
    if (filters.location) {
      if (transfer.sourceLocation !== filters.location && 
          transfer.destinationLocation !== filters.location) {
        include = false;
      }
    }
    
    if (filters.responsibleParty && transfer.completedBy !== filters.responsibleParty) {
      include = false;
    }
    
    if (include) {
      transfers.push(transfer);
    }
  });
  
  return transfers;
}

/**
 * Get inventory categories (unique categories from Inventory sheet)
 */
function getInventoryCategories() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var inventorySheet = ss.getSheetByName('Inventory');
  
  if (!inventorySheet) {
    throw new Error('Inventory sheet not found');
  }
  
  var lastRow = inventorySheet.getLastRow();
  if (lastRow < 2) {
    return { categories: [], brands: [], sizes: [], colors: [], locations: [] };
  }
  
  var data = inventorySheet.getRange(2, 1, lastRow - 1, 11).getValues();
  var categories = {};
  var brands = {};
  var sizes = {};
  var colors = {};
  var locations = {};
  
  data.forEach(function(row) {
    if (row[0]) { // Has item ID
      if (row[2]) categories[row[2]] = true; // Category
      if (row[3]) brands[row[3]] = true;     // Brand
      if (row[4]) sizes[row[4]] = true;      // Size
      if (row[5]) colors[row[5]] = true;     // Color
      if (row[9]) locations[row[9]] = true;  // Location
    }
  });
  
  return {
    categories: Object.keys(categories).sort(),
    brands: Object.keys(brands).sort(),
    sizes: Object.keys(sizes).sort(),
    colors: Object.keys(colors).sort(),
    locations: Object.keys(locations).sort()
  };
}

/**
 * Get inventory summary - grouped count of items by category/brand/size/color
 */
function getInventorySummary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var inventorySheet = ss.getSheetByName('Inventory');
  
  if (!inventorySheet) {
    throw new Error('Inventory sheet not found');
  }
  
  var lastRow = inventorySheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }
  
  var data = inventorySheet.getRange(2, 1, lastRow - 1, 11).getValues();
  var summary = {};
  
  data.forEach(function(row) {
    var itemId = row[0];
    var status = row[8];
    
    // Only count in-stock items
    if (itemId && status === 'In Stock') {
      var category = row[2] || 'Unknown';
      var brand = row[3] || 'Unknown';
      var size = row[4] || 'Unknown';
      var color = row[5] || 'Unknown';
      
      // Create a unique key for this item type
      var key = category + '|' + brand + '|' + size + '|' + color;
      
      if (!summary[key]) {
        summary[key] = {
          category: category,
          brand: brand,
          size: size,
          color: color,
          quantity: 0,
          totalCost: 0
        };
      }
      
      summary[key].quantity += 1;
      summary[key].totalCost += row[6] || 0;
    }
  });
  
  // Convert to array and sort
  var summaryArray = Object.keys(summary).map(function(key) {
    var item = summary[key];
    item.avgCost = item.quantity > 0 ? item.totalCost / item.quantity : 0;
    return item;
  });
  
  summaryArray.sort(function(a, b) {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if (a.brand !== b.brand) return a.brand.localeCompare(b.brand);
    if (a.size !== b.size) return String(a.size).localeCompare(String(b.size));
    return a.color.localeCompare(b.color);
  });
  
  return summaryArray;
}

/**
 * Generate the next Item ID
 */
function generateItemId() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var inventorySheet = ss.getSheetByName('Inventory');
  
  if (!inventorySheet) {
    throw new Error('Inventory sheet not found');
  }
  
  var lastRow = inventorySheet.getLastRow();
  
  // Start with SJ-001 if no items exist
  if (lastRow < 2) {
    return 'SJ-001';
  }
  
  // Get all existing item IDs
  var data = inventorySheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var maxNumber = 0;
  
  data.forEach(function(row) {
    var itemId = row[0];
    if (itemId && typeof itemId === 'string' && itemId.startsWith('SJ-')) {
      var numPart = itemId.substring(3);
      var num = parseInt(numPart);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  });
  
  // Return next number with zero-padding
  var nextNumber = maxNumber + 1;
  return 'SJ-' + String(nextNumber).padStart(3, '0');
}

/**
 * Add a new inventory item
 */
function addInventoryItem(itemData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var inventorySheet = ss.getSheetByName('Inventory');
  
  if (!inventorySheet) {
    throw new Error('Inventory sheet not found');
  }
  
  // Validate required fields
  if (!itemData.category) throw new Error('Category is required');
  if (!itemData.brand) throw new Error('Brand is required');
  if (!itemData.size) throw new Error('Size is required');
  if (!itemData.color) throw new Error('Color is required');
  if (itemData.cost === undefined || itemData.cost === null) throw new Error('Cost is required');
  
  // Generate Item ID
  var itemId = generateItemId();
  
  // Parse date
  var datePurchased = itemData.datePurchased 
    ? (typeof itemData.datePurchased === 'string' ? new Date(itemData.datePurchased) : itemData.datePurchased)
    : new Date();
  
  // Get quantity (default to 1)
  var quantity = itemData.quantity || 1;
  
  // Prepare rows for all items
  var rows = [];
  for (var i = 0; i < quantity; i++) {
    var currentItemId = itemId;
    if (quantity > 1) {
      // For multiple items, append a suffix: SJ-001-1, SJ-001-2, etc.
      currentItemId = itemId + '-' + (i + 1);
    }
    
    rows.push([
      currentItemId,                    // Item ID
      itemData.upc || '',               // UPC
      itemData.category,                // Category
      itemData.brand,                   // Brand
      itemData.size,                    // Size
      itemData.color,                   // Color
      itemData.cost,                    // Cost
      datePurchased,                    // Date Purchased
      'In Stock',                       // Status
      itemData.location || '',          // Location
      itemData.notes || ''              // Notes
    ]);
  }
  
  // Append all rows
  var startRow = inventorySheet.getLastRow() + 1;
  inventorySheet.getRange(startRow, 1, rows.length, 11).setValues(rows);
  
  // Format columns
  inventorySheet.getRange(startRow, 7, rows.length, 1).setNumberFormat('$#,##0.00'); // Cost
  inventorySheet.getRange(startRow, 8, rows.length, 1).setNumberFormat('M/d/yyyy');  // Date
  
  Logger.log('Added ' + quantity + ' inventory item(s) with base ID: ' + itemId);
  
  return {
    itemId: itemId,
    itemCount: quantity,
    itemIds: rows.map(function(row) { return row[0]; })
  };
}

/**
 * Get HTML documentation
 */
function getApiDocumentationHTML() {
  var apiUrl = ScriptApp.getService().getUrl();
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sales Management API Documentation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        h1 { font-size: 2.5em; margin-bottom: 10px; }
        .subtitle { font-size: 1.2em; opacity: 0.9; }
        .section {
            background: white;
            padding: 30px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h2 {
            color: #667eea;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #f0f0f0;
        }
        h3 { color: #555; margin: 20px 0 10px; }
        .endpoint {
            background: #f9f9f9;
            padding: 20px;
            border-radius: 6px;
            margin: 15px 0;
            border-left: 4px solid #667eea;
        }
        .method {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 0.9em;
            margin-right: 10px;
        }
        .method-get { background: #61affe; color: white; }
        .method-post { background: #49cc90; color: white; }
        .url {
            font-family: 'Courier New', monospace;
            background: #2d2d2d;
            color: #f8f8f2;
            padding: 12px;
            border-radius: 4px;
            overflow-x: auto;
            margin: 10px 0;
        }
        .param {
            background: #fff;
            padding: 10px;
            margin: 5px 0;
            border-left: 3px solid #ddd;
        }
        .required { color: #e74c3c; font-weight: bold; }
        .optional { color: #95a5a6; }
        code {
            background: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }
        pre {
            background: #2d2d2d;
            color: #f8f8f2;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            margin: 10px 0;
        }
        .status-code {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 3px;
            font-weight: bold;
            font-size: 0.85em;
        }
        .status-200 { background: #d4edda; color: #155724; }
        .status-201 { background: #d4edda; color: #155724; }
        .status-400 { background: #f8d7da; color: #721c24; }
        .status-404 { background: #f8d7da; color: #721c24; }
        .status-422 { background: #fff3cd; color: #856404; }
        .status-500 { background: #f8d7da; color: #721c24; }
        .info-box {
            background: #e7f3ff;
            border-left: 4px solid #2196F3;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
        }
        .api-url-box {
            background: #fff;
            padding: 15px;
            border-radius: 6px;
            border: 2px solid #667eea;
            margin: 20px 0;
        }
        .api-url-box input {
            width: 100%;
            padding: 10px;
            font-family: 'Courier New', monospace;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>📊 Sales Management API</h1>
            <p class="subtitle">RESTful API for Sneaker Inventory & Sales Management</p>
        </header>

        <div class="api-url-box">
            <h3>Your API Base URL:</h3>
            <input type="text" value="${apiUrl}" readonly onclick="this.select()">
            <p style="margin-top: 10px; color: #666; font-size: 14px;">
                Click to select and copy. This is your deployed API endpoint.
            </p>
        </div>

        <div class="section">
            <h2>Quick Start</h2>
            <div class="info-box">
                <strong>💡 Tip:</strong> Add <code>?format=json</code> to this URL to get the OpenAPI specification in JSON format.
            </div>
            
            <h3>Basic Usage</h3>
            <pre>// Get all in-stock items
fetch('${apiUrl}?resource=items')
  .then(res => res.json())
  .then(data => console.log(data));

// Get specific item
fetch('${apiUrl}?resource=items&id=SJ-001')
  .then(res => res.json())
  .then(data => console.log(data));</pre>
        </div>

        <div class="section">
            <h2>Endpoints</h2>

            <div class="endpoint">
                <span class="method method-get">GET</span>
                <strong>API Documentation</strong>
                <div class="url">GET ${apiUrl}</div>
                <p>Returns this documentation page (HTML) or OpenAPI spec (JSON with ?format=json)</p>
                <div class="param">
                    <strong>format</strong> <span class="optional">(optional)</span> - 
                    Response format: <code>html</code> (default) or <code>json</code>
                </div>
            </div>

            <div class="endpoint">
                <span class="method method-get">GET</span>
                <strong>List In-Stock Items</strong>
                <div class="url">GET ${apiUrl}?resource=items</div>
                <p>Fetch all items currently in stock, sorted by category, brand, and size.</p>
                <h4>Response: <span class="status-code status-200">200 OK</span></h4>
                <pre>{
  "success": true,
  "data": [
    {
      "itemId": "SJ-001",
      "upc": "123456789012",
      "category": "Sneakers",
      "brand": "Nike",
      "size": "10",
      "color": "Black/White",
      "cost": 120.00,
      "datePurchased": "2025-01-15T00:00:00.000Z",
      "status": "In Stock",
      "location": "Shelf A",
      "notes": "Limited edition"
    }
  ],
  "timestamp": "2025-12-31T12:00:00.000Z"
}</pre>
            </div>

            <div class="endpoint">
                <span class="method method-get">GET</span>
                <strong>Get Specific Item</strong>
                <div class="url">GET ${apiUrl}?resource=items&id={itemId}</div>
                <p>Fetch details for a specific item by its ID.</p>
                <div class="param">
                    <strong>id</strong> <span class="required">(required)</span> - 
                    The item ID to fetch (e.g., <code>SJ-001</code>)
                </div>
                <h4>Response: <span class="status-code status-200">200 OK</span> or <span class="status-code status-404">404 Not Found</span></h4>
            </div>

            <div class="endpoint">
                <span class="method method-get">GET</span>
                <strong>Get Statistics</strong>
                <div class="url">GET ${apiUrl}?resource=stats</div>
                <p>Get summary statistics about inventory and sales.</p>
                <h4>Response: <span class="status-code status-200">200 OK</span></h4>
                <pre>{
  "success": true,
  "data": {
    "inStock": 45,
    "sold": 23,
    "totalSales": 3450.00,
    "salesCount": 23,
    "avgSalePrice": 150.00
  },
  "timestamp": "2025-12-31T12:00:00.000Z"
}</pre>
            </div>

            <div class="endpoint">
                <span class="method method-post">POST</span>
                <strong>Record Sale</strong>
                <div class="url">POST ${apiUrl}?resource=sales</div>
                <p>Record a single sale transaction.</p>
                <h4>Request Body:</h4>
                <pre>{
  "itemId": "SJ-001",
  "salePrice": 150.00,
  "dateSold": "2025-12-31",
  "soldBy": "John Doe",
  "buyer": "Jane Smith",
  "platform": "In Person",
  "shippingStatus": "Picked Up",
  "trackingNumber": "",
  "notes": "Paid in cash"
}</pre>
                <h4>Required Fields:</h4>
                <div class="param"><strong>itemId</strong> <span class="required">*</span> - Item ID from inventory</div>
                <div class="param"><strong>salePrice</strong> <span class="required">*</span> - Sale price (number)</div>
                <div class="param"><strong>dateSold</strong> <span class="required">*</span> - Date sold (YYYY-MM-DD)</div>
                <div class="param"><strong>soldBy</strong> <span class="required">*</span> - Seller name</div>
                <div class="param"><strong>platform</strong> <span class="required">*</span> - Sales platform</div>
                <div class="param"><strong>shippingStatus</strong> <span class="required">*</span> - Shipping status</div>
                <h4>Responses:</h4>
                <p><span class="status-code status-201">201 Created</span> - Item added to order</p>
                <p><span class="status-code status-400">400 Bad Request</span> - Missing required fields</p>
                <p><span class="status-code status-422">422 Unprocessable Entity</span> - Item not in stock or not found</p>
            </div>

            <div class="endpoint">
                <span class="method method-post">POST</span>
                <strong>Record Bulk Sale</strong>
                <div class="url">POST ${apiUrl}?resource=sales&bulk=true</div>
                <p>Record multiple items sold to the same buyer. Total price is distributed evenly.</p>
                <h4>Request Body:</h4>
                <pre>{
  "items": ["SJ-001", "SJ-002", "SJ-003"],
  "salePrice": 450.00,
  "dateSold": "2025-12-31",
  "soldBy": "John Doe",
  "buyer": "Jane Smith",
  "platform": "In Person",
  "shippingStatus": "Picked Up",
  "notes": "Bulk discount applied"
}</pre>
                <h4>Required Fields:</h4>
                <div class="param"><strong>items</strong> <span class="required">*</span> - Array of item IDs</div>
                <div class="param"><strong>salePrice</strong> <span class="required">*</span> - Total sale price</div>
                <div class="param"><strong>buyer</strong> <span class="required">*</span> - Buyer name (required for bulk)</div>
                <p style="margin-top: 10px;"><em>Plus all other required fields from single sale</em></p>
            </div>
        </div>

        <div class="section">
            <h2>HTTP Status Codes</h2>
            <div class="param"><span class="status-code status-200">200 OK</span> - Successful GET request</div>
            <div class="param"><span class="status-code status-201">201 Created</span> - Sale created successfully</div>
            <div class="param"><span class="status-code status-400">400 Bad Request</span> - Validation error or missing required fields</div>
            <div class="param"><span class="status-code status-404">404 Not Found</span> - Resource or item not found</div>
            <div class="param"><span class="status-code status-422">422 Unprocessable Entity</span> - Item not in stock</div>
            <div class="param"><span class="status-code status-500">500 Internal Server Error</span> - Server or spreadsheet error</div>
        </div>

        <div class="section">
            <h2>Response Format</h2>
            <h3>Success Response</h3>
            <pre>{
  "success": true,
  "data": { ... },
  "timestamp": "2025-12-31T12:00:00.000Z"
}</pre>
            <h3>Error Response</h3>
            <pre>{
  "success": false,
  "error": "Error message here",
  "statusCode": 400,
  "timestamp": "2025-12-31T12:00:00.000Z"
}</pre>
        </div>

        <div class="section">
            <h2>Testing the API</h2>
            <p>You can test the API using:</p>
            <h3>1. Your Browser</h3>
            <p>Navigate to: <code>${apiUrl}?resource=stats</code></p>
            
            <h3>2. cURL</h3>
            <pre># Get items
curl "${apiUrl}?resource=items"

# Get specific item
curl "${apiUrl}?resource=items&id=SJ-001"

# Record sale
curl -X POST "${apiUrl}?resource=sales" \\
  -H "Content-Type: application/json" \\
  -d '{
    "itemId": "SJ-001",
    "salePrice": 150.00,
    "dateSold": "2025-12-31",
    "soldBy": "John Doe",
    "platform": "In Person",
    "shippingStatus": "Picked Up"
  }'</pre>

            <h3>3. JavaScript/React</h3>
            <pre>const response = await fetch('${apiUrl}?resource=items');
const result = await response.json();
console.log(result.data);</pre>
        </div>

        <div class="section">
            <h2>Need Help?</h2>
            <p>For more details, request the OpenAPI specification:</p>
            <pre>curl "${apiUrl}?format=json"</pre>
            <p>Or view it in your browser: <a href="${apiUrl}?format=json" target="_blank">${apiUrl}?format=json</a></p>
        </div>
    </div>
</body>
</html>`;
}
