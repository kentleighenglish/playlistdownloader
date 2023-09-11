var MainContainer = React.createClass({
	getInitialState: function () {
		return {
			"feeds": feedUtility.feeds,
			"contentView": 'main',
			"currentFeed": null
		};
	},
	componentWillMount: function () {
		EventEmitter.subscribe('feedsUpdated', function () {
			this.setState({ feeds: feedUtility.feeds });
		}.bind(this));
	},
	loadFeed: function (index) {
		this.setState({ "currentFeed": index, "contentView": "feed" });
	},
	downloadItem: function (url, name, itemIndex) {
		var feedList = feedUtility.feeds[this.state.currentFeed]['feedList'];
		feedList[itemIndex]['downloading'] = true;
		this.setState({ "feedList": feedList });

		feedUtility.download(url, name, function (downloadStats) {
			var feeds = this.state.feeds;
			var feedList = feeds[this.state.currentFeed]['feedList'];

			feedList[itemIndex]['downloadStats'] = downloadStats;

			if (downloadStats.status == 'complete') {
				feedList[itemIndex]['downloading'] = false;
				db.items.update({ _id: feedList[itemIndex]['id'] }, { $set: { "downloaded": 1 } }, {}, function () {
					db.items.persistence.compactDatafile();
				});
				feedList[itemIndex]['downloaded'] = true;
			} else {
				feedList[itemIndex]['downloading'] = true;
			}

			this.setState({ "feeds": feeds });
		}.bind(this));
	},
	downloadList: function (selective) {
		var feedList = this.state.feeds[this.state.currentFeed]['feedList'];
		var feedTotal = feedList.length;
		var index = 0;

		var downloadItem = function (index, total, downloadItem) {
			var feeds = this.state.feeds;
			var feedList = feeds[this.state.currentFeed]['feedList'];
			if (!selective || selective && feedList[index]['selected']) {
				var data = feedList[index];
				feedList[index]['downloading'] = true;

				feeds[this.state.currentFeed]['feedList'] = feedList;
				this.setState({ "feeds": feeds });

				trackRetriever.download(data.link, data.name, function (downloadStats) {
					var feeds = this.state.feeds;
					var feedList = feeds[this.state.currentFeed]['feedList'];
					feedList[index]['downloadStats'] = downloadStats;

					if (downloadStats.status == 'complete') {
						feedList[index]['downloading'] = false;
						feedList[index]['downloaded'] = true;
					} else {
						feedList[index]['downloading'] = true;
					}

					feeds[this.state.currentFeed]['feedList'] = feedList;
					this.setState({ "feeds": feeds });
					if (downloadStats.status == 'complete' || downloadStats.status == 'error') {
						if (index < feedTotal) {
							index++;
							downloadItem.call(this, index, feedTotal, downloadItem);
						}
					}
				}.bind(this));
			} else {
				if (index < feedTotal) {
					index++;
					downloadItem.call(this, index, feedTotal, downloadItem);
				}
			}
		};
		downloadItem.call(this, index, feedTotal, downloadItem);
	},
	selectToggle: function (index) {
		var feeds = this.state.feeds;

		var selected = feeds[this.state.currentFeed]['feedList'][index]['selected'];
		if (selected == true) {
			selected = false;
		} else {
			selected = true;
		}

		feeds[this.state.currentFeed]['feedList'][index]['selected'] = selected;
		this.setState({ feeds: feeds });
	},
	loadView: function (view) {
		EventEmitter.dispatch('removeNew');
		this.setState({ "contentView": view });
	},
	addFeed: function (event, data) {
		event.preventDefault();

		var date = new Date().getTime();

		var newFeed = {
			"name": data['feed_name'],
			"type": data['feed_type'],
			"src": data['feed_source'],
			"created": date,
			"modified": date
		};

		feedUtility.addFeed(newFeed, function (err) {
			db.feeds.persistence.compactDatafile();
			if (!err) {
				this.setState({ "contentView": "main" });
			}
		}.bind(this));
	},
	updateConfiguration: function (event, data) {
		event.preventDefault();
		console.log(event);
	},
	getContentView: function (property) {
		var content = null;
		switch (property) {
			case 'main':
				content = React.createElement(MainView, {
					feeds: this.state.feeds,
					loadFeeds: this.loadFeeds,
					loadFeed: this.loadFeed
				});
				break;
			case 'addFeed':
				content = React.createElement(AddFeedView, { addFeed: this.addFeed });
				break;
			case 'configure':
				content = React.createElement(ConfigureView, { updateConfiguration: this.updateConfiguration });
				break;
			case 'feed':
				content = React.createElement(FeedView, {
					downloadItem: this.downloadItem,
					downloadList: this.downloadList,
					selectToggle: this.selectToggle,
					currentFeed: this.state.feeds[this.state.currentFeed],
					index: this.state.currentFeed
				});
				break;
		}
		return content;
	},
	getHeaderView: function (property) {
		var header = null;
		switch (property) {
			case 'feed':
				header = React.createElement(
					"div",
					null,
					React.createElement(
						"a",
						{ href: "#", className: "submenu__button", onClick: () => this.downloadList(false) },
						"Download All"
					),
					React.createElement(
						"a",
						{ href: "#", className: "submenu__button", onClick: () => this.downloadList(true) },
						"Download Selected"
					)
				);
				break;
			case 'main':
				header = React.createElement(
					"div",
					null,
					React.createElement(
						"a",
						{ className: "submenu__button", href: "#", onClick: () => this.loadView("addFeed") },
						"Add Feed"
					),
					React.createElement(
						"a",
						{ className: "submenu__button", href: "#", onClick: () => feedUtility.updateFeeds() },
						"Update Feeds"
					)
				);
				break;
		}
		return header;
	},
	render: function () {
		var content = this.getContentView(this.state.contentView);
		var header = this.getHeaderView(this.state.contentView);

		return React.createElement(
			"div",
			null,
			React.createElement(Header, { headerView: header, loadView: this.loadView }),
			React.createElement(Content, { contentView: content })
		);
	}
});

