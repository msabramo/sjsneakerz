function onFormSubmit(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var formSheet = ss.getSheetByName("Form Responses 1");
  var inventorySheet = ss.getSheetByName("Inventory");
  
  var formLastRow = formSheet.getLastRow();
  if (formLastRow <= 1) return;
  
  var lastCol = formSheet.getLastColumn();
  var formData = formSheet.getRange(formLastRow, 1, 1, lastCol).getValues()[0];
  var headers = formSheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
  // Function to find column value by name (case-insensitive, partial match)
  function getColumnValue(columnName) {
    for (var i = 0; i < headers.length; i++) {
      var header = headers[i].toString().toLowerCase().trim();
      var search = columnName.toLowerCase().trim();
      if (header === search || header.indexOf(search) >= 0) {
        return formData[i];
      }
    }
    return "";
  }
  
  var timestamp = formData[0];
  var email = getColumnValue("Email") || formData[1];
  var upc = getColumnValue("UPC");
  var category = getColumnValue("Category");
  var brand = getColumnValue("Brand");
  var size = getColumnValue("Size");
  
  // Find Color from any color column
  var color = "";
  for (var i = 0; i < headers.length; i++) {
    var header = headers[i].toString().toLowerCase();
    if (header.indexOf("color") >= 0 && formData[i]) {
      color = formData[i];
      break;
    }
  }
  
  var cost = getColumnValue("Cost");
  var datePurchased = getColumnValue("Date");
  if (!datePurchased) {
    datePurchased = getColumnValue("Date Purchased");
  }
  var location = getColumnValue("Location");
  var notes = getColumnValue("Notes");
  var quantity = getColumnValue("Quantity") || 1; // Default to 1 if not specified
  
  // Make sure quantity is a number
  quantity = parseInt(quantity);
  if (isNaN(quantity) || quantity < 1) {
    quantity = 1;
  }
  
  var dateStr = datePurchased;
  if (datePurchased instanceof Date) {
    dateStr = Utilities.formatDate(datePurchased, Session.getScriptTimeZone(), "MM/dd/yyyy");
  }
  
  // Add "Added By" info to notes if email exists
  var notesWithEmail = (notes || "");
  if (email && email !== "") {
    notesWithEmail += " [Added by: " + email + "]";
  }
  
  // Add quantity info to notes if > 1
  if (quantity > 1) {
    notesWithEmail += " [Qty: " + quantity + "]";
  }
  
  // Get the starting row for inventory
  var inventoryLastRow = inventorySheet.getLastRow();
  var startRow = inventoryLastRow + 1;
  
  // Create an array to hold all rows
  var rowsToAdd = [];
  
  // Create multiple rows based on quantity
  for (var q = 0; q < quantity; q++) {
    var currentRow = startRow + q;
    var itemId = category + "-" + brand + "-" + size + "-" + color + "-" + currentRow;
    
    var inventoryRow = [
      itemId,           // A: Item ID (unique for each)
      upc,              // B: UPC
      category,         // C: Category
      brand,            // D: Brand
      size,             // E: Size
      color,            // F: Color
      cost,             // G: Cost
      dateStr,          // H: Date Purchased
      "",               // I: Status (formula will calculate)
      location,         // J: Location
      notesWithEmail    // K: Notes
    ];
    
    rowsToAdd.push(inventoryRow);
  }
  
  // Write all rows at once
  inventorySheet.getRange(startRow, 1, rowsToAdd.length, 11).setValues(rowsToAdd);
  
  // Copy the Status formula to all new rows
  var statusFormula = inventorySheet.getRange(2, 9).getFormula();
  if (statusFormula) {
    for (var q = 0; q < quantity; q++) {
      var currentRow = startRow + q;
      var newFormula = statusFormula.replace(/A2/g, "A" + currentRow);
      inventorySheet.getRange(currentRow, 9).setFormula(newFormula);
    }
  }
  
  Logger.log("Added " + quantity + " item(s) starting at row " + startRow);
}

