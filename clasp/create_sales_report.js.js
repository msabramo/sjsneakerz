// Run this to create a Sales Report sheet with analytics
// Paste into Apps Script and run

function createSalesReport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Check if Sales Report already exists
  var existingReport = ss.getSheetByName("Sales Report");
  if (existingReport) {
    var ui = SpreadsheetApp.getUi();
    var response = ui.alert('Sales Report Already Exists',
                           'Do you want to recreate it? This will delete the existing report.',
                           ui.ButtonSet.YES_NO);
    if (response == ui.Button.YES) {
      ss.deleteSheet(existingReport);
    } else {
      Logger.log('Cancelled - keeping existing Sales Report');
      return;
    }
  }
  
  // Create new Sales Report sheet
  var reportSheet = ss.insertSheet('Sales Report', ss.getNumSheets());
  
  // Set up the report layout
  setupReportLayout(reportSheet);
  
  Logger.log('Sales Report created successfully!');
  
  var ui = SpreadsheetApp.getUi();
  ui.alert('Sales Report Created!',
           'A new Sales Report sheet has been added with:\n\n' +
           '• Total Sales Amount\n' +
           '• Number of Items Sold\n' +
           '• Average Sale Price\n' +
           '• Sales by Platform\n' +
           '• Sales by Person\n' +
           '• Total Profit\n\n' +
           'All metrics update automatically!',
           ui.ButtonSet.OK);
}

