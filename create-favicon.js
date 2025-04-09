const fs = require('fs');

async function createFavicon() {
  try {
    // Simply copy the PNG to favicon.ico
    // Browsers will handle this appropriately
    fs.copyFileSync('./public/favicon-16x16.png', './public/favicon.ico');
    
    console.log('favicon.ico created successfully');
  } catch (error) {
    console.error('Error creating favicon.ico:', error);
  }
}

createFavicon(); 