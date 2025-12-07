const { ipcRenderer, shell } = require('electron');
const { marked } = require('marked');

// Configure marked with custom renderer
const renderer = {
  link(href, title, text) {
    if (typeof href === 'object' && href !== null) {
        // Handle marked v5+ / v17+ signature where arguments are passed as a single object or token
        const token = href;
        href = token.href;
        title = token.title;
        text = token.text;
    }
    return `<a href="${href}" title="${title || ''}" target="_blank">${text}</a>`;
  }
};

marked.use({
  renderer,
  breaks: true,
  gfm: true
});

const markdown = document.getElementById('markdown');
const preview = document.getElementById('preview');
const wordCount = document.getElementById('word-count');
const filePath = document.getElementById('file-path');

let currentFilePath = null;
let isDirty = false;

// Auto-save functionality
let autoSaveTimer;

markdown.addEventListener('input', () => {
    updatePreview();
    updateWordCount();
    markDirty();
    scheduleAutoSave();
});

// Intercept link clicks in preview
preview.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
        e.preventDefault();
        shell.openExternal(e.target.href);
    }
});

function updatePreview() {
    const text = markdown.value;
    const html = marked.parse(text);
    preview.innerHTML = html;
}

// ... existing code ...

function updateWordCount() {
    const text = markdown.value;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    wordCount.textContent = `Words: ${words} | Characters: ${chars}`;
}

function markDirty() {
    isDirty = true;
    if (!currentFilePath) {
        filePath.textContent = 'Untitled.md*';
    } else {
        filePath.textContent = currentFilePath.split('/').pop() + '*';
    }
}

function markClean() {
    isDirty = false;
    if (currentFilePath) {
        filePath.textContent = currentFilePath.split('/').pop();
    } else {
        filePath.textContent = 'Untitled.md';
    }
}

function scheduleAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        if (currentFilePath && isDirty) {
            saveFile();
        }
    }, 2000);
}

// Toolbar functions
function insertMarkdown(before, after) {
    const start = markdown.selectionStart;
    const end = markdown.selectionEnd;
    const text = markdown.value;
    const selectedText = text.substring(start, end);
    
    const replacement = before + selectedText + after;
    markdown.value = text.substring(0, start) + replacement + text.substring(end);
    
    // Set cursor position
    const newCursorPos = start + before.length + selectedText.length;
    markdown.setSelectionRange(newCursorPos, newCursorPos);
    markdown.focus();
    
    updatePreview();
    updateWordCount();
    markDirty();
}

function insertHeading(level) {
    const start = markdown.selectionStart;
    const text = markdown.value;
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = text.indexOf('\n', start);
    const currentLine = text.substring(lineStart, lineEnd === -1 ? text.length : lineEnd);
    
    // Remove existing headers
    const cleanLine = currentLine.replace(/^#+\s*/, '');
    const newLine = '#'.repeat(level) + ' ' + cleanLine;
    
    markdown.value = text.substring(0, lineStart) + newLine + text.substring(lineEnd === -1 ? text.length : lineEnd);
    markdown.focus();
    
    updatePreview();
    updateWordCount();
    markDirty();
}

function insertList(type) {
    const start = markdown.selectionStart;
    const end = markdown.selectionEnd;
    const text = markdown.value;
    const selectedText = text.substring(start, end);
    
    const lines = selectedText.split('\n');
    let prefix = '';
    if (type === 'ordered') prefix = '1. ';
    else if (type === 'task') prefix = '- [ ] ';
    else prefix = '- ';
    
    const listItems = lines.map(line => prefix + line).join('\n');
    
    markdown.value = text.substring(0, start) + listItems + text.substring(end);
    markdown.focus();
    
    updatePreview();
    updateWordCount();
    markDirty();
}

// Modal Management
function showModal(modalId) {
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById(modalId).classList.remove('hidden');
}

function hideModal(modalId) {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById(modalId).classList.add('hidden');
    // Clear inputs
    document.querySelectorAll(`#${modalId} input`).forEach(input => input.value = '');
}

function hideAllModals() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.querySelectorAll('.modal').forEach(modal => modal.classList.add('hidden'));
}

