import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

export class ExportService {
  static async exportToExcel(transactions: any[]) {
    // Format transactions for Excel
    const formattedData = transactions.map(t => {
      // Parse the date first
      let dateToUse;
      try {
        dateToUse = t.date ? new Date(t.date) : new Date();
        // Check if the date is valid, if not use today's date
        if (isNaN(dateToUse.getTime())) {
          dateToUse = new Date();
        }
      } catch (e) {
        console.log('Error parsing date:', e);
        dateToUse = new Date();
      }

      // Handle category
      let category = t.category || '';
      // Convert any variations of "Uncategor" to "Uncategorized"
      if (category.toLowerCase().includes('uncategor')) {
        category = 'Uncategorized';
      } else if (category.toLowerCase() === 'unknown' || !category) {
        category = 'Uncategorized';
      }

      // Format the date with a leading zero for single digit days/months
      const day = String(dateToUse.getDate()).padStart(2, '0');
      const month = String(dateToUse.getMonth() + 1).padStart(2, '0');
      const year = dateToUse.getFullYear();
      const formattedDate = `${day}/${month}/${year}`;

      return {
        Date: formattedDate,
        Category: category,
        Amount: typeof t.amount === 'number' ? 
          `₹${t.amount.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}` : 
          '₹0.00',
        Status: t.status || 'Completed',
        Remarks: t.remarks || ''
      };
    });

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
    const headers = ['Date', 'Category', 'Amount', 'Status'];
    let y = 40;
    const rowHeight = 10;
    const colWidths = [40, 50, 50, 30];
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
      // Parse the date first
      let dateToUse;
      try {
        dateToUse = t.date ? new Date(t.date) : new Date();
        // Check if the date is valid, if not use today's date
        if (isNaN(dateToUse.getTime())) {
          dateToUse = new Date();
        }
      } catch (e) {
        console.log('Error parsing date:', e);
        dateToUse = new Date();
      }

      // Handle category
      let category = t.category || '';
      // Convert any variations of "Uncategor" to "Uncategorized"
      if (category.toLowerCase().includes('uncategor')) {
        category = 'Uncategorized';
      } else if (category.toLowerCase() === 'unknown' || !category) {
        category = 'Uncategorized';
      }

      // Format the date with a leading zero for single digit days/months
      const day = String(dateToUse.getDate()).padStart(2, '0');
      const month = String(dateToUse.getMonth() + 1).padStart(2, '0');
      const year = dateToUse.getFullYear();
      const formattedDate = `${day}/${month}/${year}`;

      const row = [
        formattedDate,
        category,
        typeof t.amount === 'number' ? 
          `₹${t.amount.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}` : 
          '₹0.00',
        t.status || 'Completed'
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