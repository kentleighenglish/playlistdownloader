
EventEmitter.subscribe('removeNew', function(){
	var feedId = localStorage.getItem('currentFeed');
	if(typeof(feedId) != null && feedId != undefined){
		db.items.find({feed: feedId}, function(){
			db.items.update({feed: feedId}, {$set:{new: 0}}, {multi: true}, function(){
				db.items.persistence.compactDatafile();
			});
		})
		localStorage.removeItem('currentFeed');
	}
});