var Header = React.createClass({
	getDefaultProps: function () {
		return {
			"loadView": null,
			"headerView": null
		};
	},
	render: function () {
		return React.createElement(
			"div",
			{ className: "container__header" },
			React.createElement(
				"div",
				{ className: "menu" },
				React.createElement(
					"a",
					{ href: "#", onClick: () => this.props.loadView('main'), className: "menu__button" },
					"Manage Feeds"
				),
				React.createElement(
					"a",
					{ href: "#", onClick: () => this.props.loadView('configure'), className: "menu__button" },
					"Configuration"
				)
			),
			React.createElement(
				"div",
				{ className: "submenu" },
				this.props.headerView != null ? this.props.headerView : null
			)
		);
	}
});

var Content = React.createClass({
	getDefaultProps: function () {
		return {
			"contentView": null
		};
	},
	render: function () {
		return React.createElement(
			"div",
			{ className: "container__content" },
			this.props.contentView != null ? this.props.contentView : 'No View'
		);
	}
});

var FeedListItem = React.createClass({
	getDefaultProps: function () {
		return {
			"index": null,
			"itemData": {
				"name": "No name available",
				"date": "No date",
				"uploader": "No author",
				"downloading": false,
				"downloadStats": null,
				"new": null
			},
			"downloadItem": null,
			"selectToggle": null
		};
	},
	render: function () {
		var itemData = this.props.itemData;

		var formattedDate = moment(itemData['published']).format('DD/MM/YY HH:mm');

		var dl = itemData['downloading'];
		var n = itemData['new'];
		var downloadStats = {};
		if (typeof itemData['downloadStats'] != 'undefined') {
			downloadStats = itemData['downloadStats'];
		}

		var statusMessage = '';
		var progressWidth = { width: 0 };
		if (dl) {
			var status = 'downloading';
			var statusMessage = ' - Downloading';
		}
		var newItem = '';
		if (n) {
			newItem = 'feedListItem--new ';
		}

		if (itemData.downloaded == true) {
			downloadStats.status = 'complete';
		}

		if (downloadStats != null && Object.keys(downloadStats).length > 0) {
			// console.log(downloadStats);
			var status = downloadStats.status;
			if (status == 'downloading') {
				statusMessage += ' (' + downloadStats.percentage + '%)';
				progressWidth.width = downloadStats.percentage + '%';
			}

			if (status == 'transcoding') {
				statusMessage = ' - Transcoding';
				progressWidth.width = '100%';
			}
			if (status == 'complete') {
				statusMessage = '';
				progressWidth.width = '0px';
			}
		}

		return React.createElement(
			"div",
			{ className: 'feedListItem ' + newItem + (typeof status != null && status != undefined ? 'feedListItem--' + status : '') },
			React.createElement("div", { className: "feedListItem__status" }),
			React.createElement("div", { className: "feedListItem__progress", style: progressWidth }),
			React.createElement(
				"div",
				{ className: "feedListItem__left" },
				React.createElement(
					"span",
					{ className: "feedListItem__name" },
					itemData.name,
					statusMessage
				),
				React.createElement("br", null),
				React.createElement(
					"span",
					{ className: "feedListItem__date" },
					formattedDate
				)
			),
			React.createElement(
				"div",
				{ className: "feedListItem__right" },
				React.createElement(
					"span",
					null,
					React.createElement(
						"a",
						{ href: "#", className: "feedListItem__download", onClick: () => this.props.downloadItem(itemData.link, itemData.name, this.props.index) },
						"DL"
					)
				),
				itemData.selected == true ? React.createElement(
					"span",
					{ className: "feedListItem__selectToggle feedListItem__selectToggle--checked", onClick: e => {
							var evt = new MouseEvent("click");if (e.currentTarget == e.target) {
								document.querySelector('.checkbox label').dispatchEvent(evt);
							}
						} },
					React.createElement(
						"label",
						{ onClick: e => this.props.selectToggle(this.props.index) },
						React.createElement("input", { name: "selectToggle", type: "checkbox", value: "selected", checked: true })
					)
				) : React.createElement(
					"span",
					{ className: "feedListItem__selectToggle", onClick: e => {
							var evt = new MouseEvent("click");if (e.currentTarget == e.target) {
								document.querySelector('.checkbox label').dispatchEvent(evt);
							}
						} },
					React.createElement(
						"label",
						{ onClick: e => this.props.selectToggle(this.props.index) },
						React.createElement("input", { name: "selectToggle", type: "checkbox", value: "selected" })
					)
				)
			)
		);
	}
});

