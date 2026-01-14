/**
 * Initialize Money Flow Tracking System
 * 
 * NOTE: This file gets copied into Apps Script as MoneyFlowInitializer.gs
 * 
 * This script sets up the necessary sheets and data structures for the money flow tracking system.
 * 
 * To use:
 * 1. Open your Google Sheets spreadsheet
 * 2. Go to Extensions > Apps Script
 * 3. Copy and paste this code into the editor
 * 4. Run the initializeMoneyFlowSheets function
 * 
 * This will create:
 * - MoneyFlow tab: Tracks all money transfers
 * - PaymentLocations tab: Defines all account locations
 * - PaymentMethodFlows tab: Defines transfer paths for each payment method
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
  
  // Show success message if UI is available (when run from menu)
  // Skip if running directly from script editor
  try {
    SpreadsheetApp.getUi().alert(
      'Success!', 
      'Money flow sheets created and initialized!\n\nNew sheets:\n- MoneyFlow\n- PaymentLocations\n- PaymentMethodFlows', 
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {
    // Running from script editor - UI not available, which is fine
    Logger.log('Note: Running from script editor (no UI alert shown)');
  }
  
  return 'Money flow sheets created and initialized!';
}

// Add menu item to make it easy to run
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Money Tracking')
      .addItem('Initialize Money Flow Sheets', 'initializeMoneyFlowSheets')
      .addToUi();
}

