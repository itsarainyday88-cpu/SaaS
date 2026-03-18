const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.next') {
                walk(fullPath, callback);
            }
        } else if (file.match(/\.(ts|tsx|js|jsx)$/)) {
            callback(fullPath);
        }
    });
}

walk('./src', filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 1. 테이블 및 속성 기둥 정확한 변경
    content = content.replace(/academy_id/g, 'workspace_id');
    content = content.replace(/AcademyId/g, 'WorkspaceId');
    content = content.replace(/academy_settings/g, 'workspace_settings');
    content = content.replace(/AcademySettings/g, 'WorkspaceSettings');
    content = content.replace(/academies/g, 'workspaces');
    content = content.replace(/Academies/g, 'Workspaces');
    
    // 2. 일반 배경지식 단어 변경
    content = content.replace(/academy/g, 'workspace');
    content = content.replace(/Academy/g, 'Workspace');
    content = content.replace(/학원/g, '비즈니스');
    content = content.replace(/원장님/g, '대표님');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[Updated] ${filePath}`);
});