var FeedView = React.createClass({
	getDefaultProps: function () {
		return {
			"feedType": 0,
			"downloadItem": null,
			"selectToggle": null,
			"currentFeed": null,
			"index": null
		};
	},
	componentWillMount: function () {
		feedUtility.updateFeedList(this.props.index, this.props.currentFeed['type']);
		localStorage.setItem('currentFeed', this.props.currentFeed._id);
	},
	createFeedList: function (list) {
		return list.map(function (item, index) {
			return React.createElement(FeedListItem, {
				index: index,
				itemData: item,
				downloadItem: this.props.downloadItem,
				selectToggle: this.props.selectToggle
			});
		}, this);
	},
	render: function () {
		var currentFeed = this.props.currentFeed;
		var itemList = this.createFeedList(currentFeed.feedList);

		return React.createElement(
			"div",
			null,
			React.createElement(
				"div",
				{ className: "feedList" },
				itemList
			)
		);
	}
});

MainView = React.createClass({
	getDefaultProps: function () {
		return {
			"feeds": null,
			"loadFeed": null
		};
	},
	createFeedRows: function (feeds) {
		if (typeof feeds != 'undefined' && feeds != null) {
			return feeds.map(function (feed, index) {
				if (typeof feed.updated == 'undefined' || feed.updated == null) {
					var updated = 'Never';
				} else {
					var updated = moment(feed.updated).format('DD/MM/YY HH:mm');
				}

				if (typeof feed.feedList != 'undefined' && feed.feedList.length > 0) {
					var itemCount = feed.feedList.length;
				} else {
					var itemCount = 0;
				}

				return React.createElement(
					"tr",
					{ className: "feedsTable__row", onClick: () => this.props.loadFeed(index) },
					React.createElement(
						"td",
						{ className: "feedsTable__bodyColumn" },
						feed.name
					),
					React.createElement(
						"td",
						{ className: "feedsTable__bodyColumn" },
						feed.typeFormatted
					),
					React.createElement(
						"td",
						{ className: "feedsTable__bodyColumn" },
						feed.newItems
					),
					React.createElement(
						"td",
						{ className: "feedsTable__bodyColumn" },
						itemCount
					),
					React.createElement(
						"td",
						{ className: "feedsTable__bodyColumn" },
						updated
					),
					React.createElement(
						"td",
						{ className: "feedsTable__bodyColumn" },
						"buttons"
					)
				);
			}, this);
		} else {
			return false;
		}
	},
	render: function () {
		var feedRows = this.createFeedRows(this.props.feeds);

		return React.createElement(
			"div",
			null,
			React.createElement(
				"table",
				{ className: "feedsTable" },
				React.createElement(
					"thead",
					null,
					React.createElement(
						"tr",
						null,
						React.createElement(
							"th",
							{ className: "feedsTable__headColumn" },
							"Name"
						),
						React.createElement(
							"th",
							{ className: "feedsTable__headColumn" },
							"Type"
						),
						React.createElement(
							"th",
							{ className: "feedsTable__headColumn" },
							"New Items"
						),
						React.createElement(
							"th",
							{ className: "feedsTable__headColumn" },
							"Items"
						),
						React.createElement(
							"th",
							{ className: "feedsTable__headColumn" },
							"Last Updated"
						),
						React.createElement("th", { className: "feedsTable__headColumn" })
					)
				),
				React.createElement(
					"tbody",
					null,
					feedRows
				)
			)
		);
	}
});

