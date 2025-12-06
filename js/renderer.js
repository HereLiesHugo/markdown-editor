const { ipcRenderer } = require('electron');
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

function updatePreview() {
    const text = markdown.value;
    const html = parseMarkdown(text);
    preview.innerHTML = html;
}

function parseMarkdown(text) {
    return text
        // Headers
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Strikethrough
        .replace(/~~(.*?)~~/g, '<del>$1</del>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        // Images
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">')
        // Code blocks
        .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        // Blockquotes
        .replace(/^> (.*)$/gim, '<blockquote>$1</blockquote>')
        // Unordered lists
        .replace(/^[\*\-\+] (.*)$/gim, '<li>$1</li>')
        // Ordered lists
        .replace(/^\d+\. (.*)$/gim, '<li>$1</li>')
        // Horizontal rules
        .replace(/^---$/gim, '<hr>')
        // Line breaks
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        // Wrap in paragraphs
        .replace(/^(.+)$/gm, '<p>$1</p>')
        // Clean up empty paragraphs
        .replace(/<p><\/p>/g, '')
        .replace(/<p>(<h[1-6]>)/g, '$1')
        .replace(/(<\/h[1-6]>)<\/p>/g, '$1')
        .replace(/<p>(<hr>)<\/p>/g, '$1')
        .replace(/<p>(<blockquote>.*?<\/blockquote>)<\/p>/g, '$1')
        .replace(/<p>(<pre>.*?<\/pre>)<\/p>/g, '$1')
        .replace(/<p>(<li>.*?<\/li>)<\/p>/g, '$1');
}

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
    const prefix = type === 'ordered' ? '1. ' : '- ';
    
    const listItems = lines.map(line => prefix + line).join('\n');
    
    markdown.value = text.substring(0, start) + listItems + text.substring(end);
    markdown.focus();
    
    updatePreview();
    updateWordCount();
    markDirty();
}

function insertLink() {
    const url = prompt('Enter URL:');
    const text = prompt('Enter link text:') || url;
    
    if (url) {
        insertMarkdown(`[${text}](`, `)`);
    }
}

function insertImage() {
    const url = prompt('Enter image URL:');
    const alt = prompt('Enter alt text:') || '';
    
    if (url) {
        insertMarkdown(`![${alt}](`, `)`);
    }
}

function insertTable() {
    const rows = prompt('Number of rows:', '3');
    const cols = prompt('Number of columns:', '3');
    
    if (rows && cols) {
        let table = '';
        const header = '|' + ' Header |'.repeat(parseInt(cols)) + '\n';
        const separator = '|' + ' --- |'.repeat(parseInt(cols)) + '\n';
        table += header + separator;
        
        for (let i = 0; i < parseInt(rows) - 1; i++) {
            table += '|' + ' Cell |'.repeat(parseInt(cols)) + '\n';
        }
        
        insertMarkdown(table, '');
    }
}

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

ipcRenderer.on('file-saved', (event, path) => {
    currentFilePath = path;
    markClean();
});

// Initialize
updatePreview();
updateWordCount();
markdown.focus();