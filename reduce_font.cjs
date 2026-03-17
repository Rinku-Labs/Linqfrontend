const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('c:/Users/PC/Downloads/website_for_slush/Repos/Linq-v2-Frontend/src');

let totalChanges = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    // Replace fontSize: 'XXpx' or "XXpx"
    content = content.replace(/fontSize:\s*['"](\d+)px['"]/g, (match, p1) => {
        const size = parseInt(p1);
        let newSize = Math.round(size * 0.7); // Reduce by 30% for "far smaller"
        if (newSize < 9) newSize = 9; // Min 9px
        changed = true;
        totalChanges++;
        return `fontSize: '${newSize}px'`;
    });
    
    // clamp like clamp(28px, 8vw, 42px)
    content = content.replace(/fontSize:\s*['"]clamp\((\d+)px,\s*([^,]+),\s*(\d+)px\)['"]/g, (match, p1, p2, p3) => {
        const min = Math.round(parseInt(p1) * 0.7);
        const max = Math.round(parseInt(p3) * 0.7);
        changed = true;
        totalChanges++;
        return `fontSize: 'clamp(${min}px, ${p2}, ${max}px)'`;
    });

    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
    }
});

console.log('Total fontSize replacements:', totalChanges);
