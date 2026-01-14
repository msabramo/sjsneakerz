/**
 * Set Initial Vault Balance
 * 
 * Use this function to set or adjust the San Jose Sneakers Vault balance
 * to match your actual SoFi account balance.
 * 
 * To use:
 * 1. Open your Google Sheets spreadsheet
 * 2. Go to Extensions > Apps Script
 * 3. Create a new file and paste this code
 * 4. Update the VAULT_BALANCE variable below
 * 5. Run the setInitialVaultBalance function
 */

function setInitialVaultBalance() {
  // ⚠️ UPDATE THIS VALUE to match your actual SoFi vault balance
  var VAULT_BALANCE = 2162.97; // Change this to your actual balance
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var moneyFlowSheet = ss.getSheetByName('MoneyFlow');
  
  if (!moneyFlowSheet) {
    throw new Error('MoneyFlow sheet not found. Run initializeMoneyFlowSheets() first.');
  }
  
  var today = new Date();
  var transferId = 'INIT-VAULT-' + Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyyMMdd');
  
  // Check if an initial balance entry already exists
  var lastRow = moneyFlowSheet.getLastRow();
  if (lastRow > 1) {
    var data = moneyFlowSheet.getRange(2, 1, lastRow - 1, 10).getValues();
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().startsWith('INIT-VAULT-')) {
        var userResponse = SpreadsheetApp.getUi().alert(
          'Initial Balance Found',
          'An initial vault balance entry already exists.\n\nCurrent: $' + data[i][2] + '\nNew: $' + VAULT_BALANCE + '\n\nDo you want to update it?',
          SpreadsheetApp.getUi().ButtonSet.YES_NO
        );
        
        if (userResponse === SpreadsheetApp.getUi().Button.YES) {
          // Update the existing entry
          var rowIndex = i + 2;
          moneyFlowSheet.getRange(rowIndex, 3).setValue(VAULT_BALANCE); // Amount
          moneyFlowSheet.getRange(rowIndex, 4).setValue(today); // Date
          moneyFlowSheet.getRange(rowIndex, 10).setValue('Updated initial vault balance to match SoFi'); // Notes
          
          Logger.log('Updated existing initial balance to $' + VAULT_BALANCE);
          SpreadsheetApp.getUi().alert('Success!', 'Initial vault balance updated to $' + VAULT_BALANCE, SpreadsheetApp.getUi().ButtonSet.OK);
          return;
        } else {
          Logger.log('User cancelled update');
          return;
        }
      }
    }
  }
  
  // Create new initial balance entry
  var newRow = [
    transferId,                              // Transfer ID
    'INITIAL-BALANCE',                       // Sale ID
    VAULT_BALANCE,                           // Amount
    today,                                   // Date
    'Opening Balance',                       // Source Location
    'San Jose Sneakers Vault',              // Destination Location
    'Completed',                             // Status
    today,                                   // Completed Date
    'System',                                // Completed By
    'Initial vault balance sync with SoFi'  // Notes
  ];
  
  moneyFlowSheet.appendRow(newRow);
  
  // Format the new row
  var lastRow = moneyFlowSheet.getLastRow();
  moneyFlowSheet.getRange(lastRow, 3).setNumberFormat('$#,##0.00'); // Amount
  moneyFlowSheet.getRange(lastRow, 4).setNumberFormat('M/d/yyyy'); // Date
  moneyFlowSheet.getRange(lastRow, 8).setNumberFormat('M/d/yyyy h:mm'); // Completed Date
  
  Logger.log('Initial vault balance set to $' + VAULT_BALANCE);
  
  try {
    SpreadsheetApp.getUi().alert(
      'Success!', 
      'Initial vault balance set to $' + VAULT_BALANCE + '\n\nThe Money Dashboard will now show this balance.', 
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {
    Logger.log('UI alert skipped (running from editor)');
  }
  
  return 'Initial vault balance set to $' + VAULT_BALANCE;
}

/**
 * Add an adjustment to the vault balance
 * Use this if you want to add or subtract from the current vault balance
 */
function adjustVaultBalance() {
  // ⚠️ UPDATE THIS VALUE
  // Positive number to add money, negative to subtract
  var ADJUSTMENT_AMOUNT = 500.00; // Change this
  var REASON = 'Manual adjustment'; // Change this to describe why
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var moneyFlowSheet = ss.getSheetByName('MoneyFlow');
  
  if (!moneyFlowSheet) {
    throw new Error('MoneyFlow sheet not found.');
  }
  
  var today = new Date();
  var transferId = 'ADJ-VAULT-' + Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyyMMddHHmmss');
  
  var sourceLocation = ADJUSTMENT_AMOUNT > 0 ? 'Manual Adjustment (Credit)' : 'San Jose Sneakers Vault';
  var destLocation = ADJUSTMENT_AMOUNT > 0 ? 'San Jose Sneakers Vault' : 'Manual Adjustment (Debit)';
  var amount = Math.abs(ADJUSTMENT_AMOUNT);
  
  var newRow = [
    transferId,
    'MANUAL-ADJ',
    amount,
    today,
    sourceLocation,
    destLocation,
    'Completed',
    today,
    'System',
    REASON
  ];
  
  moneyFlowSheet.appendRow(newRow);
  
  var lastRow = moneyFlowSheet.getLastRow();
  moneyFlowSheet.getRange(lastRow, 3).setNumberFormat('$#,##0.00');
  moneyFlowSheet.getRange(lastRow, 4).setNumberFormat('M/d/yyyy');
  moneyFlowSheet.getRange(lastRow, 8).setNumberFormat('M/d/yyyy h:mm');
  
  Logger.log('Vault adjusted by $' + ADJUSTMENT_AMOUNT);
  
  try {
    SpreadsheetApp.getUi().alert(
      'Success!', 
      'Vault balance adjusted by $' + ADJUSTMENT_AMOUNT, 
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {
    Logger.log('UI alert skipped');
  }
  
  return 'Vault adjusted by $' + ADJUSTMENT_AMOUNT;
}

