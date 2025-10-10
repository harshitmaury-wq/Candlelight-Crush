// main.js - Electron Main Process File
const { app, BrowserWindow } = require('electron');

if(require('electron-squirrel-startup')) app.quit();


const path = require('path');


function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    
    webPreferences: {
      // Allows Node.js environment to be used in the renderer process (index.html),
      // which is necessary for the Canvas environment variables to be available.
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js') // Preload is often used but not strictly necessary here.
    }
  });
  mainWindow.menuBarVisible=false;

  // Load the index.html of the app.
  mainWindow.loadFile('index.html');

  // Open the DevTools. (Optional, useful for debugging)
  // mainWindow.webContents.openDevTools();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
