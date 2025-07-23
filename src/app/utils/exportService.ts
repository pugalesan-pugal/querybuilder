import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

export class ExportService {
  static async exportToExcel(transactions: any[]) {
    // Format transactions for Excel
    const formattedData = transactions.map(t => ({
      Date: new Date(t.date).toLocaleDateString('en-IN'),
      Merchant: t.merchant,
      Category: t.category,
      Amount: t.amount.toLocaleString('en-IN'),
      Status: t.status || 'Completed',
      Remarks: t.remarks || ''
    }));

    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // Trigger download
    const url = window.URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transactions_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  static async exportToPDF(transactions: any[]) {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.text('Transaction Report', 20, 20);
    
    // Add date
    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 20, 30);
    
    // Add table headers
    const headers = ['Date', 'Merchant', 'Category', 'Amount'];
    let y = 40;
    const rowHeight = 10;
    const colWidths = [30, 60, 40, 40];
    let x = 20;
    
    doc.setFontSize(10);
    headers.forEach((header, i) => {
      doc.text(header, x, y);
      x += colWidths[i];
    });
    
    // Add table data
    y += rowHeight;
    transactions.forEach(t => {
      if (y > 270) { // Check if we need a new page
        doc.addPage();
        y = 20;
      }
      
      x = 20;
      const row = [
        new Date(t.date).toLocaleDateString('en-IN'),
        t.merchant,
        t.category,
        `₹${t.amount.toLocaleString('en-IN')}`
      ];
      
      row.forEach((cell, i) => {
        doc.text(String(cell), x, y);
        x += colWidths[i];
      });
      
      y += rowHeight;
    });
    
    // Save PDF
    doc.save(`transactions_${new Date().toISOString().split('T')[0]}.pdf`);
  }
} 