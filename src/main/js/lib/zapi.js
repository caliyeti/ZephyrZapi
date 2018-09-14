/* 	zapi.js

@author Broc Skaggs

*/
var http = require('http');
var request = require('request');
var FormData = require('form-data');
var fs = require('fs');

var params = browser.params;
var Zapi = function () {
	var self = this;
		
	// jasmine2 made major changes on how the spec and tets are schdueled, it removes "currentSpec". 
	// To obatin the current running test information, we played a trick here by making our zapi to implement 
	// the jasmine reporter interface to obtain the current running test data
	self.jasmineStarted = function(summary){
		//nothing to do
	};
	
	self.suiteStarted = function(suite){
		//nothing to do
	};
	
	self.specStarted = function(spec){
		jasmine.getEnv().currentSpec = spec;
	};
	
	self.specDone = function(spec){
		delete jasmine.getEnv().currentSpec;
	}

	self.suiteDone = function(suite){
		//nothing to do
	};
	
	self.jasmineDone = function(){
		
	};

    /**
     * zapi sends the http request to ZAPI.
     *
     * @param apioptions    all the http request options: ex
     *
     * 		var zapioptions = {
     *		    host: params.zapiHost,
     *		    port: params.zapiPort,
     *		    path: ,
     *		    auth: params.zapiAuth,
     *		    method: 'PUT',
     *		    headers: {
     *		        'Content-Type': 'application/json'
     *		      },
     *		}
     * @param callback		The callback function
     */

    function zapi(apioptions, callback) {
        var responseString = '';
        var req = http.request(apioptions, function (res) {
            //console.log("Gotexpath response: " + res.statusCode);
            if (res.statusCode == 200) {
                //console.log("HEADERS: " + JSON.stringify(res.headers));
                res.setEncoding('utf8');

                res.on('data', function (chunk) {
                    //console.log("BODY: " + chunk);
                    responseString += chunk;
                });

                res.on('error', function (e) {
                    console.log("===ZAPI.JS==== Got error :" + e.message);
                });

                res.on('end', function () {
                    //console.log('======END========');
                    //console.log(responseString);
                    callback(null, responseString);
                });
            } else {
                console.log("Got response: " + res.statusCode);
                console.log(apioptions.path);
            }
        });
        //console.log(JSON.stringify(apioptions.body));
        if (apioptions.body) {
            req.write(JSON.stringify(apioptions.body));
        }

        req.end();
    }

    /**
     * getProductIDByName gets the list of product names and IDs from
     * ZAPI and returns the product ID via callback.
     *
     * @param callback	The callback function
     */

    function getProductIDByName(callback) {
        var zapioptions = {
            host: params.zapiHost,
            port: params.zapiPort,
            path: '/rest/zapi/latest/util/project-list',
            auth: params.zapiAuth,
            method: 'GET'
        }

        var products = []
        zapi(zapioptions, function (err, productList) {
            var projectJSON = JSON.parse(productList);
            var prodID;
            for (var i = 0; i < projectJSON.options.length; i++) {
                products[i] = projectJSON.options[i];
                if (products[i].label == params.zProd) {
                    productID = products[i].value;
                }
            }
            callback(null, productID);
        });

    }

    /**
     * getVersionIDByName gets the list of versions for a product
     * and calls back with the version ID that matches ver.
     *
     * @param prodID	the product ID, returned from getProductIDByName
     * @param callback	The callback function
     */

    function getVersionIDByName(prodID, callback) {
        var prodIDpath = '/rest/zapi/latest/util/versionBoard-list?projectId=' + prodID;

        var zapioptions = {
            host: params.zapiHost,
            port: params.zapiPort,
            path: prodIDpath,
            auth: params.zapiAuth,
            method: 'GET'
        }

        var versions = [];
        zapi(zapioptions, function (err, versionList) {
            var versionJSON = JSON.parse(versionList);
            var verID;
            for (var i = 0; i < versionJSON.unreleasedVersions.length; i++) {
                versions[i] = versionJSON.unreleasedVersions[i];
                if (versions[i].label == params.zVer) {
                    verID = versions[i].value;
                }
            }
            callback(null, verID);
        });
    }

    /**
     * getCycleID gets the Cycle ID for the cycle that matches the
     * version ID and cycle name built during onPrepare;
     *
     * @param versionID	the product ID, returned from getProductIDByName
     * @param callback	The callback function
     */

    function getCycleID(versionID, callback) {
        var cyclePath = '/rest/zapi/latest/cycle?versionId=' + versionID;

        var zapioptions = {
            host: params.zapiHost,
            port: params.zapiPort,
            path: cyclePath,
            auth: params.zapiAuth,
            method: 'GET'

        }

        var cycles = []
        zapi(zapioptions, function (err, cycleList) {
            //console.log(cycleList);
            var cycleJSON = JSON.parse(cycleList);
            //console.log(cycleJSON);
            var cycleID;
            //console.log(cycleID);

            for (var i in cycleJSON) {
                if (cycleJSON[i].name == params.zCycleName) {
                    cycleID = i;
                }
            }
            //console.log(cycleJSON);
            callback(null, cycleID);
        });
    }

    /**
     * getExecutionData retrieves all the executions associated with a test cycle.
     *
     * @param callback	The callback function
     */

    function getExecutionData(callback) {

        var exPath = '/rest/zapi/latest/execution?cycleId=' + params.zCycleID;

        var zapioptions = {
            host: params.zapiHost,
            port: params.zapiPort,
            path: exPath,
            auth: params.zapiAuth,
            method: 'GET'

        }

        var executions = []
        zapi(zapioptions, function (err, executionList) {
            params.executions = JSON.parse(executionList);
            callback(null, JSON.parse(executionList));
        });
    }

    /**
     * getExecutionIdByKey finds the Execution ID that matches the test case key,
     * which is the Jira/Zephyr key.
     *
     * @param executions   	Execution data, return from getExecutionData
     * @param key 			The Jira Key (ex EDGE-3333)
     */

    function getExecutionIdByKey(key) {
        for (var i in params.executions.executions) {
            if (params.executions.executions[i].issueKey == key) {
                return params.executions.executions[i].id;
            }
        }
    }

    /**
     * getExecutionIndexByKey finds the Execution ID that matches the test case key,
     * which is the Jira/Zephyr key.
     *
     * @param executions   	Execution data, return from getExecutionData
     * @param key 			The Jira Key (ex EDGE-3333)
     */

    function getExecutionIndexByKey(key) {
        for (var i in params.executions.executions) {
            if (params.executions.executions[i].issueKey == key) {
                return i;
            }
        }
    }

    /**
     * pass passes a test case by key
     *
     * @param key 		The Jira Key (ex EDGE-3333)
     * @param comment   The comment to leave on the execution
     * @param callback	The callback function
     *
     */

    function pass(key, comment, callback) {
        var expath = '/rest/zapi/latest/execution/' + getExecutionIdByKey(key) + '/execute';


        var exbody = '{  \"status\": \"1\", \"comment\": ' + JSON.stringify(comment.substring(0, 750)) + '  }';

        var zapioptions = {
            host: params.zapiHost,
            port: params.zapiPort,
            path: expath,
            auth: params.zapiAuth,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.parse(exbody)
        }
        var response;
        zapi(zapioptions, function (err, response) {
            callback(null, response);
        });
    }

    /**
     * fail fails a test case by key
     *
     * @param key 		The Jira Key (ex EDGE-3333)
     * @param comment   The comment to leave on the execution
     * @param callback	The callback function
     *
     */

    function fail(key, comment, callback) {
        var expath = '/rest/zapi/latest/execution/' + getExecutionIdByKey(key) + '/execute';

        var exbody = '{  \"status\": \"2\", \"comment\": ' + JSON.stringify(comment.substring(0, 750)) + '  }';

        var zapioptions = {
            host: params.zapiHost,
            port: params.zapiPort,
            path: expath,
            auth: params.zapiAuth,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.parse(exbody)
        }
        var response;
        zapi(zapioptions, function (err, response) {
            callback(null, response);
        });
    }

    /**
     * wip sets a test case to work in progress by key
     *
     * @param key 		The Jira Key (ex EDGE-3333)
     * @param comment   The comment to leave on the execution
     * @param callback	The callback function
     *
     */

    function wip(key, comment, callback) {

        var expath = '/rest/zapi/latest/execution/' + getExecutionIdByKey(key) + '/execute';

        var exbody = '{  \"status\": \"3\", \"comment\": ' + JSON.stringify(comment.substring(0, 750)) + '  }';

        var zapioptions = {
            host: params.zapiHost,
            port: params.zapiPort,
            path: expath,
            auth: params.zapiAuth,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.parse(exbody)
        }
        var response;
        zapi(zapioptions, function (err, response) {
            callback(null, response);
        });
    }

    /**
     * unExecute sets a test case to unexecuted by key
     *
     * @param key 		The Jira Key (ex EDGE-3333)
     * @param comment   The comment to leave on the execution
     * @param callback	The callback function
     *
     */

    function unExecute(key, comment, callback) {

        var expath = '/rest/zapi/latest/execution/' + getExecutionIdByKey(key) + '/execute';

        var exbody = '{  \"status\": \"-1\", \"comment\": ' + JSON.stringify(comment.substring(0, 750)) + '  }';

        var zapioptions = {
            host: params.zapiHost,
            port: params.zapiPort,
            path: expath,
            auth: params.zapiAuth,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.parse(exbody)
        }
        var response;
        zapi(zapioptions, function (err, response) {
            callback(null, response);
        });
    }

    /**
     * getExecutionAttachmentIds gets the attachments associated with a test execution
     *
     * @param key 		The Jira Key (ex EDGE-3333)
     * @param callback	The callback function
     *
     */

    function getExecutionAttachmentIds(key, callback) {

        var expath = '/rest/zapi/latest/attachment/attachmentsByEntity?entityId=' + getExecutionIdByKey(key) + '&entityType=EXECUTION';

        var zapioptions = {
            host: params.zapiHost,
            port: params.zapiPort,
            path: expath,
            auth: params.zapiAuth,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            // body: JSON.parse(exbody)
        }
        var response;
        zapi(zapioptions, function (err, response) {
            callback(null, JSON.parse(response));
        });
    }


    /**
     * deleteExecutionAttachment deletes all attachments that belong to a test execution
     *
     * @param fileId 	The IDs for all attachments, returned by getAttachmentIds
     * @param callback			The callback function
     *
     */

    function deleteExecutionAttachment(fileId) {
        var deferred = protractor.promise.defer();



        var zurl = 'http://' + params.zapiAuth + '@' + params.zapiHost + '/rest/zapi/latest/attachment/' + fileId;

        var request = require("request");
        request({
            url: zurl,
            body: '{ \n  \"id\": ' + fileId + '\n}',
            method: "DELETE"
        }, function (error, response, body) {
            //console.log("Status", response.statusCode);
            //console.log("Headers", JSON.stringify(response.headers));
            //console.log("Response received", body);
            deferred.fulfill(true);
        });


        return deferred.promise;
    }

    /**
     * deleteAllExecutionAttachments deletes all attachments that belong to a test execution
     *
     * @param attachmentIds 	The IDs for all attachments, returned by getAttachmentIds
     * @param callback			The callback function
     *
     */


    function deleteAllExecutionAttachments(attachments) {
        var deferred = protractor.promise.defer();

        if (attachments.data.length == 0) {
            deferred.fulfill(true);
        }

        var num = 0;

        for (var i in attachments.data) {
            deleteExecutionAttachment(attachments.data[i].fileId).then(function () {
                num++;
                if (num == attachments.data.length) {
                    deferred.fulfill(true);
                }
            });
        }

        return deferred.promise;
    }

    /**
     * deleteAllTestStepAttachments deletes all attachments that belong to a test step
     *
     * @param attachmentIds 	The IDs for all attachments, returned by getAttachmentIds
     * @param callback			The callback function
     *
     */

    function deleteTestStepAttachment(attachmentId, callback) {


        var zurl = 'http://' + params.zapiAuth + '@' + params.zapiHost + '/rest/zapi/latest/attachment/' + attachmentId

        var request = require("request");
        request({
            url: zurl,
            body: '{ \n  \"id\": ' + attachmentId + '\n}',
            method: "DELETE"
        }, function (error, response, body) {
            //console.log("Status", response.statusCode);
            //console.log("Headers", JSON.stringify(response.headers));
            //console.log("Response received", body);
        });

    }

    /**
     * attachScreenshotToExecution attaches a screenshot to a test execution.
     *
     * @param key 				The Jira Key (ex EDGE-3333)
     * @param stream 			The screenshot buffer or readstream
     * @param screenShotName	The filename
     *
     */

    function attachScreenshotToExecution(key, stream, screenShotName) {
        var deferred = protractor.promise.defer();

        var zurl = 'http://' + params.zapiAuth + '@' + params.zapiHost + '/rest/zapi/latest/attachment?entityId=' + getExecutionIdByKey(key) + '&entityType=EXECUTION';
        var request = require('request');
        var FormData = require('form-data');

        var form = new FormData();

        form.append('file', stream, {
            contentType: 'image/png',
            filename: screenShotName
        });
        //form.append('file', stream, {contentType: 'image/png'});

        form.getLength(function (err, length) {
            if (err) {
                //console.log("ERROR");
                deferred.fulfill(false);
                return requestCallback(err);
            }

            var zheaders = {
                "X-Atlassian-Token": "nocheck",
                "Accept": "application/json",
                "Content-Type": "multipart/form-data",
                "Content-Length": length
            }

            var r = request.post({
                url: zurl,
                headers: zheaders
            }, requestCallback);

            r._form = form;
            r.on('end', function () {
                deferred.fulfill(true);
            });
        });

        function requestCallback(err, res, body) {
            //console.log("Status", res.statusCode);
            //console.log("Headers", JSON.stringify(res.headers));
            //console.log(body);
        }
        return deferred.promise;
    }

    /**
     * attachLogToExecution attaches a txt file to a test execution.
     *
     * @param key 				The Jira Key (ex EDGE-3333)
     * @param stream 			A read file stream.
     * @param callback			The callback function
     *
     */

    function attachLogToExecution(key, stream, filename, callback) {
        var zurl = 'http://' + params.zapiAuth + '@' + params.zapiHost + '/rest/zapi/latest/attachment?entityId=' + getExecutionIdByKey(key) + '&entityType=EXECUTION';

        var request = require('request');
        var FormData = require('form-data');

        var form = new FormData();

        form.append('file', stream, {
            contentType: 'text/plain',
            filename: filename
        });

        form.getLength(function (err, length) {
            if (err) {
                //console.log("ERROR");
                return requestCallback(err);
            }

            var zheaders = {
                "X-Atlassian-Token": "nocheck",
                "Accept": "application/json",
                "Content-Type": "multipart/form-data"
            }

            var r = request.post({
                url: zurl,
                headers: zheaders
            }, requestCallback);
            r._form = form;
            r.setHeader('content-length', length);
        });

        function requestCallback(err, res, body) {
            //console.log("Status", res.statusCode);
            //console.log("Headers", JSON.stringify(res.headers));
            //console.log(body);
        }
    }

    /**
     * getZapiIDs gets the product ID, Version ID, and Cycle ID
     *
     * @param callback			The callback function
     *
     */

    function getZapiIDs(callback) {
        getProductIDByName(function (err, ProdID) {
            params.zProdID = ProdID;
            getVersionIDByName(ProdID, function (err, VerID) {
                params.zVerID = VerID;
                getCycleID(VerID, function (err, CycleID) {
                    params.zCycleID = CycleID;
                    callback(null, CycleID);
                });
            });
        });
    }

    /**
     * onPrepare does the following:
     * Gets all the internal Zephyr IDs (cycle, version, product, and execution IDs) and sets them in browser.params
     * Sets all executions in the cycle to work in progress, and removes old attachments from executions.
     * Gets all execution test steps, saves them for each execution as executions[i].testSteps.
     * For each test step, it delete existing attachments and sets it to unexecuted.
     *
     * Should be ran in Jasmine's onPrepare();
     * This should finish executing before beforeEach starts.
     *
     */

    function onPrepare() {
        var deferred = protractor.promise.defer();
        var time = new Date().getTime();;

        getZapiIDs(function (err, callback) {
            // Then get the executions for the cycle
            console.log("Retrieving ZAPI IDs...");
            getExecutionData(function (err, ex) {
                // Get all the test step data, save it to the execution data.
                console.log("Getting execution data...");
                prepareExecutions().then(function (p) {
                    console.log("Preparing test executions...");
                    getAllTestSteps().then(function (p) {
                        console.log("Getting test steps...");
                        prepareTestSteps().then(function (p) {

                            var finished = new Date().getTime() - time;
                            console.log(browser.browserName + ': OnPrepare took ' + finished + 'ms');
                            deferred.fulfill(true);
                        });
                    });
                });
            });
        });
        return deferred.promise;
    }

    /**
     *  Wraps onPrepare to put it into the controlFlow queue.
     *
     */

    this.onPrepare = function () {
        var deferred = protractor.promise.defer();

        browser.controlFlow().execute(function () {
            if (params.logToZ) {
                return onPrepare();
            } else {
                return true;
            }
        }).then(function (res) {
            deferred.fulfill(res);
        });

        return deferred.promise;
    }

    /**
     * prepareExecutions() does the following:
     * Sets all executions in the cycle to work in progress, and removes old attachments from executions.
     *
     */

    function prepareExecutions() {
        var deferred = protractor.promise.defer();

        var pnum = 0; // counts returned promises.
        var expected = params.executions.executions.length * 2;

        // Set all executions to unExecuted, and delete attachments.
        for (var i in params.executions.executions) {
            unExecute(params.executions.executions[i].issueKey, " ", function (err, callback) {
                pnum++;

                if (pnum == expected) {
                    deferred.fulfill(true);
                }
            });

            getExecutionAttachmentIds(params.executions.executions[i].issueKey, function (err, attachmentIds) {
                deleteAllExecutionAttachments(attachmentIds).then(function () {
                    pnum++;


                }).then(function () {
                    if (pnum == expected) {
                        deferred.fulfill(true);
                    }
                });
            });
        }

        return deferred.promise;
    }


    /**
     * prepareTestSteps does the following:
     * Gets all execution test steps, saves them for each execution as executions[i].testSteps.
     * For each test step, it delete existing attachments and sets it to unexecuted.
     *
     * Should be ran in Jasmine's onPrepare();
     * This should finish executing before beforeEach starts.
     *
     */

    function prepareTestSteps() {
        var deferred = protractor.promise.defer();

        num = 0;
        for (var i in params.executions.executions) {
            //console.log("params.executions " + i + " " + JSON.stringify(params.executions.executions[i]));
            prepareTestStepAttachments(params.executions.executions[i], function (err, callback) {
                //console.log("prepareTestStepAttachments callback = " + callback);
                num++;
                //console.log("matts special output num=" + num + " i=" + i + " length= " + params.executions.executions.length);
                if (num == params.executions.executions.length) {
                    deferred.fulfill(true);
                }

            });
        }

        return deferred.promise;
    }

    /**
     * prepareTestStepAttachments cycles through the list of TestSteps of an execution
     * to set them to unexecute and remove attachments.
     *
     * @params teststeps		All the test steps associated with an execution.
     */

    function prepareTestStepAttachments(testExecution, callback) {
        var deferred = protractor.promise.defer();
        var num = 0;
        var testSteps = testExecution.testSteps;
        var expected = testSteps.length;

        if (expected == 0) {
            deferred.reject("ZAPI.JS ERROR: No Test Steps for "+JSON.stringify(testExecution.issueKey)+".  Verify in JIRA and try again.");
        } else {
    		for (var i in testSteps) {
                //console.log("prepareTestStepAttachments i=" + i + " testSteps[i].id= " + testSteps[i].id);
                unExecuteStepByStepResultID(testSteps[i].id, function (err, response) {
                    //console.log("success? " + response);
                }).then(function (err) {
                    deleteTestStepAttachments(testSteps[i], function (err, attachments) {
                        num++;
                        //console.log("callback from deleteTestStepAttachments num= " + num);
                        if (expected == num) {
                            //console.log("callback from deleteTestStepAttachments  testSteps= " + JSON.stringify(testSteps));
                            callback(null, attachments);
                            deferred.fulfill(true);
                        }
                    })
                });
            }
        }
        return deferred.promise;
    }

    /**
     * deleteTestStepAttachments deletes any attachments for the test step
     *
     * @params teststep		The test step to check for attachments.
     */

    function deleteTestStepAttachments(testStep, callback) {
        var deferred = protractor.promise.defer();

        var numDeleted = 0;
        getStepResultAttachments(testStep, function (err, attachments) {
            if (attachments.data.length == 0) {
                deferred.fulfill(true);
                callback(null, true);
            }

            for (var i in attachments.data) {

                //console.log(attachments.data[i].fileId);
                deleteExecutionAttachment(attachments.data[i].fileId, function (err, callback) {
                    numDeleted++;
                    if (numDeleted == attachments.data.length) {
                        deferred.fulfill(true);
                        callback(null, true);
                    }
                });

            }


            //deleteExecutionAttachment()
            for (var i in attachments.data) {
                if (attachments.data[i].fileId);
            }


        });

        return deferred.promise;

    }

    /**
     * countAttachments returns the number of attachments. there is not a length attribute
     * for attachment data.
     *
     *
     */


    function countAttachments(attachments, callback) {

        var numAttachments = 0;

        for (var i in attachments.data) {

            if (attachments.data[i].fileId) {
                //console.log(attachments.data[i].fileId);
                numAttachments++;
            }
        }

        callback(null, numAttachments);


    }

    function getStepResultAttachments(testSteps, callback) {
        var deferred = protractor.promise.defer();

        var expath = '/rest/zapi/latest/attachment/attachmentsByEntity?entityId=' + testSteps.id + '&entityType=TESTSTEPRESULT';
        //console.log(expath);

        var zapioptions = {
            host: params.zapiHost,
            port: params.zapiPort,
            path: expath,
            auth: params.zapiAuth,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },

        }
        var response;
        zapi(zapioptions, function (err, response) {
            //console.log(response);
            deferred.fulfill(true);
            callback(null, JSON.parse(response));
        });

        return deferred.promise;
    }


    /**
     * getBrowserLogs gets the browser's console log from each browser,
     * and attaches it to the test execution.
     *
     * This does not work on IE. This may need to be updated if we add mobile
     * browsers.
     *
     */


    getBrowserLogs = function () {
        var deferred = protractor.promise.defer();

        var spec = jasmine.getEnv().currentSpec,
            logs = browser.driver.manage().logs(),
            logType = 'browser',
            consoleLogName = spec.description + '_browser_log_' + browser.browserName.split(' ').join('_') + '.txt';

        browser.controlFlow().execute(function () {
            if (browser.browserName != 'internet explorer') {
                logs.getAvailableLogTypes().then(function (logTypes) {
                    if (logTypes.indexOf(logType) > -1) {
                        var consoleLogName = spec.description + '_browser_log_' + browser.browserName.split(' ').join('_') + '.txt';

                        browser.driver.manage().logs().get(logType).then(function (logsEntries) {
                            var msg = 'TIMESTAMP       NAME      MESSAGE';

                            for (var i = 0; i < logsEntries.length; ++i) {
                                var logEntry = logsEntries[i];
                                msg = msg + '\n' + logEntry.timestamp + ' ' + logEntry.name + ' ' + logEntry.message;
                            }

                            var logBuffer = new Buffer(msg, 'utf8');

                            attachLogToExecution(spec.description, logBuffer, consoleLogName, function (err, callback) {});
                        });
                    }
                });
            }


        }).then(function (res) {
            deferred.fulfill(res);
        });


        return deferred.promise;
    }

    /**
     * afterEach passes or fails the current test in Zephyr, it also adds comments with the
     * browser version and platform. On failure it gets the stack trace information, logs it
     * to a file, and uploads it as an attachment to the test execution.
     *
     *
     */

    function afterEach() {
        var deferred = protractor.promise.defer();

        var spec = jasmine.getEnv().currentSpec;
        var attachmentName = spec.description + '_' + browser.browserName.split(' ').join('_') + '_log.txt';
        var comment = 'Browser Version: ' + browser.browserVersion +
            '\nPlatform: ' + browser.platform +
            '\nRunTime: ' + (new Date().getTime() - jasmine.getEnv().currentSpec.startTime) + 'ms';

        // Log to Zephyr
        if (spec.failedExpectations.length == 0) {
            pass(spec.description, comment, function (err, callback) {
                deferred.fulfill(true);
            });
        } else {
            // Get failure messages from each spec to post in comment

            var failLog = comment;
            if (spec.failureMessage) {
            	for(var i = 0; i < spec.failedExpectations.length; i ++){
            		failLog = failLog + '\n' + spec.failedExpectations[i].message;            		
            	}
            }
         
            // Attach browser log
            getBrowserLogs();

            for (var i in spec.failedExpectations) {
                 failLog = failLog + '\n\n' + spec.failedExpectations[i].message + '\n\n' + spec.failedExpectations[i].stack;
            }

            // Write a to a log file
            fs.writeFile(params.logDir + attachmentName, failLog, function (err) {
                var failBuffer = new Buffer(failLog, 'utf8');

                attachLogToExecution(spec.description, failBuffer, attachmentName, function (err, callback) {});
            });

            // Zephyr has a 750 char limit.
            fail(spec.description, comment, function (err, callback) {
                deferred.fulfill(true);
            });
        }



        return deferred.promise;
    }

    this.afterEach = function () {
        var deferred = protractor.promise.defer();

        browser.controlFlow().execute(function () {
            if (params.logToZ) {
                return afterEach();
            } else {
                return true;
            }
        }).then(function (res) {
            deferred.fulfill(res);
        });

        return deferred.promise;
    }


    /**
     * takeScreenshot takes a screenshot and attaches it to the current test execution.
     *
     * @param stepName 			The name of the test step
     *
     */

    function takeScreenshot(stepName) {
        var deferred = protractor.promise.defer();

        var screenShotName = jasmine.getEnv().currentSpec.description + '_' + stepName + '_' + browser.browserName.split(' ').join('_');

        // This sleep delay can be used to resolve timing issues.
        browser.sleep(params.screenshotDelay).then(function () {

            browser.takeScreenshot().then(function (png) {

                var screenShot = new Buffer(png, 'base64');

                if (params.saveScreenshots) {
                    // This write the file to disk, disabling for now.
                    var wstream = fs.createWriteStream(params.screenshotDir + screenShotName + '.png');
                    wstream.write(screenShot);
                    wstream.end();
                }
                if (params.logToZ) {
                    attachScreenshotToExecution(jasmine.getEnv().currentSpec.description, screenShot, screenShotName).then(function (response) {
                        deferred.fulfill(response);
                    });
                } else {
                    deferred.fulfill(response);
                }
                return deferred.promise;
            })
        });

        return deferred.promise;
    }

    this.takeScreenshot = function (stepName) {
        var deferred = protractor.promise.defer();

        browser.controlFlow().execute(function () {
            if (params.logToZ) {
                return takeScreenshot(stepName);
            } else {
                browser.sleep(params.noLogDelay);
                return true;
            }
        }).then(function (res) {
            deferred.fulfill(res);
        });

        return deferred.promise;
    }

    /**
     * getAllTestSteps gets the test steps for each execution in the cycle
     *
     * returns a promise once test steps for every execution has been set via
     * setexecutionTestStpes;
     *
     */


    function getAllTestSteps() {
        var deferred = protractor.promise.defer();
        var pnum = 0; // counts returned promises

        for (var i in params.executions.executions) {
            setExecutionTestSteps(i).then(function (prom) {
                if (prom) {
                    pnum++;
                    if (pnum == params.executions.executions.length) {
                        deferred.fulfill(prom);
                    }
                }
            });
        }

        return deferred.promise;
    }




    /**
     * setExecutionTestSteps sets all exectuion steps to execution.testSteps
     *
     * @params index	identifies the index of the execution that owns the test steps.
     */

    function setExecutionTestSteps(index) {
        var deferred = protractor.promise.defer();


        getStepsOfExecution(params.executions.executions[index].id, function (err, orderedTestSteps) {
            if (err) {
                console.log('');
                console.log(err);
                console.log('Test Case: ' + params.executions.executions[index].issueKey);
                console.log('Cycle Name: ' + params.zCycleName);
                console.log('Version: ' + params.zVer);
                console.log('Click Execute (E button) in test cycle to sync test cases');
                console.log('');
            }

            //console.log(params.executions.executions[index].id);
            //console.log(params.executions.executions[index].issueKey);
            //console.log(params.executions.executions[index].issueId);
            //console.log(orderedTestSteps);

            params.executions.executions[index].testSteps = orderedTestSteps;
            deferred.fulfill(true);

        });


        return deferred.promise;
    }


    /****
     *
     * beforeEach() sets up variables needed to pass each test step, and takes a screenshot.
     *
     *
     */

    function beforeEach() {
        var deferred = protractor.promise.defer();
        
        
        spec = jasmine.getEnv().currentSpec;
        spec.startTime = new Date().getTime();
        spec.failures = 0;

        browser.controlFlow().execute(function () {
            deferred.fulfill(takeScreenshot('beforeEach'));
        });

        return deferred.promise;
    }

    this.beforeEach = function () {
        var deferred = protractor.promise.defer();

        browser.controlFlow().execute(function () {
            if (params.logToZ) {
                return beforeEach();
            } else {
                return true;
            }

        }).then(function (res) {
            deferred.fulfill(res);
        });

        return deferred.promise;

    }

    /**
     * completeTestStep passes a test step in Zephyr for the current spec.
     *
     * @param stepNumber 	The order of the test.
     */


    function completeTestStep(stepNumber) {
        var deferred = protractor.promise.defer();

        browser.controlFlow().execute(function () {
            var description = jasmine.getEnv().currentSpec.description;

            var index = getExecutionIndexByKey(jasmine.getEnv().currentSpec.description);

            spec = jasmine.getEnv().currentSpec;

            if (stepNumber == 'last') {
                stepNumber = params.executions.executions[index].testSteps.length;
            }

            if(spec.failedExpectations.length <= spec.failures){
            	passStep(stepNumber);
            	deferred.fulfill(true);
            }else{
            	failStep(stepNumber);
            	spec.failures = spec.failedExpectations.length;
            	deferred.fulfill(true);
            }
        });

        return deferred.promise;
    }

    /**
     * completeTestStep passes a test step in Zephyr for the current spec.
     *
     * @param stepNumber 	The order of the test.
     */

    this.completeTestStep = function (stepName) {
        var deferred = protractor.promise.defer();

        browser.controlFlow().execute(function () {
            if (params.logToZ) {
                return completeTestStep(stepName);
            } else {
                return true;
            }

        }).then(function (res) {
            deferred.fulfill(res);
        });

        return deferred.promise;

    }

    /**
     * getExecutionSteps gets all of the test steps, and saves them to the current spec
     * in the correct order.
     *
     *
     */

    function getStepsOfCurrentSpec() {
        var deferred = protractor.promise.defer();


        getIssueIdOfCurrentSpec(function (err, issueID) {
            getTestStepsFromIssue(issueID, function (err, testSteps) {
                getStepResultsOfCurrentSpec(function (err, stepResults) {
                    mergeStepsAndResults(stepResults, testSteps, function (err, orderedTestSteps) {
                        jasmine.getEnv().currentSpec.orderedSteps = orderedTestSteps;
                        deferred.fulfill(true);
                    });
                });
            });
        });


        return deferred.promise;
    }

    /**
     * getStepsOfExecution gets all of the test steps and returns them in the proper order.
     *
     * params 	executionId 	The ID of the execution.
     */


    function getStepsOfExecution(executionId, callback) {
        var deferred = protractor.promise.defer();


        getIssueIDbyExecutionID(executionId, function (err, issueID) {
            getTestStepsFromIssue(issueID, function (err, testSteps) {
                getStepResultsByExecutionId(executionId, function (err, stepResults) {
                    mergeStepsAndResults(stepResults, testSteps, function (err, orderedTestSteps) {
                        callback(err, orderedTestSteps);
                    });
                });
            });
        });

    }

    /**
     * getIssueID gets the issue ID of an Test in Zephyr
     *
     * params 	callback	The callback function.
     */

    function getIssueIdOfCurrentSpec(callback) {
        var zpath = '/rest/zapi/latest/execution/' + getExecutionIdByKey(jasmine.getEnv().currentSpec.description) + '/';


        var zapioptions = {
            host: params.zapiHost,
            port: params.zapiPort,
            path: zpath,
            auth: params.zapiAuth,
            method: 'GET',
        }
        var response;
        zapi(zapioptions, function (err, response) {
            var executionJSON = JSON.parse(response);
            callback(null, executionJSON.execution.issueId);
        });
    }

    /**
     * getIssueIDbyExecutionID gets the issue ID of an Test in Zephyr
     *
     * @param executionId a specific execution ID.
     */

    function getIssueIDbyExecutionID(executionId, callback) {
        var zpath = '/rest/zapi/latest/execution/' + executionId + '/';

        var zapioptions = {
            host: params.zapiHost,
            port: params.zapiPort,
            path: zpath,
            auth: params.zapiAuth,
            method: 'GET',
        }
        var response;
        zapi(zapioptions, function (err, response) {
            var executionJSON = JSON.parse(response);
            callback(null, executionJSON.execution.issueId);
        });
    }

    /**
     * getTestStepsFromIssue gets the test steps from a test case in Zephyr. These may not be in order.
     *
     * @param issueID The issue ID of the test, the internal Zypher id.
     */

    function getTestStepsFromIssue(issueID, callback) {
        var zpath = '/rest/zapi/latest/teststep/' + issueID + '/';
        var zapioptions = {
            host: params.zapiHost,
            port: params.zapiPort,
            path: zpath,
            auth: params.zapiAuth,
            method: 'GET',
        }

        zapi(zapioptions, function (err, response) {
            //console.log(response);
            callback(null, JSON.parse(response));
        });
    }

    /**
     * getStepResultsOfCurrentSpec returns the step results from an execution, this JSON contains the
     * test step order.
     *
     */

    function getStepResultsOfCurrentSpec(callback) {
        var expath = '/rest/zapi/latest/stepResult?executionId=' + getExecutionIdByKey(jasmine.getEnv().currentSpec.description);

        var zapioptions = {
            host: params.zapiHost,
            port: params.zapiPort,
            path: expath,
            auth: params.zapiAuth,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },

        }
        zapi(zapioptions, function (err, response) {
            //console.log(response);
            callback(null, JSON.parse(response));
        });
    }

    /**
     * getStepResultsByExecutionId returns the step results from an execution, this JSON contains the
     * test step order.
     *
     * @param executionId		A specific execution ID.
     *
     */

    function getStepResultsByExecutionId(executionId, callback) {
        var expath = '/rest/zapi/latest/stepResult?executionId=' + executionId;

        var zapioptions = {
            host: params.zapiHost,
            port: params.zapiPort,
            path: expath,
            auth: params.zapiAuth,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },

        }
        zapi(zapioptions, function (err, response) {
            //console.log(response);
            callback(null, JSON.parse(response));
        });
    }


    /**
     * mergeStepsAndResults Creates a new array that has the test step IDs and order so we can
     * have useful data
     *
     * @param stepResutls		step result data, has the test step order.
     * @param testSteps			test steps
     *
     */

    function mergeStepsAndResults(stepResults, testSteps, callback) {
        var steps = [];

        for (var i in stepResults) {
            for (var j in testSteps) {
                if (stepResults[i].stepId == testSteps[j].id) {

                    var step = {
                        id: stepResults[i].id,
                        stepId: stepResults[i].stepId,
                        orderId: testSteps[j].orderId,
                    };
                    steps.push(step);
                }
            }
        }
        var e = null;
        if (stepResults.length != testSteps.length) {
            e = new Error("Test Steps Results out of Sync");
        }


        callback(e, steps);
    }

    /**
     * passStep finds the step result ID for the test by its stepnum,
     * calls passStepByStepResultID to do the passing.
     *
     * @param stepNum 		The order of the test step.
     */

    function passStep(stepNum) {
        var deferred = protractor.promise.defer();

        var index = getExecutionIndexByKey(jasmine.getEnv().currentSpec.description);

        var testSteps = params.executions.executions[index].testSteps;

        for (var i in testSteps) {
            if (testSteps[i].orderId == stepNum) {
                passStepByStepResultID(testSteps[i].id, function (err, response) {
                    deferred.fulfill(response);
                });
            }
        }
        return deferred.promise;
    }

    /**
     * failStep finds the step result ID for the test by its stepnum,
     * calls failStepByStepResultID to do the failing.
     *
     * @param stepNum 		The order of the test step.
     */


    function failStep(stepNum) {
        var deferred = protractor.promise.defer();

        var index = getExecutionIndexByKey(jasmine.getEnv().currentSpec.description);

        var testSteps = params.executions.executions[index].testSteps;

        for (var i in testSteps) {
            if (testSteps[i].orderId == stepNum) {
                failStepByStepResultID(testSteps[i].id, function (err, response) {
                    deferred.fulfill(response);
                });
            }
        }
        return deferred.promise;
    }

    /**
     * wipStep finds the step result ID for the test by its stepnum,
     * calls wipStepByStepResultID to do the failing.
     *
     * @param stepNum 		The order of the test step.
     */


    function wipStep(stepNum) {
        var deferred = protractor.promise.defer();

        var index = getExecutionIndexByKey(jasmine.getEnv().currentSpec.description);

        var testSteps = params.executions.executions[index].testSteps;

        for (var i in testSteps) {
            if (testSteps[i].orderId == stepNum) {
                wipStepByStepResultID(testSteps[i].id, function (err, response) {
                    deferred.fulfill(response);
                });
            }
        }
        return deferred.promise;
    }

    /**
     * unExecuteStep finds the step result ID for the test by its stepnum,
     * calls unExecuteStepByStepResultID to do the failing.
     *
     * @param stepNum 		The order of the test step.
     */


    function unExecuteStep(stepNum) {
        var deferred = protractor.promise.defer();

        var index = getExecutionIndexByKey(jasmine.getEnv().currentSpec.description);

        var testSteps = params.executions.executions[index].testSteps;

        for (var i in testSteps) {
            if (testSteps[i].orderId == stepNum) {
                unExecuteStepByStepResultID(testSteps[i].id, function (err, response) {
                    deferred.fulfill(response);
                });
            }
        }
        return deferred.promise;
    }

    /** passStepByStepResultID sends the http request to pass a test step
     *
     * @params 	stepResultId	The ID that identifies the step to pass.
     *
     */


    function passStepByStepResultID(stepResultId, callback) {
        var deferred = protractor.promise.defer();

        var expath = '/rest/zapi/latest/stepResult/' + stepResultId + '/quickExecute';

        var exbody = "{  \"status\": \"1\" }"

        var zapioptions = {
            host: params.zapiHost,
            port: params.zapiPort,
            path: expath,
            auth: params.zapiAuth,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.parse(exbody)
        }
        var response;
        zapi(zapioptions, function (err, res) {
            deferred.fulfill(res);
            callback(null, res);
        });

        return deferred.promise;

    }

    /** failStepByStepResultID sends the http request to fail a test step
     *
     * @params 	stepResultId	The ID that identifies the step to pass.
     *
     */

    function failStepByStepResultID(stepResultId, callback) {
        var deferred = protractor.promise.defer();

        var expath = '/rest/zapi/latest/stepResult/' + stepResultId + '/quickExecute';

        var exbody = "{  \"status\": \"2\" }"

        var zapioptions = {
            host: params.zapiHost,
            port: params.zapiPort,
            path: expath,
            auth: params.zapiAuth,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.parse(exbody)
        }
        var response;
        zapi(zapioptions, function (err, res) {
            deferred.fulfill(res);
            callback(null, res);
        });

        return deferred.promise;
    }

    /** wipStepByStepResultID sends the http request to wip a test step
     *
     * @params 	stepResultId	The ID that identifies the step to pass.
     *
     */

    function wipStepByStepResultID(stepResultId, callback) {
        var deferred = protractor.promise.defer();

        var expath = '/rest/zapi/latest/stepResult/' + stepResultId + '/quickExecute';

        var exbody = "{  \"status\": \"3\" }"

        var zapioptions = {
            host: params.zapiHost,
            port: params.zapiPort,
            path: expath,
            auth: params.zapiAuth,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.parse(exbody)
        }
        var response;
        zapi(zapioptions, function (err, res) {
            deferred.fulfill(res);
            callback(null, res);
        });

        return deferred.promise;
    }

    /** unExecuteStepByStepResultID sends the http request to unexecute a test step
     *
     * @params 	stepResultId	The ID that identifies the step to pass.
     *
     */

    function unExecuteStepByStepResultID(stepResultId, callback) {
        var deferred = protractor.promise.defer();

        var expath = '/rest/zapi/latest/stepResult/' + stepResultId + '/quickExecute';

        var exbody = "{  \"status\": \"-1\" }"

        var zapioptions = {
            host: params.zapiHost,
            port: params.zapiPort,
            path: expath,
            auth: params.zapiAuth,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.parse(exbody)
        }
        var response;
        zapi(zapioptions, function (err, res) {
            deferred.fulfill(res);
            callback(null, res);
        });

        return deferred.promise;
    }
};

module.exports = Zapi;
