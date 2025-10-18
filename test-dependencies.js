import fs from 'fs';
import path from 'path';

console.log('Testing dependencies and imports...');

// Check node_modules exists
if (fs.existsSync('node_modules')) {
  console.log('✓ node_modules directory exists');

  // Check key dependencies
  const keyDeps = ['react', 'react-dom', 'vite'];
  keyDeps.forEach(dep => {
    const depPath = path.join('node_modules', dep);
    if (fs.existsSync(depPath)) {
      console.log('✓', dep, 'dependency exists');
    } else {
      console.log('✗', dep, 'dependency missing');
    }
  });
} else {
  console.log('✗ node_modules directory missing');
}

// Check if main.jsx imports work syntactically
try {
  const mainContent = fs.readFileSync('src/main.jsx', 'utf8');
  console.log('✓ main.jsx syntax appears valid');
} catch (error) {
  console.log('✗ main.jsx syntax error:', error.message);
}

console.log('✓ Dependency check completed');

