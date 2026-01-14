// Run this to add conditional formatting to Inventory tab
// Sold items will show with strikethrough + gray text

function addSoldItemFormatting() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var inventorySheet = ss.getSheetByName("Inventory");
  
  if (!inventorySheet) {
    Logger.log('Error: Inventory sheet not found');
    return;
  }
  
  // Get the range for the entire inventory data (rows 2 onwards, columns A-K)
  var lastRow = Math.max(inventorySheet.getLastRow(), 100); // At least 100 rows
  var dataRange = inventorySheet.getRange(2, 1, lastRow - 1, 11);
  
  // Clear any existing conditional format rules (optional - comment out if you want to keep other rules)
  var existingRules = inventorySheet.getConditionalFormatRules();
  var filteredRules = [];
  for (var i = 0; i < existingRules.length; i++) {
    // Keep rules that don't affect our data range (if any)
    var ruleRanges = existingRules[i].getRanges();
    var keepRule = true;
    for (var j = 0; j < ruleRanges.length; j++) {
      if (ruleRanges[j].getRow() >= 2) {
        keepRule = false;
        break;
      }
    }
    if (keepRule) {
      filteredRules.push(existingRules[i]);
    }
  }
  
  // Create the conditional formatting rule
  // When column I (Status) = "Sold", apply formatting to the entire row
  var rule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$I2="Sold"')  // Check Status column (I)
    .setRanges([dataRange])
    .setFontColor('#999999')  // Gray text
    .setStrikethrough(true)   // Strikethrough
    .build();
  
  filteredRules.push(rule);
  inventorySheet.setConditionalFormatRules(filteredRules);
  
  Logger.log('Conditional formatting added!');
  Logger.log('Sold items will now show with strikethrough and gray text');
  
  // Show confirmation
  var ui = SpreadsheetApp.getUi();
  ui.alert('Formatting Added!',
           'Sold items in the Inventory tab will now display with:\n\n' +
           '• Strikethrough text\n' +
           '• Gray color\n\n' +
           'This updates automatically when Status changes to "Sold"',
           ui.ButtonSet.OK);
}

// Alternative: Add a red background instead of strikethrough
function addSoldItemFormattingWithBackground() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var inventorySheet = ss.getSheetByName("Inventory");
  
  if (!inventorySheet) {
    Logger.log('Error: Inventory sheet not found');
    return;
  }
  
  var lastRow = Math.max(inventorySheet.getLastRow(), 100);
  var dataRange = inventorySheet.getRange(2, 1, lastRow - 1, 11);
  
  // Clear existing rules on data rows
  var existingRules = inventorySheet.getConditionalFormatRules();
  var filteredRules = [];
  for (var i = 0; i < existingRules.length; i++) {
    var ruleRanges = existingRules[i].getRanges();
    var keepRule = true;
    for (var j = 0; j < ruleRanges.length; j++) {
      if (ruleRanges[j].getRow() >= 2) {
        keepRule = false;
        break;
      }
    }
    if (keepRule) {
      filteredRules.push(existingRules[i]);
    }
  }
  
  // Light red background for sold items
  var rule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$I2="Sold"')
    .setRanges([dataRange])
    .setBackground('#f4cccc')  // Light red
    .setFontColor('#666666')   // Dark gray text
    .build();
  
  filteredRules.push(rule);
  inventorySheet.setConditionalFormatRules(filteredRules);
  
  Logger.log('Conditional formatting added with background color!');
  
  var ui = SpreadsheetApp.getUi();
  ui.alert('Formatting Added!',
           'Sold items will now show with a light red background.',
           ui.ButtonSet.OK);
}

// Alternative: Green highlight for In Stock items
function addInStockHighlight() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var inventorySheet = ss.getSheetByName("Inventory");
  
  if (!inventorySheet) {
    Logger.log('Error: Inventory sheet not found');
    return;
  }
  
  var lastRow = Math.max(inventorySheet.getLastRow(), 100);
  var dataRange = inventorySheet.getRange(2, 1, lastRow - 1, 11);
  
  var existingRules = inventorySheet.getConditionalFormatRules();
  
  // Green highlight for In Stock
  var inStockRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$I2="In Stock"')
    .setRanges([dataRange])
    .setBackground('#d9ead3')  // Light green
    .build();
  
  // Gray strikethrough for Sold
  var soldRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$I2="Sold"')
    .setRanges([dataRange])
    .setBackground('#f4cccc')  // Light red
    .setFontColor('#999999')   // Gray
    .setStrikethrough(true)
    .build();
  
  existingRules.push(inStockRule);
  existingRules.push(soldRule);
  inventorySheet.setConditionalFormatRules(existingRules);
  
  Logger.log('Both In Stock and Sold formatting added!');
  
  var ui = SpreadsheetApp.getUi();
  ui.alert('Formatting Added!',
           'In Stock items: Light green background\n' +
           'Sold items: Light red background + strikethrough + gray text',
           ui.ButtonSet.OK);
}

