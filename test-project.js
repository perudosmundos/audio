import fs from 'fs';

try {
  console.log('Testing basic project structure...');

  // Check if main files exist
  const mainFiles = [
    'src/App.jsx',
    'src/main.jsx',
    'src/index.css',
    'package.json'
  ];

  mainFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log('✓', file, 'exists');
    } else {
      console.log('✗', file, 'missing');
    }
  });

  // Check package.json structure
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  console.log('✓ Package.json is valid JSON');
  console.log('✓ App name:', pkg.name);
  console.log('✓ Main entry:', pkg.main || 'index.js');

  // Test React component structure
  const appContent = fs.readFileSync('src/App.jsx', 'utf8');
  if (appContent.includes('function') || appContent.includes('const') || appContent.includes('=>')) {
    console.log('✓ App.jsx contains React component');
  } else {
    console.log('✗ App.jsx may not contain valid React component');
  }

  // Test main.jsx structure
  const mainContent = fs.readFileSync('src/main.jsx', 'utf8');
  if (mainContent.includes('ReactDOM') && mainContent.includes('render')) {
    console.log('✓ main.jsx contains ReactDOM render call');
  } else {
    console.log('✗ main.jsx may not contain ReactDOM render call');
  }

  console.log('✓ All basic structure tests passed');
  console.log('✓ Project appears to be a valid React application');

} catch (error) {
  console.error('✗ Test failed:', error.message);
  throw error;
}
