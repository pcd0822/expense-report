function doGet(e) {
  const params = e.parameter;
  const action = params.action;

  if (action === 'test') {
    return ContentService.createTextOutput(JSON.stringify({status: 'ok'})).setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'getBudget') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Budget');
    if (!sheet) return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
    
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0];
    const data = rows.slice(1).map(row => {
      let obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
    
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({error: 'Invalid Action'})).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const params = e.parameter;
    const action = params.action;
    const data = JSON.parse(params.data);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (action === 'saveBudget') {
      let sheet = ss.getSheetByName('Budget');
      if (!sheet) {
        sheet = ss.insertSheet('Budget');
      }
      sheet.clear();
      
      const headers = ['세부항목', '원가통계비목', '산출내역', '예산액', 'used'];
      sheet.appendRow(headers);
      
      data.forEach(item => {
        sheet.appendRow([
          item['세부항목'],
          item['원가통계비목'],
          item['산출내역'],
          item['예산액'],
          item['used'] || 0
        ]);
      });
      
      return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'submitExpenditure') {
      let sheet = ss.getSheetByName('Expenditures');
      if (!sheet) {
        sheet = ss.insertSheet('Expenditures');
        sheet.appendRow(['Date', 'DocumentName', 'BudgetName', 'TotalAmount', 'ItemsJSON']);
      }
      
      sheet.appendRow([
        new Date(),
        data.docName,
        data.budgetName,
        data.totalAmount,
        JSON.stringify(data.items)
      ]);
      
      // Update Budget Usage
      let budgetSheet = ss.getSheetByName('Budget');
      const rows = budgetSheet.getDataRange().getValues();
      // Assume column 3 is '산출내역' (0-indexed 2) and col 5 is 'used' (0-indexed 4)
      
      for(let i=1; i<rows.length; i++) {
        if(rows[i][2] == data.budgetName) {
          let currentUsed = Number(rows[i][4] || 0);
          budgetSheet.getRange(i+1, 5).setValue(currentUsed + data.totalAmount);
          break;
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
    }
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({error: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}
