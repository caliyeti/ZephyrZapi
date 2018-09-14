/**
 * Page obejct for helper functions
 *
 *
 */
var params = browser.params;
var Zapi = require('../lib/zapi_cloud');
var zapi = new Zapi();
var NavBar 				= require('../pages/navBar');
var navBar 				= new NavBar();
var LoginPage = require('../pages/login');
var login = new LoginPage();
var EC = protractor.ExpectedConditions;


var Helpers = function () {

    this.getTitle = function () {
        return 'WI-FI SETTINGS';
    }

    /**
     * Logs in as the given user (username,password) and clicks the home page button
     * and waits until the home page has loaded
     */
    this.beforeEachTestLogin = function (username, password, element, title) {
		// ************** PREP EACH TEST HERE
		// ******************************************
		zapi.beforeEach();


        // This will not work with direct linking tests
		// Log in and go to home page
		browser.get(params.startUrl);

		login.login(username, password);
		browser.get(params.startUrl);
		browser.wait(function() {
            return browser.isElementPresent(navBar.home);
        }, 10000);

		// Click home to make sure we are there
		navBar.home.click();
		this.waitForPageToLoadAndVerifyTitle(element, title);

		// make sure data is fully loaded before any tests
        this.waitForDataLoading();

        zapi.completeTestStep('1');
		return zapi.takeScreenshot('BeforeEach');
    }

    this.waitForPageToLoadAndVerifyTitle = function (elementToLookFor, title) {
    	this.waitForElem(elementToLookFor);
    	this.verifyTitle(title);
    }

    this.waitForElemVisible = function (element) {
    	browser.wait(EC.visibilityOf(element), 10000);
    },

    this.waitForElem = function (element) {
    	browser.wait(EC.presenceOf(element), 10000);
    }

    this.verifyTitle = function (title) {
    	browser.getTitle().then(function (txt) {
			expect(txt).toBe(title);
		});
    }

    this.afterEachTestLogout = function () {
    	// *************** TAKE AND ATTACH SCREENSHOT
		// ******************************************
		zapi.takeScreenshot('afterEach');


		// log out will go here once implemented.

		// browser.get(params.startUrl);
		browser.get(params.baseUrl + 'signout');

		zapi.takeScreenshot('signout');
		zapi.completeTestStep('last');

		// ************** TEST HAS PASSED OR FAILED
		// *******************************************

		// zapi.afterEach pass/fails the test in Zephyr and attaches error logs
		// on failure.

		return zapi.afterEach();
    }

    // check images returns true if the images are available (not broken links).
    this.isLinkValid = function (url) {

        var deferred = protractor.promise.defer();
        var request = require('request');

        //internet exploder likes to lowercase css img urls and this is wrong.  so we are checking
        //for a lowercase and replacing with the correct url to test
        url = url.replace("snapshot","SNAPSHOT");

        if(url==null){
        	deferred.reject('url is null');
        }else{
        	request.head(url, function (err, res, body) {
        		if (res && res.statusCode == 200) {
        			deferred.fulfill(true);
        		} else if(err){
        			deferred.reject(err);
        		} else if(res){
        			deferred.reject(res.statusCode);
        		} else{
        			deferred.reject('Failed to get reuqested resource:' + url);
        		}
        	});
        }


        return deferred.promise;
    }

    this.refreshPage = function(){

    	browser.driver.navigate().refresh().then( function () {
    		browser.wait(EC.presenceOf(navBar.header), 10000);
    	});
    	this.waitForDataLoading();
    }

    this.waitForDataLoading = function(second){
    	//make sure data is fully loaded before any tests

        if(second){
    		second = 1000*second;
    	}else{
    		second = 45000;
    	}

        //first wait until the framework is fully loaded
        browser.wait(function(){
        	return element.all(by.id('sp-loader-status')).count().then(function(num){
        		return num === 0;
        	});
        }, second);

        //now wait until all user data has loaded
        browser.wait(function(){
        	return element.all(by.css('.load-interstitial')).count().then(function(num){
        		return num === 0;
        	});
        }, second);
    }

    // returns the url of an image from the background css
    this.getImageUrlFromBackground = function (bg) {
    	var deferred = protractor.promise.defer();
    	if(bg == null){
    		deferred.reject(new Error('No background element found'));
    	}else{
    		try {
    			deferred.fulfill(bg.slice(bg.indexOf('http'), bg.lastIndexOf('.') + 4));
    		} catch(e) {
    			deferred.reject(new Error('image type not supported'));
    		}

    	}
        return deferred.promise;
    }

    // Checks whether an element has a class of className. It checks each class
    // returned individually so as to not have the following problem
    // className = 'hello', actual class is 'helloWorld'. If we look for containing
    // text, this would return true.
    this.hasClass = function (elem, className) {
    	var deferred = protractor.promise.defer();
        elem.getAttribute('class').then(function (classAttr) {
            var classArray = classAttr.split(' ');
            deferred.fulfill(classArray.indexOf(className) != -1);
        });

        return deferred.promise;
    }

    // Given a parent container and a child container, this checks to see if the child has
    // a scrollbar attached by comparing the child height to that of the parent.
    this.hasScroll = function (containerElem, parentElem) {
    	var deferred = protractor.promise.defer(),
            containerHeight,
            parentHeight;

        containerElem.getWebElement().getSize().then(function (containerDim) {
            containerHeight = containerDim.height;
            parentElem.getWebElement().getSize().then(function (parentDim) {
                parentHeight = parentDim.height;
                var result = containerHeight > parentHeight;
                deferred.fulfill(result);
            });
        });

        return deferred.promise;
    }

    this.checkProperFrameHeight = function(containerElem, parentElem){
    	var deferred = protractor.promise.defer(),
        containerHeight,
        parentHeight;

	    containerElem.getWebElement().getSize().then(function (containerDim) {
	        containerHeight = containerDim.height;
	        parentElem.getWebElement().getSize().then(function (parentDim) {
	            parentHeight = parentDim.height;
	            var result = containerHeight <= parentHeight;
	            deferred.fulfill(result);
	        });
	    });

	    return deferred.promise;
    }

    //localization
    this.i18n = function (proArgs, opt_capitalize) {
        var key         = '',
            str         = '',
            strArray    = [],
            regEx 		= /\[\[([0-9a-z\.]*)\]\]/i,
		    matches 	= [];

        function formatString(str, args) {
            return str.replace(/{(\d+)}/g, function (match, number) {
                return typeof args[number] != 'undefined' ? args[number] : match;
            });
        }


        //fetch the string
        if (typeof proArgs === 'string')
            key = proArgs;
        else
            key = proArgs[0];

        str = browser.params.localizedMessages[key];

        if (str === undefined) {
    		//if the key wasn't found in localized messages, just return it for display
    		return key;
    	}

        //check for array
        if (str === '__array__') {
            var i = 0;
            var arrayElement = browser.params.localizedMessages[key + '_' + i];
            str = '';
            while (typeof arrayElement !== 'undefined') {
                if (opt_capitalize) {
                    strArray.push(arrayElement.toUpperCase());
                } else {
                    strArray.push(arrayElement);
                }
                i++;
                arrayElement = browser.params.localizedMessages[key + '_' + i];

            }
            str = strArray;
        }
        //replacement
		if (typeof str === 'string'){
			while ((matches = regEx.exec(str)) != null) {
				str = str.replace(matches[0],this.i18n(matches[1]));
			}
			if (opt_capitalize){
                str = str.toUpperCase();
			}
		} else {
			for (i = 0; i < str.length; i++) {
				// replace property token for each line in the array the same way
				while ((matches = regEx.exec(str[i])) != null) {
					str[i] = str[i].replace(matches[0],this.i18n(matches[1]));
				}
				if (opt_capitalize){
					str[i] = str[i].toUpperCase();
				}
			}
		}

        if (typeof proArgs === 'string') {
            return str;
        } else if (proArgs.length == 1) {
            return str;
        } else {
            proArgs.shift();
            if (typeof str === 'object') {
                // Handle the arrays differently from strings
                for (i = 0; i < str.length; i++) {
                    // Format each line in the array the same way
                    str[i] = formatString(str[i], propArgs);
                }
                return str;
            } else {
                return formatString(str, proArgs);
            }
        }
    }

};

module.exports = Helpers;
