
function XmlParser() {
	this.http = require('http');
}

XmlParser.prototype.fetchXml = function(url, callback) {
	if(typeof(url) != 'undefined' && url != null) {
		var regex = /(http:\/\/)?(www\.)?([a-z]*)\.(\w{1,4})\/[\?\%\&\:\-\/0-9a-z]*$/;

		var match = regex.exec(url);
		if(match[2] == undefined) {
			url = 'www.'+url;
		}
		if(match[1] == undefined) {
			url = 'http://'+url;
		}

		var req = this.http;
		req.get(url+'?'+(new Date().getTime()), function(response) {
			const { statusCode } = response;

			if(statusCode == 200){
				response.setEncoding('utf8');
				let rawData = '';
				response.on('data', (chunk) => { rawData += chunk; });

				response.on('end', () => {
					try {
						if(typeof(callback) == 'undefined' || callback == null) {
							this.parseRawXml(rawData, (err, data) => {
								if(!err) {
									return data;
								}
							});
						}else{
							this.parseRawXml(rawData, callback);
						}
					} catch (e) {
						console.error(e.message);
					}
				});
			} else {
				error = new Error(`Request Failed.\n` +
					 `Status Code: ${statusCode}`);
			}
		}.bind(this));
	}else{
		console.error('No URL given in "fetchXml" method');
	}
}

XmlParser.prototype.parseRawXml = function(xml, callback) {
	if(typeof(xml) != 'undefined' && xml != null) {
		let parseString = require('xml2js').parseString;
		var parsedXmlData = parseString(xml, {
			ignoreAttrs: true
		}, callback);
	}else{
		console.error('No XML data given in "parseRawXml" method');
	}
}

module.exports = XmlParser;