function setupReportLayout(sheet) {
  // Set column widths
  sheet.setColumnWidth(1, 250);  // Column A - labels
  sheet.setColumnWidth(2, 150);  // Column B - values
  sheet.setColumnWidth(3, 100);  // Column C - spacer
  sheet.setColumnWidth(4, 250);  // Column D - labels
  sheet.setColumnWidth(5, 150);  // Column E - values
  
  // === TITLE ===
  sheet.getRange('A1:E1').merge();
  sheet.getRange('A1').setValue('📊 SALES REPORT')
    .setFontSize(18)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setBackground('#4a86e8')
    .setFontColor('white');
  
  // === KEY METRICS SECTION ===
  sheet.getRange('A3').setValue('KEY METRICS')
    .setFontWeight('bold')
    .setFontSize(14)
    .setBackground('#d9d9d9');
  
  // Total Sales
  sheet.getRange('A5').setValue('Total Sales Amount:')
    .setFontWeight('bold');
  sheet.getRange('B5').setFormula('=IF(COUNTA(Sales!B:B)>1, "$" & TEXT(SUM(Sales!B2:B), "#,##0.00"), "$0.00")')
    .setFontSize(12)
    .setFontColor('#0b5394');
  
  // Number of Items Sold
  sheet.getRange('A6').setValue('Number of Items Sold:')
    .setFontWeight('bold');
  sheet.getRange('B6').setFormula('=COUNTA(Sales!A2:A)')
    .setFontSize(12)
    .setFontColor('#0b5394');
  
  // Average Sale Price
  sheet.getRange('A7').setValue('Average Sale Price:')
    .setFontWeight('bold');
  sheet.getRange('B7').setFormula('=IF(COUNTA(Sales!B2:B)>0, "$" & TEXT(AVERAGE(Sales!B2:B), "#,##0.00"), "$0.00")')
    .setFontSize(12)
    .setFontColor('#0b5394');
  
  // === PROFIT ANALYSIS ===
  sheet.getRange('A9').setValue('PROFIT ANALYSIS')
    .setFontWeight('bold')
    .setFontSize(14)
    .setBackground('#d9d9d9');
  
  // Total Cost (lookup from Inventory)
  sheet.getRange('A11').setValue('Total Cost (of sold items):')
    .setFontWeight('bold');
  sheet.getRange('B11').setFormula('=IF(COUNTA(Sales!A2:A)>0, "$" & TEXT(SUMIF(Inventory!A:A, "<>"&"", Inventory!G:G) - SUMIF(Inventory!I:I, "In Stock", Inventory!G:G), "#,##0.00"), "$0.00")')
    .setFontColor('#cc0000');
  
  // Total Profit
  sheet.getRange('A12').setValue('Total Profit:')
    .setFontWeight('bold')
    .setFontSize(12);
  sheet.getRange('B12').setFormula('=IF(COUNTA(Sales!B2:B)>0, "$" & TEXT(SUM(Sales!B2:B) - (SUMIF(Inventory!A:A, "<>"&"", Inventory!G:G) - SUMIF(Inventory!I:I, "In Stock", Inventory!G:G)), "#,##0.00"), "$0.00")')
    .setFontSize(12)
    .setFontWeight('bold')
    .setFontColor('#38761d');
  
  // Average Profit per Item
  sheet.getRange('A13').setValue('Average Profit per Item:')
    .setFontWeight('bold');
  sheet.getRange('B13').setFormula('=IF(COUNTA(Sales!A2:A)>0, "$" & TEXT((SUM(Sales!B2:B) - (SUMIF(Inventory!A:A, "<>"&"", Inventory!G:G) - SUMIF(Inventory!I:I, "In Stock", Inventory!G:G))) / COUNTA(Sales!A2:A), "#,##0.00"), "$0.00")')
    .setFontColor('#38761d');
  
  // === SALES BY PLATFORM ===
  sheet.getRange('D3').setValue('SALES BY PLATFORM')
    .setFontWeight('bold')
    .setFontSize(14)
    .setBackground('#d9d9d9');
  
  sheet.getRange('D5').setValue('Depop:');
  sheet.getRange('E5').setFormula('=IF(COUNTA(Sales!F:F)>1, "$" & TEXT(SUMIF(Sales!F:F, "Depop", Sales!B:B), "#,##0.00") & " (" & COUNTIF(Sales!F:F, "Depop") & ")", "$0.00 (0)")');
  
  sheet.getRange('D6').setValue('eBay:');
  sheet.getRange('E6').setFormula('=IF(COUNTA(Sales!F:F)>1, "$" & TEXT(SUMIF(Sales!F:F, "eBay", Sales!B:B), "#,##0.00") & " (" & COUNTIF(Sales!F:F, "eBay") & ")", "$0.00 (0)")');
  
  sheet.getRange('D7').setValue('Local:');
  sheet.getRange('E7').setFormula('=IF(COUNTA(Sales!F:F)>1, "$" & TEXT(SUMIF(Sales!F:F, "local", Sales!B:B), "#,##0.00") & " (" & COUNTIF(Sales!F:F, "local") & ")", "$0.00 (0)")');
  
  // === SALES BY PERSON ===
  sheet.getRange('D9').setValue('SALES BY PERSON')
    .setFontWeight('bold')
    .setFontSize(14)
    .setBackground('#d9d9d9');
  
  sheet.getRange('D11').setValue('Zach:');
  sheet.getRange('E11').setFormula('=IF(COUNTA(Sales!D:D)>1, "$" & TEXT(SUMIF(Sales!D:D, "Zach", Sales!B:B), "#,##0.00") & " (" & COUNTIF(Sales!D:D, "Zach") & ")", "$0.00 (0)")');
  
  sheet.getRange('D12').setValue('Adi:');
  sheet.getRange('E12').setFormula('=IF(COUNTA(Sales!D:D)>1, "$" & TEXT(SUMIF(Sales!D:D, "Adi", Sales!B:B), "#,##0.00") & " (" & COUNTIF(Sales!D:D, "Adi") & ")", "$0.00 (0)")');
  
  // === SHIPPING STATUS ===
  sheet.getRange('A15').setValue('SHIPPING STATUS')
    .setFontWeight('bold')
    .setFontSize(14)
    .setBackground('#d9d9d9');
  
  sheet.getRange('A17').setValue('Needs to Ship:');
  sheet.getRange('B17').setFormula('=COUNTIF(Sales!G:G, "needs to ship")')
    .setFontColor('#cc0000')
    .setFontWeight('bold');
  
  sheet.getRange('A18').setValue('Shipped:');
  sheet.getRange('B18').setFormula('=COUNTIF(Sales!G:G, "shipped")')
    .setFontColor('#f1c232');
  
  sheet.getRange('A19').setValue('Delivered:');
  sheet.getRange('B19').setFormula('=COUNTIF(Sales!G:G, "delivered")')
    .setFontColor('#38761d');
  
  sheet.getRange('A20').setValue('Local Pickup:');
  sheet.getRange('B20').setFormula('=COUNTIF(Sales!G:G, "local pickup (no shipping)")')
    .setFontColor('#38761d');
  
  // === INVENTORY STATUS ===
  sheet.getRange('D15').setValue('INVENTORY STATUS')
    .setFontWeight('bold')
    .setFontSize(14)
    .setBackground('#d9d9d9');
  
  sheet.getRange('D17').setValue('Items In Stock:');
  sheet.getRange('E17').setFormula('=COUNTIF(Inventory!I:I, "In Stock")')
    .setFontColor('#38761d')
    .setFontWeight('bold');
  
  sheet.getRange('D18').setValue('Items Sold:');
  sheet.getRange('E18').setFormula('=COUNTIF(Inventory!I:I, "Sold")')
    .setFontColor('#cc0000');
  
  sheet.getRange('D19').setValue('Total Items:');
  sheet.getRange('E19').setFormula('=COUNTA(Inventory!A2:A)')
    .setFontWeight('bold');
  
  sheet.getRange('D20').setValue('Sell-Through Rate:');
  sheet.getRange('E20').setFormula('=IF(COUNTA(Inventory!A2:A)>0, TEXT(COUNTIF(Inventory!I:I, "Sold")/COUNTA(Inventory!A2:A), "0.0%"), "0%")')
    .setFontColor('#0b5394')
    .setFontWeight('bold');
  
  // Add borders to sections
  sheet.getRange('A5:B7').setBorder(true, true, true, true, false, false);
  sheet.getRange('A11:B13').setBorder(true, true, true, true, false, false);
  sheet.getRange('D5:E7').setBorder(true, true, true, true, false, false);
  sheet.getRange('D11:E12').setBorder(true, true, true, true, false, false);
  sheet.getRange('A17:B20').setBorder(true, true, true, true, false, false);
  sheet.getRange('D17:E20').setBorder(true, true, true, true, false, false);
  
  // Freeze the title row
  sheet.setFrozenRows(1);
  
  Logger.log('Sales Report layout complete!');
}

