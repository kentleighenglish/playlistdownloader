const electron = require('electron');
const {app, BrowserWindow, Menu, MenuItem, Tray, ipcMain, dialog} = electron;

require('shelljs/global');

const Datastore = require('nedb');
const os = require('os');
const fs = require('fs');
const path = require('path');

const db = {};
db.feeds = new Datastore('datastores/feeds.db');
db.items = new Datastore('datastores/items.db');

db.feeds.loadDatabase();
db.items.loadDatabase();

global.datastore = db;

const APP_DIR = __dirname;

const globalConfig = {
	feedTypes: {
		"inoreader": "Inoreader",
		"trello": "Trello Checklist",
		"youtube": "Youtube Playlist"
	}
};

const EventEmitter = {
	_events: {},
	dispatch: function(event, data){
		if(!this._events[event]) return;
		for (var i = 0; i < this._events[event].length; i++)
			this._events[event][i](data);
	},
	subscribe: function(event, callback){
		if(!this._events[event]) this._events[event] = [];
		this._events[event].push(callback);
	}
};

const XmlParser = require('./libs/xmlParse.js');
const FeedUtility = require('./libs/feedUtility.js');

const xmlParser = new XmlParser;
const feedUtility = new FeedUtility(xmlParser, db, os, fs, path, APP_DIR, globalConfig);

feedUtility.loadFeeds();

global.EventEmitter = EventEmitter;
global.config = globalConfig;
global.xmlParser = xmlParser;
global.feedUtility = feedUtility;

let appMainWindow;

function createWindow() {
	appMainWindow = new BrowserWindow({
		width: 1024,
		height: 768,
		title: "Feedo",
		show: false
	});

	appMainWindow.loadURL(`file://${__dirname}/views/index.html`);

	appMainWindow.once('ready-to-show', () => {
		appMainWindow.show();
	})

	appMainWindow.webContents.openDevTools();

	appMainWindow.on('closed', () => {
		appMainWindow = null;
	});
}

function quit() {
	dialog.showMessageBox({
		type: 'warning',
		buttons: [
			'Yes',
			'No'
		],
		message: 'Are you sure you want to quit?',
		title: 'Quit?',
		defaultId: 0,
		cancelId: 1
	},
	function(buttonPressed){
		if(buttonPressed == 0) {
			app.quit();
		}
	});
}

// app.on('ready', createWindow);

let tray = null;
app.on('ready', () => {
	tray = new Tray(__dirname+'/res/img/logo.png');

	function createContextMenu() {
		let feeds = feedUtility.feeds;
		let contextMenu = Menu.buildFromTemplate([
			{label: 'Update Feed', id: "menuFeedList", submenu: feeds.map(function(feed, index){
				return { 'label': feed.name, click(){ feedUtility.updateFeed(feed.type, index) }}
			})},
			{label: "Update Feeds", click(){ feedUtility.updateFeeds() }},
			{label: 'Exit', click(){ quit() }},
		]);

		tray.setContextMenu(contextMenu)
	}

	tray.on('click', (e) => {
		if(appMainWindow == null) {
			createWindow();
		} else {
			appMainWindow.show();
		}
	});

	EventEmitter.subscribe('feedsUpdated', function(){
		createContextMenu();
	}.bind(this));
});

app.on('before-quit', (e) => {
	// e.preventDefault();
	event.sender.send('app-quit');
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		if(tray == null) {
			app.quit();
		}
	}
});
