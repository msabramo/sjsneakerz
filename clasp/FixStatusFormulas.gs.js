// Run this ONCE to fix Status formulas in the Inventory tab
// Paste into Apps Script and run

function fixStatusFormulas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var inventorySheet = ss.getSheetByName("Inventory");
  
  if (!inventorySheet) {
    Logger.log('Error: Inventory sheet not found');
    return;
  }
  
  var lastRow = inventorySheet.getLastRow();
  
  if (lastRow < 2) {
    Logger.log('No data rows to fix');
    return;
  }
  
  // Set the Status formula for row 2
  var formula = '=IF(A2="", "", IF(COUNTIF(Sales!$A:$A, A2) > 0, "Sold", "In Stock"))';
  inventorySheet.getRange(2, 9).setFormula(formula);
  Logger.log('Set formula in row 2');
  
  // Copy formula down to all rows with data
  if (lastRow > 2) {
    for (var row = 3; row <= lastRow; row++) {
      // Check if row has an Item ID (column A)
      var itemId = inventorySheet.getRange(row, 1).getValue();
      if (itemId) {
        var rowFormula = '=IF(A' + row + '="", "", IF(COUNTIF(Sales!$A:$A, A' + row + ') > 0, "Sold", "In Stock"))';
        inventorySheet.getRange(row, 9).setFormula(rowFormula);
      }
    }
    Logger.log('Copied formula to rows 3-' + lastRow);
  }
  
  Logger.log('Status formulas fixed! All items should now show correct status.');
  
  // Show results
  var ui = SpreadsheetApp.getUi();
  ui.alert('Status Formulas Fixed!',
           'All ' + (lastRow - 1) + ' inventory items now have Status formulas.\n\n' +
           'Items not in Sales will show "In Stock"\n' +
           'Items in Sales will show "Sold"',
           ui.ButtonSet.OK);
}

