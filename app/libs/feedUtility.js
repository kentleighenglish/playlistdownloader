function FeedUtility(xmlParser, db, os, fs, path, APP_DIR, config) {
	this.xmlParser = xmlParser;
	this.db = db;
	this.os = os;
	this.fs = fs;
	this.path = path;
	this.APP_DIR = APP_DIR;
	this.config = config;
}

FeedUtility.prototype.feeds = [];

//Add Feed
FeedUtility.prototype.addFeed = function(newFeed, callback) {
	if(newFeed) {
		this.db.feeds.insert(newFeed, callback);
	}
}

FeedUtility.prototype.loadFeeds = function() {
	var load = function(feeds){
		feeds.map(function(feed, index){
			type = feed['type'];
			typeFormatted = this.config.feedTypes[type];
			feed['typeFormatted'] = typeFormatted;

			this.getFeedList(index, feed._id, function(list, newItems) {
				feed["feedList"] = list;
				feed["newItems"] = newItems;
				if(index+1 == feeds.length){
					this.feeds = feeds;
					EventEmitter.dispatch('feedsUpdated');
					this.updateFeeds();
				}
			}.bind(this));

		}, this);
	}.bind(this);

	this.db.feeds.find({}, function(err, feeds) {
		load(feeds);
	});
}

//Update Feeds
FeedUtility.prototype.updateFeeds = function() {
	feeds = this.feeds;
	feeds.map(function(feed, index){
		this.updateFeedList(index, feed.type);
	}, this);
}

FeedUtility.prototype.updateFeed = function(type, index) {
	this.updateFeedList(index, type);
}

//Get Feed list
FeedUtility.prototype.getFeedList = function(feedIndex, feedId, callback) {
	this.db.items.find({feed: feedId}).sort({published: -1}).exec(function(err, list){
		var newItems = 0;
		if(typeof(list) == 'undefined'){
			list = [];
		}
		list.map(function(item){
			if(item.new == true){
				newItems++;
			}
		});
		if(typeof(callback) == 'undefined'){
			feeds = this.feeds;
			feeds[feedIndex]['feedList'] = list;
			feeds[feedIndex]['newItems'] = newItems;
			EventEmitter.dispatch('feedsUpdated');
		}else{
			callback.call(this, list, newItems);
		}
	}.bind(this));
}

//Update Feed List
FeedUtility.prototype.updateFeedList = function(index, type) {
	feeds = this.feeds;

	let feed = feeds[index];
	let src = feed.src;
	let id = feed._id;
	if(type == 'inoreader'){
		feedUtility.checkInoreader(src, id, function(){
			feed.updated = new Date().getTime();
			this.db.feeds.update({_id: id}, {$set: {updated: feed.updated}}, {}, function(){
				this.db.feeds.persistence.compactDatafile();
			}.bind(this));
			feedUtility.getFeedList(index, id);
		}.bind(this));
	}
}

//Check Inoreader
FeedUtility.prototype.checkInoreader = function(src, feedId, callback) {
	this.xmlParser.fetchXml(src, function(err, result){
		var items = result.rss.channel[0].item;
		var itemsTotal = items.length;
		var i = 0;

		var parseItem = function(index, total) {
			if (items.hasOwnProperty(index)) {
				var item = items[index];
				var title = item.title[0];
				var link = item.link[0];
				var pubDate = item.pubDate[0];
				var author = item.source[0];

				var pubDateParsed = Date.parse(pubDate.replace(/^[aA-zZ]*,\s/g, ''))

				var id = link.replace(/(http?s):\/\/.*watch\?v=/, '');

				var date = new Date().getTime();

				this.db.items.findOne({uid: id}, function(err, item){
					if(item == null){
						var dbObj = {
							'uid': id,
							'name': title,
							'feed': feedId,
							'link': link,
							'new': 1,
							'downloaded': 0,
							'uploader': author,
							'published': pubDateParsed,
							'created': date,
							'modified': date
						};
						this.db.items.insert(dbObj, function(){
							if(i+1 != itemsTotal){
								i++;
								parseItem.call(this, i, itemsTotal);
							}else{
								if(typeof(callback) != 'undefined'){
									callback();
								}
							}
						});
					}else{
						if(i+1 != itemsTotal){
							i++;
							parseItem.call(this, i, itemsTotal);
						}else{
							if(typeof(callback) != 'undefined'){
								callback();
							}
						}
					}
				}.bind(this))
			}
		}.bind(this);
		parseItem.call(this, i, itemsTotal);
	}.bind(this));
}

//Checks for file existing in directory
FeedUtility.prototype.checkFileExists = function(filename, callback) {
	this.fs.access(this.path.join(this.APP_DIR, 'downloads', filename+'.mp3'), this.fs.F_OK, function(err){
		if(err != null){
			callback(false)
		}else{
			callback(true)
		}
	});
}

FeedUtility.prototype.download = function(url, filename, updateCallback) {
	let platform = this.os.platform();
	var outputPath = this.path.join(this.APP_DIR, 'downloads', filename+'.mp4');

	this.checkFileExists(filename, function(fileExists){
		console.log(fileExists);
		if(!fileExists) {
			if(platform != 'linux') {
				//WINDOWS
				var ytExec = this.path.join(this.APP_DIR, 'vendors', 'youtube-dl.exe');
			} else {
				//LINUX
				var ytExec = this.path.join(this.APP_DIR, 'vendors', 'youtube-dl');
			}

			var fileDownload = exec(ytExec+' -f best -x --audio-format mp3 --audio-quality 0 --newline -o "'+outputPath+'" "'+url+'"', {async:true,quiet:true});

			fileDownload.stdout.on('data', function(output){
				var downloadRegex = /(^\[download\].*?)([0-9.]+)\%\s+of\s+([0-9.]+)(M|K|G)(.*\s+at\s+([0-9.]+)(K|M|G))?/;
				var transcodingRegex = /(^\[ffmpeg\])/;
				var deletingRegex = /(^Deleting\ original\ file)/;
				var errorRegex = /(^ERROR:)(.*)/;
				var matches;

				var percentage = '0.0';
				var totalSize = 0;
				var downloadedSize = 0;
				var status = 'downloading';
				var errorCode = null;

				matches = downloadRegex.exec(output);
				if(matches != null) {
					if(typeof(matches[2]) != 'undefined'){
						percentage = parseInt(matches[2]).toFixed(1);
					}
					if(typeof(matches[3]) != 'undefined'){
						totalSize = matches[3] + matches[4] + 'b';
					}
					if(typeof(matches[5]) != 'undefined'){
						downloadedSize = matches[5] + matches[6] + 'b';
					}
				}else{
					matches = transcodingRegex.exec(output);
					if(matches != null){
						status = 'transcoding';
					} else {
						matches = deletingRegex.exec(output);
						if(matches != null) {
							status = 'complete';
						}else{
							matches = errorRegex.exec(output);
							if(matches != null) {
								status = 'error';
								errorCode = matches[2];
							}
						}
					}
				}

				updateCallback({
					"percentage":percentage,
					"totalSize":totalSize,
					"downloadSpeed":downloadedSize,
					"status":status,
					"errorCode":errorCode
				});
			});
		} else {
			//Already downloaded
		}

	}.bind(this));

}

module.exports = FeedUtility;
