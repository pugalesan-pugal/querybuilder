// Import using require since we're in Node.js
require('@babel/register')({
  presets: ['@babel/preset-env'],
  plugins: [
    '@babel/plugin-transform-modules-commonjs'
  ]
});

// Now we can import the ES module
const { createCollections } = require('./createCollectionsWeb.js');

// Run the initialization
createCollections()
  .then(() => {
    console.log('Initialization complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Initialization failed:', error);
    process.exit(1);
  }); 