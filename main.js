const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs').promises;
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  
  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// File operation handlers
ipcMain.handle('open-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Markdown Files', extensions: ['md', 'markdown', 'txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return { path: filePath, content };
    } catch (error) {
      console.error('Error reading file:', error);
      throw error;
    }
  }
  return null;
});

ipcMain.handle('save-file', async (event, { path, content }) => {
  try {
    await fs.writeFile(path, content, 'utf-8');
    return path;
  } catch (error) {
    console.error('Error saving file:', error);
    throw error;
  }
});

ipcMain.handle('save-file-as', async (event, { content }) => {
  const result = await dialog.showSaveDialog({
    defaultPath: path.join(app.getPath('documents'), 'untitled.md'),
    filters: [
      { name: 'Markdown Files', extensions: ['md', 'markdown'] },
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled) {
    try {
      await fs.writeFile(result.filePath, content, 'utf-8');
      return result.filePath;
    } catch (error) {
      console.error('Error saving file:', error);
      throw error;
    }
  }
  return null;
});

// Handle IPC messages (non-handle version for renderer process)
ipcMain.on('open-file', async (event) => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Markdown Files', extensions: ['md', 'markdown', 'txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const content = await fs.readFile(filePath, 'utf-8');
      event.sender.send('file-opened', { path: filePath, content });
    }
  } catch (error) {
    console.error('Error opening file:', error);
  }
});

ipcMain.on('save-file', async (event, { path, content }) => {
  try {
    await fs.writeFile(path, content, 'utf-8');
    event.sender.send('file-saved', path);
  } catch (error) {
    console.error('Error saving file:', error);
  }
});

ipcMain.on('save-file-as', async (event, { content }) => {
  try {
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(app.getPath('documents'), 'untitled.md'),
      filters: [
        { name: 'Markdown Files', extensions: ['md', 'markdown'] },
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled) {
      await fs.writeFile(result.filePath, content, 'utf-8');
      event.sender.send('file-saved', result.filePath);
    }
  } catch (error) {
    console.error('Error saving file:', error);
  }
});