// Close modals on overlay click
document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') {
        hideAllModals();
    }
});

// Link Modal
function insertLink() {
    const start = markdown.selectionStart;
    const end = markdown.selectionEnd;
    const text = markdown.value;
    const selectedText = text.substring(start, end);

    const urlInput = document.getElementById('link-url');
    const textInput = document.getElementById('link-text');

    urlInput.value = '';
    textInput.value = selectedText;

    showModal('link-modal');
    urlInput.focus();
}

document.getElementById('link-cancel').addEventListener('click', () => hideModal('link-modal'));
document.getElementById('link-submit').addEventListener('click', () => {
    const url = document.getElementById('link-url').value;
    const text = document.getElementById('link-text').value;

    if (url) {
        insertMarkdown(`[${text || url}](${url})`, '');
    }
    hideModal('link-modal');
});

// Image Modal
function insertImage() {
    showModal('image-modal');
}

document.getElementById('image-browse').addEventListener('click', async () => {
    const path = await ipcRenderer.invoke('select-image');
    if (path) {
        // Convert to file URL format and handle spaces
        let formattedPath = path.replace(/\\/g, '/');
        // Encode each segment but keep slash separators
        formattedPath = formattedPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
        // Add protocol if it's an absolute path
        if (!formattedPath.startsWith('http') && !formattedPath.startsWith('file://')) {
             formattedPath = 'file:///' + formattedPath;
        }
        document.getElementById('image-url').value = formattedPath;
    }
});

document.getElementById('image-cancel').addEventListener('click', () => hideModal('image-modal'));
document.getElementById('image-submit').addEventListener('click', () => {
    const url = document.getElementById('image-url').value;
    const alt = document.getElementById('image-alt').value;

    if (url) {
        insertMarkdown(`![${alt}](${url})`, '');
    }
    hideModal('image-modal');
});

// Table Modal
function insertTable() {
    showModal('table-modal');
}

document.getElementById('table-cancel').addEventListener('click', () => hideModal('table-modal'));
document.getElementById('table-submit').addEventListener('click', () => {
    const rows = parseInt(document.getElementById('table-rows').value) || 3;
    const cols = parseInt(document.getElementById('table-cols').value) || 3;

    let table = '';
    const header = '|' + ' Header |'.repeat(cols) + '\n';
    const separator = '|' + ' --- |'.repeat(cols) + '\n';
    table += header + separator;

    for (let i = 0; i < rows - 1; i++) {
        table += '|' + ' Cell |'.repeat(cols) + '\n';
    }

    insertMarkdown(table, '');
    hideModal('table-modal');
});

// File operations
function newFile() {
    if (isDirty) {
        if (!confirm('Are you sure you want to create a new file? Unsaved changes will be lost.')) {
            return;
        }
    }
    
    markdown.value = '';
    currentFilePath = null;
    markClean();
    updatePreview();
    updateWordCount();
    markdown.focus();
}

function openFile() {
    if (isDirty) {
        if (!confirm('Are you sure you want to open a new file? Unsaved changes will be lost.')) {
            return;
        }
    }
    
    ipcRenderer.send('open-file');
}

function saveFile() {
    if (currentFilePath) {
        ipcRenderer.send('save-file', { path: currentFilePath, content: markdown.value });
    } else {
        saveAsFile();
    }
}

function saveAsFile() {
    ipcRenderer.send('save-file-as', { content: markdown.value });
}

// IPC handlers
ipcRenderer.on('file-opened', (event, data) => {
    markdown.value = data.content;
    currentFilePath = data.path;
    markClean();
    updatePreview();
    updateWordCount();
});

// Menu IPC handlers
ipcRenderer.on('menu-new', () => newFile());
ipcRenderer.on('menu-open', () => openFile());
ipcRenderer.on('menu-save', () => saveFile());
ipcRenderer.on('menu-save-as', () => saveAsFile());
ipcRenderer.on('toggle-dark-mode', () => {
    document.body.classList.toggle('dark-mode');
});

ipcRenderer.on('file-saved', (event, path) => {
    currentFilePath = path;
    markClean();
});

// Initialize
updatePreview();
updateWordCount();
markdown.focus();