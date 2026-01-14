// Run this ONCE in your spreadsheet's Apps Script to create the sales form
// Extensions > Apps Script > New File > Paste this

function createSalesForm() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var formTitle = "Record Sale - " + ss.getName();
  
  // Create the form
  var form = FormApp.create(formTitle);
  
  // Store the form ID in the spreadsheet (for future updates)
  var scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty('SALES_FORM_ID', form.getId());
  
  // Set form description
  form.setDescription('Record a sale from your inventory. The item list is automatically updated.');
  form.setCollectEmail(true);
  form.setLimitOneResponsePerUser(false); // Allow multiple sales
  
  // Question 1: Item ID (Dropdown - will be populated)
  var itemQuestion = form.addListItem();
  itemQuestion.setTitle('Item')
    .setHelpText('Select the item being sold')
    .setRequired(true);
  
  // Question 2: Sale Price
  var priceQuestion = form.addTextItem();
  priceQuestion.setTitle('Sale Price')
    .setHelpText('Enter the sale price')
    .setRequired(true);
  
  // Question 3: Date Sold
  var dateQuestion = form.addDateItem();
  dateQuestion.setTitle('Date Sold')
    .setRequired(true);
  
  // Question 4: Sold By
  var soldByQuestion = form.addListItem();
  soldByQuestion.setTitle('Sold By')
    .setChoiceValues(['Zach', 'Adi'])
    .setRequired(true);
  
  // Question 5: Buyer
  var buyerQuestion = form.addTextItem();
  buyerQuestion.setTitle('Buyer')
    .setHelpText('Buyer name or username')
    .setRequired(false);
  
  // Question 6: Platform
  var platformQuestion = form.addListItem();
  platformQuestion.setTitle('Platform')
    .setChoiceValues(['Depop', 'eBay', 'local'])
    .setRequired(true);
  
  // Question 7: Shipping Status
  var shippingQuestion = form.addListItem();
  shippingQuestion.setTitle('Shipping Status')
    .setChoiceValues(['needs to ship', 'shipped', 'delivered', 'local pickup (no shipping)'])
    .setRequired(true);
  
  // Question 8: Tracking Number
  var trackingQuestion = form.addTextItem();
  trackingQuestion.setTitle('Tracking Number')
    .setHelpText('Optional - enter if available')
    .setRequired(false);
  
  // Question 9: Notes
  var notesQuestion = form.addParagraphTextItem();
  notesQuestion.setTitle('Notes')
    .setHelpText('Any additional details about the sale')
    .setRequired(false);
  
  // Link form to this spreadsheet
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  
  // Initial population of items
  updateSalesFormItems();
  
  Logger.log('Sales form created!');
  Logger.log('Form URL: ' + form.getPublishedUrl());
  Logger.log('Form Edit URL: ' + form.getEditUrl());
  
  // Show URLs to user
  var ui = SpreadsheetApp.getUi();
  ui.alert('Sales Form Created!',
           'Form URL: ' + form.getPublishedUrl() + '\n\n' +
           'Edit URL: ' + form.getEditUrl() + '\n\n' +
           'The form has been linked to this spreadsheet.',
           ui.ButtonSet.OK);
  
  return form.getId();
}

