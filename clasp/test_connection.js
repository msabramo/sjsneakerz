function testConnection() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (!ss) {
    Logger.log('ERROR: No spreadsheet found');
    return;
  }
  
  Logger.log('SUCCESS! Connected to: ' + ss.getName());
  Logger.log('Spreadsheet ID: ' + ss.getId());
  Logger.log('URL: ' + ss.getUrl());
  
  var sheets = ss.getSheets();
  Logger.log('Sheets found: ' + sheets.length);
  sheets.forEach(function(sheet) {
    Logger.log('  - ' + sheet.getName());
  });
}