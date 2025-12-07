const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron');
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

const menuTemplate = [
  {
    label: 'File',
    submenu: [
      {
        label: 'New',
        accelerator: 'CmdOrCtrl+N',
        click: (item, focusedWindow) => {
          if (focusedWindow) focusedWindow.webContents.send('menu-new');
        }
      },
      {
        label: 'Open',
        accelerator: 'CmdOrCtrl+O',
        click: (item, focusedWindow) => {
          if (focusedWindow) focusedWindow.webContents.send('menu-open');
        }
      },
      {
        label: 'Save',
        accelerator: 'CmdOrCtrl+S',
        click: (item, focusedWindow) => {
          if (focusedWindow) focusedWindow.webContents.send('menu-save');
        }
      },
      {
        label: 'Save As',
        accelerator: 'CmdOrCtrl+Shift+S',
        click: (item, focusedWindow) => {
          if (focusedWindow) focusedWindow.webContents.send('menu-save-as');
        }
      },
      { type: 'separator' },
      { role: 'quit' }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { type: 'separator' },
      {
        label: 'Options',
        submenu: [
          {
            label: 'Dark Mode',
            type: 'checkbox',
            checked: true,
            click: (item, focusedWindow) => {
              if (focusedWindow) focusedWindow.webContents.send('toggle-dark-mode');
            }
          }
        ]
      }
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  }
];

const menu = Menu.buildFromTemplate(menuTemplate);
Menu.setApplicationMenu(menu);

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

ipcMain.handle('select-image', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }
      ]
    });
    if (result.canceled) {
      return null;
    }
    return result.filePaths[0];
  });