// Run this to update the form's item list with current "In Stock" inventory
function updateSalesFormItems() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var inventorySheet = ss.getSheetByName("Inventory");
  
  // Get the form ID
  var scriptProperties = PropertiesService.getScriptProperties();
  var formId = scriptProperties.getProperty('SALES_FORM_ID');
  
  if (!formId) {
    Logger.log('Error: Sales form not found. Run createSalesForm() first.');
    return;
  }
  
  var form = FormApp.openById(formId);
  
  // Get all items from inventory
  var data = inventorySheet.getRange(2, 1, inventorySheet.getLastRow() - 1, 11).getValues();
  
  var items = [];
  for (var i = 0; i < data.length; i++) {
    var itemId = data[i][0];      // Column A
    var category = data[i][2];    // Column C
    var brand = data[i][3];       // Column D
    var size = data[i][4];        // Column E
    var color = data[i][5];       // Column F
    var cost = data[i][6];        // Column G
    var status = data[i][8];      // Column I
    
    // Only include "In Stock" items with a valid Item ID
    if (itemId && status === "In Stock") {
      var description = itemId + " - " + category + " " + brand + " " + size + " " + color + " ($" + cost + " cost)";
      items.push(description);
    }
  }
  
  // Sort items alphabetically
  items.sort();
  
  // Find the "Item" question and update its choices
  var formItems = form.getItems();
  for (var i = 0; i < formItems.length; i++) {
    if (formItems[i].getType() === FormApp.ItemType.LIST) {
      var listItem = formItems[i].asListItem();
      if (listItem.getTitle() === 'Item') {
        listItem.setChoiceValues(items);
        Logger.log('Updated form with ' + items.length + ' in-stock items');
        break;
      }
    }
  }
  
  Logger.log('Form updated successfully!');
}

// Optional: Set up automatic updates (run every hour)
function setupAutoUpdate() {
  // Delete existing triggers
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'updateSalesFormItems') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  // Create new trigger to run every hour
  ScriptApp.newTrigger('updateSalesFormItems')
    .timeBased()
    .everyHours(1)
    .create();
  
  Logger.log('Auto-update trigger created - form will update every hour');
}

// Process sales form submissions
function onSalesFormSubmit(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var salesSheet = ss.getSheetByName("Sales");
  var salesFormSheet = ss.getSheetByName("Sales Form Responses"); // Or whatever it's called
  
  if (!salesFormSheet) {
    // Find the form responses sheet
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].getName().indexOf("Sales") >= 0 && sheets[i].getName().indexOf("Form") >= 0) {
        salesFormSheet = sheets[i];
        break;
      }
    }
  }
  
  if (!salesFormSheet) {
    Logger.log('Error: Could not find Sales Form Responses sheet');
    return;
  }
  
  var formLastRow = salesFormSheet.getLastRow();
  if (formLastRow <= 1) return;
  
  var lastCol = salesFormSheet.getLastColumn();
  var formData = salesFormSheet.getRange(formLastRow, 1, 1, lastCol).getValues()[0];
  var headers = salesFormSheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
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
  var email = formData[1];
  var itemDescription = getColumnValue("Item");
  
  // Extract Item ID from description (it's the first part before " - ")
  var itemId = itemDescription.split(" - ")[0];
  
  var salePrice = getColumnValue("Sale Price");
  var dateSold = getColumnValue("Date Sold");
  var soldBy = getColumnValue("Sold By");
  var buyer = getColumnValue("Buyer");
  var platform = getColumnValue("Platform");
  var shippingStatus = getColumnValue("Shipping Status");
  var trackingNumber = getColumnValue("Tracking");
  var notes = getColumnValue("Notes");
  
  // Format date
  var dateStr = dateSold;
  if (dateSold instanceof Date) {
    dateStr = Utilities.formatDate(dateSold, Session.getScriptTimeZone(), "MM/dd/yyyy");
  }
  
  // Add to notes who recorded the sale
  var notesWithEmail = (notes || "") + " [Recorded by: " + email + "]";
  
  // Find next row in Sales sheet
  var salesLastRow = salesSheet.getLastRow();
  var nextRow = salesLastRow + 1;
  
  // Sales columns: Item ID, Sale Price, Date Sold, Sold By, Buyer, Platform, Shipping Status, Tracking Number, Notes
  var salesRow = [
    itemId,           // A
    salePrice,        // B
    dateStr,          // C
    soldBy,           // D
    buyer,            // E
    platform,         // F
    shippingStatus,   // G
    trackingNumber,   // H
    notesWithEmail    // I
  ];
  
  salesSheet.getRange(nextRow, 1, 1, 9).setValues([salesRow]);
  
  Logger.log('Sale recorded: ' + itemId + ' for $' + salePrice);
  
  // Update the form items list (remove sold item)
  updateSalesFormItems();
}