var AddFeedView = React.createClass({
	getInitialState: function () {
		return {
			"formData": []
		};
	},
	getDefaultProps: function () {
		return {
			"addFeed": null
		};
	},
	handleChange: function (e) {
		formData = this.state.formData;

		formData[event.target.name] = event.target.value;

		this.setState({
			"formData": formData
		});
	},
	render: function () {
		var feedTypes = globalConfig.feedTypes;
		var formData = this.state.formData;

		var feedTypeOptions = Object.keys(feedTypes).map(function (key) {
			if (feedTypes.hasOwnProperty(key)) {
				return React.createElement(
					"option",
					{ value: key },
					feedTypes[key]
				);
			}
		});

		return React.createElement(
			"div",
			null,
			React.createElement(
				"form",
				{ onSubmit: e => this.props.addFeed(e, this.state.formData) },
				React.createElement("input", { name: "feed_name", type: "text", value: formData["feed_name"], onChange: this.handleChange, required: true }),
				React.createElement(
					"select",
					{ required: true, name: "feed_type", onChange: this.handleChange, value: formData['feed_type'] },
					typeof formData['feed_type'] == 'undefined' ? React.createElement(
						"option",
						{ value: true, selected: true, disabled: true },
						"Feed Type"
					) : React.createElement(
						"option",
						{ value: true, disabled: true },
						"Feed Type"
					),
					feedTypeOptions
				),
				React.createElement("input", { name: "feed_source", type: "text", value: formData["feed_source"], onChange: this.handleChange, required: true }),
				React.createElement(
					"button",
					{ type: "submit" },
					"Add Feed"
				)
			)
		);
	}
});

var ConfigureView = React.createClass({
	getInitialState: function () {
		return {
			"formData": []
		};
	},
	handleChange: function (e) {
		formData = this.state.formData;

		formData[event.target.name] = event.target.value;

		this.setState({
			"formData": formData
		});
	},
	render: function () {
		return React.createElement(
			"div",
			null,
			React.createElement(
				"form",
				{ onSubmit: e => this.props.updateConfiguration(e, this.state.formData) },
				React.createElement(
					"button",
					{ type: "submit" },
					"Save"
				)
			)
		);
	}
});

var reactComponent = ReactDOM.render(React.createElement(MainContainer, null), document.getElementById('container'));
