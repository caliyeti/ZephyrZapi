/* 	zapi.js

 @author Broc Skaggs

 */
var http = require('http');
var request = require('request');
var FormData = require('form-data');
var fs = require('fs');
var jwt = require('atlassian-jwt');
var hashes = require('jshashes');
var Client = require("zapi_nodejs");


// JWT EXPIRE how long token been to be active? 3600 == 1 hour
var JWT_EXPIRE = 3600;

// hashLib instance
var hashlib =  new hashes.SHA256;

var CANONICAL_PATH = '';


var params = browser.params;

var JwtClient = new Client(params.zephyrBaseUrl, params.accessKey, params.secretKey, params.userName);

var exList = [];

var stepResultsOpt = {
    ignoreResults : {
        id: 0,
        desc: "Ignore All Step Results"
    },
    updateAll : {
        id: 1,
        desc: "Update All Step Results"
    },
    failedOnly : {
        id: 2,
        desc: "Update Only Steps That Fail"
    }
};

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
    };

    self.suiteDone = function(suite){
        //nothing to do
    };

    self.jasmineDone = function(){

    };

    /**
     * zapi sends the http request to ZAPI.
     *
     * @param apiOptions    all the http request options: ex
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

    function zapi(apiOptions, callback) {

        var responseString = '';
        var req = http.request(apiOptions, function (res) {
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
                console.log(apiOptions.path);
            }
        });
        //console.log(JSON.stringify(apioptions.body));
        if (apiOptions.body) {
            req.write(JSON.stringify(apiOptions.body));
        }

        req.end();
    }

    function sleep(d){
        for(var t = Date.now();Date.now() - t <= d;);
    }

    function updateRequestCount(){
        params.zapiRequestCount++;
    }

    /**
     * getProductIDByName gets the list of product names and IDs from
     * ZAPI and returns the product ID via callback.
     *
     * @param callback	The callback function
     */

    function getProductIDByName(callback) {
        // var deferred = protractor.promise.defer();

        var zurl =  '/rest/api/2/project'

        request({
            method: 'GET',
            url:  params.jiraBaseUrl + zurl,
            auth: {
                user:params.userName,
                pass:params.passwd,
                sendImmediately:true
            },
        }, function (error, response, body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                var products = []
                var projectJSON = JSON.parse(body);
                var prodID;
                for (var i = 0; i < projectJSON.length; i++) {
                    products[i] = projectJSON[i];
                    if (products[i].name == params.zProd) {
                        prodID = products[i].id;
                    }
                }
                console.log('productId: '+ prodID);
                callback(null, prodID);
            }else{
                console.log('failed to get product id');
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
                callback(null, body);
            }

        })


    }

    /**
     * getVersionIDByName gets the list of versions for a product
     * and calls back with the version ID that matches ver.
     *
     * @param prodID	the product ID, returned from getProductIDByName
     * @param callback	The callback function
     */

    function getVersionIDByName(prodID, callback) {
        var prodIDpath = '/rest/api/2/project/' + prodID +'/version';

        var zapioptions = {
            url:params.jiraBaseUrl+ prodIDpath,
            auth: {
                user:params.userName,
                pass:params.passwd,
                sendImmediately:true
            },
            method: 'GET'
        }

        var versions = [];
        request(zapioptions, function (error, response,body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                var versionJSON = JSON.parse(body);
                var verID;
                for (var i = 0; i < versionJSON.values.length; i++) {
                    var result = versionJSON.values[i];
                    if (result.name == params.zVer) {
                        verID = result.id;
                    }
                }
                console.log('versionId: '+ verID );
                callback(null, verID);
            }else{
                console.log('failed to get version id');
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
                callback(null, body);
            }

        });
    }

    function createTestCycle(projectId, versionId,cycleName,callback){
        var deferred = protractor.promise.defer();
        console.log("Create test cycle... ");

        var zurl = params.zephyrBaseUrl + '/public/rest/api/1.0/cycle';

        // encode
        var token = JwtClient.generateJWT('POST', zurl, JWT_EXPIRE);

        var JSbody = {};
        JSbody.name = cycleName;
        JSbody.projectId = projectId;
        JSbody.versionId = versionId;

        var zapioptions = {
            url:  zurl,
            method: 'POST',
            json: true,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'JWT '+token,
                'zapiAccessKey': params.accessKey,
                'User-Agent': 'ZAPI',
            },
            json: JSbody
        }

        request(zapioptions, function (err, response, body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                var cycleID = body.id;
                console.log('cycleID: '+ cycleID);
                callback(null, cycleID);
            }else{
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
                callback(null, body);
            }
        });
        updateRequestCount();
        return deferred.promise;
    }

    function addTestCasesToCycle(issues,projectId,versionId,cycleID,callback){
        var deferred = protractor.promise.defer();
        console.log("Add test cases to test cycle... ");

        var zurl = params.zephyrBaseUrl + '/public/rest/api/1.0/executions/add/cycle/'+cycleID ;

        // encode
        var token = JwtClient.generateJWT('POST', zurl, JWT_EXPIRE);

        var JSbody = {};
        JSbody.issues = issues;
        JSbody.projectId = projectId;
        JSbody.versionId = versionId;
        JSbody.method = 1;

        var zapioptions = {
            url:  zurl,
            method: 'POST',
            json: true,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'JWT '+token,
                'zapiAccessKey': params.accessKey,
                'User-Agent': 'ZAPI',
            },
            json: JSbody
        }

        request(zapioptions, function (err, response, body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                callback(null, body);
            }else{
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
                callback(null, body);
            }
        });
        updateRequestCount();
        return deferred.promise;
    }

    /**
     * getCycleID gets the Cycle ID for the cycle that matches the
     * version ID and cycle name built during onPrepare;
     *
     * @param versionID	the product ID, returned from getProductIDByName
     * @param callback	The callback function
     */

    function getCycleID(prodID,versionID, callback) {

        var cyclePath = '/public/rest/api/1.0/cycles/search?projectId='+ prodID + '&versionId=' + versionID;

        var token = JwtClient.generateJWT('GET', params.zephyrBaseUrl + cyclePath, JWT_EXPIRE);

        var zapioptions = {
            url: params.zephyrBaseUrl + cyclePath,
            method: 'GET',
            headers: {
                'Content-Type': 'text/plain',
                'Authorization': 'JWT '+token,
                'zapiAccessKey': params.accessKey,
                'User-Agent': 'ZAPI',
            }

        }

        var cycles = []
        request(zapioptions, function (error, response, body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                var cycleJSON = JSON.parse(body);
                var cycleID;

                for (var i in cycleJSON) {
                    if (cycleJSON[i].name == params.zCycleName) {
                        cycleID = cycleJSON[i].id;
                    }
                }
                console.log('cycleID: '+ cycleID);
                callback(null, cycleID);
            }else{
                console.log('failed to get cycle id!');
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
                callback(null, body);
            }

        });
        updateRequestCount();
    }

    /**
     * getExecutionData retrieves all the executions associated with a test cycle.
     *
     * @param callback	The callback function
     */

    function getExecutionList(callback){
        var exPath = '/public/rest/api/1.0/executions/search/cycle/'+ params.zCycleID+'?projectId='+ params.zProdID+ '&versionId='+params.zVerID;

        var token = JwtClient.generateJWT('GET', params.zephyrBaseUrl + exPath, JWT_EXPIRE);

        var zapioptions = {
            url: params.zephyrBaseUrl + exPath,
            method: 'GET',
            headers: {
                'Content-Type': 'text/plain',
                'Authorization': 'JWT '+token,
                'zapiAccessKey': params.accessKey,
                'User-Agent': 'ZAPI',
            }

        }
        var executionList = [];
        request(zapioptions, function (error, response, body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                executionList = JSON.parse(body);
                var totalCount = executionList.totalCount;
                console.log('totalCount: '+totalCount);
                callback(null, totalCount);
            }else{
                console.log('failed to get execution list!');
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
                callback(null, body);
            }

        });
        updateRequestCount();
    }


    function getExecutionData(offset,callback) {

        var deferred = protractor.promise.defer();
        console.log(">>getExecutionData offset:" +offset);

        var exPath = '/public/rest/api/1.0/executions/search/cycle/'+ params.zCycleID+'?offset='+ offset + '&projectId='+ params.zProdID+ '&versionId='+params.zVerID;

        //console.log(exPath);

        var token = JwtClient.generateJWT('GET', params.zephyrBaseUrl + exPath, JWT_EXPIRE);

        var zapioptions = {
            url: params.zephyrBaseUrl + exPath,
            method: 'GET',
            headers: {
                'Content-Type': 'text/plain',
                'Authorization': 'JWT '+token,
                'zapiAccessKey': params.accessKey,
                'User-Agent': 'ZAPI',
            }

        }

        var executions = [];
        request(zapioptions, function (error, response, body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                var executions = JSON.parse(body);
                var executionsFilter = executions.searchObjectList;
                callback(null, executionsFilter);
            }
            else{
                console.log('failed to get executions!');
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
                callback(null, body);
            }

        });
        updateRequestCount();
        return deferred.promise;
    }

    function deleteExecutions(executions,callback){

        var deferred = protractor.promise.defer();
        console.log("Delete executions...." );

        var exPath = params.zephyrBaseUrl + '/public/rest/api/1.0/executions/delete';

        //console.log(exPath);

        var token = JwtClient.generateJWT('POST', exPath, JWT_EXPIRE);

        var exbody = {};
        exbody.executions = executions;

        var zapioptions = {
            url:  exPath,
            method: 'POST',
            json: true,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'JWT '+token,
                'zapiAccessKey': params.accessKey,
                'User-Agent': 'ZAPI',
            },
            json: exbody
        }

        request(zapioptions, function (error, response, body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                callback(null, body);
            }
            else{
                console.log('failed to delete executions!');
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
                callback(null, body);
            }

        });
        updateRequestCount();
        return deferred.promise;
    }

    function unExecuteExecutions(executions,callback){
        var deferred = protractor.promise.defer();
        console.log("unExecute executions...." );

        var exPath = params.zephyrBaseUrl + '/public/rest/api/1.0/executions';

        //console.log(exPath);

        var token = JwtClient.generateJWT('POST', exPath, JWT_EXPIRE);

        var exbody = {};
        exbody.executions = executions;
        exbody.status = -1;
        exbody.testStepStatusChangeFlag = true;
        exbody.stepStatus = -1;

        var zapioptions = {
            url:  exPath,
            method: 'POST',
            json: true,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'JWT '+token,
                'zapiAccessKey': params.accessKey,
                'User-Agent': 'ZAPI',
            },
            json: exbody
        }

        request(zapioptions, function (error, response, body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                callback(null, body);
            }
            else{
                console.log('failed to unExecute executions!');
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
                callback(null, body);
            }

        });

        updateRequestCount();
        return deferred.promise;
    }

    function getIssueKeysFromSpecFiles(spec) {
        var deferred = protractor.promise.defer();

        var arrKeys = [];
        var found = false;

        // Filter according to specs
        spec.forEach(function(spec) {
            found = false;
            var data = fs.readFileSync(spec, 'utf8');
            var lines = data.split("\n");
            lines.forEach(function (line) {
                line = line.trim();
                // match line like: "it('PORT-340', function(){", ignore comments line
                // if (line.match(/^\/\//) == null && line.match(/it\(\'/g) != null) {
                if (line.match(/^\/\//) == null && line.match(params.zProdKey) != null) {
                    // Found the line
                    found = true;
                    if(line.match(/xit/) ==  null){
                        var key = line.substring(line.indexOf(params.zProdKey), line.lastIndexOf('\''));
                        if (key.match(/^\w+-\d+$/) == null && key != null) { // match like PORT-340
                            //console.error("Illegal format of issueKey:" + key);
                            key = null;
                        }
                        if (arrKeys.indexOf(key) == -1 && key != null) { // avoid duplicate
                            arrKeys.push(key);
                        }
                    }
                }
            });
            if (!found) {
                console.error('Cannot find issueKey from spec ' + spec);
            }
        });

        params.issues = arrKeys;
        //console.log(params.issues);
        deferred.fulfill(true);
        return deferred.promise;
    }

    //extract execution id from the result and put them together.
    function pushExecution(executions){
        var deferred = protractor.promise.defer();
        var num = 0;
        for(var i in executions){
            exList.push(executions[i]);
            num++;
            if(num == executions.length){
                deferred.fulfill(true);
            }
        }

        return deferred.promise;
    }

    //reverse the execution list
    function reverseExecutions(executions, callback){
        var deferred = protractor.promise.defer();

        var executionList = [];
        var num = 0;
        var j = executions.length;
        for(var i in executions){
            executionList[i] = executions[j-1];
            j = j-1;
            num++;

            if(num == executions.length ){
                deferred.fulfill(true);
                callback(null,executionList);
            }
        }

        return deferred.promise;
    }


    //aggregate all executions getting from getExecutionData calls by batch.
    function aggExecutions(callback){
        var deferred = protractor.promise.defer();
        var pnum = 0; // counts returned promises.
        //var offset = 0;
        var executionsList = [];
        var array = [];
        exList.splice(0,exList.length);

        getExecutionList(function(err,totalcount){
            if(totalcount > 0) {

                var count = Math.ceil(totalcount / 50);

                for (var i = 0; i < count; i++) {
                    array.push(i);
                }

                for (var j in array) {
                    getExecutionData(j*50, function (err, ex){
                        pushExecution(ex).then(function(){
                            pnum++;

                            if(pnum==array.length){
                                executionsList = exList;
                                deferred.fulfill(true);
                                callback(null,executionsList);
                            }
                        });
                    });
                }
            }
            else{
                console.log("No executions to process!");
                deferred.fulfill(true);
                callback(null,executionsList);
            }
        });

        return deferred.promise;
    }

    function getAllExecutions(){
        var deferred = protractor.promise.defer();
        aggExecutions(function(err,ex){
            if(params.cleanAllResults) {
                params.executions.executions = ex;
                deferred.fulfill(true);
            }
            else{
                //Only get the ones need to execute
                    var executions = ex;
                    var executionsFilter = {executions: [], recordsCount: 0};
                    for (var i in executions) {
                        var execution = executions[i];
                        for (var j = 0; j < params.issues.length; j++) {
                            if (params.issues[j] == execution.issueKey) {
                                executionsFilter.executions.push(execution);
                                executionsFilter.recordsCount++;
                            }
                        }
                    }

                if (executionsFilter.executions.length == 0) {
                    // Throw err
                    var err = "The test cases not existed in test cycle: " + params.issues.toString();
                    console.error(err);
                    throw(new Error(err));
                }
                params.executions = executionsFilter;
                deferred.fulfill(true);

            }
        });
        return deferred.promise;
    }


    function callJobprogress(ticket,callback){

        var jobPath = params.zephyrBaseUrl +  '/public/rest/api/1.0/jobprogress/'+ ticket;

        var token = JwtClient.generateJWT('GET', jobPath, JWT_EXPIRE);

        var zapioptions = {
            url: jobPath,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'JWT '+token,
                'zapiAccessKey': params.accessKey,
                'User-Agent': 'ZAPI',
            }

        }


        request(zapioptions, function (error, response, body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                callback(null, body);
            }else{
                console.log('failed to get job grogress status!');
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
                callback(null, body);
            }

        });
        updateRequestCount();
    }

    function removeOldExecutions(){
        var deferred = protractor.promise.defer();
        aggExecutions(function(err,ex){
            var executions = [];
            for(var k in ex){
                executions.push(ex[k].execution.id);
            }
            if(params.cleanAllResults) {
                deleteExecutions(executions, function(err,jobTicket){
                    //callJobprogress(jobTicket,function(err,res){
                    //    var message = [];
                    //    message = JSON.stringify(res);
                    //    if(message.message != null){
                    //        console.log(message);
                    //        console.log('delete executions successfully!');
                    //        deferred.fulfill(true);
                    //    }
                    //})
                    sleep(params.removalDalay);
                    deferred.fulfill(true);
                });
            }
            else{
                // Only clean the executed ones
                var executionsFilter =  [];
                for (var i in ex) {
                    for (var j = 0; j < params.issues.length; j++) {
                        if (params.issues[j] == ex[i].issueKey) {
                            executionsFilter.push(ex[i].execution.id);
                        }
                    }
                }
                if (executionsFilter.length == 0) {
                    var err = "The test cases not existed in test cycle: " + params.issues.toString();
                    console.error(err);
                    deferred.fulfill(true);
                }else{
                    deleteExecutions(executionsFilter, function(err,jobTicket){
                        sleep(params.removalDalay);
                        deferred.fulfill(true);

                    });
                }

            }

        });

        return deferred.promise;
    }

    function cleanUpExecutions(callback){
        var deferred = protractor.promise.defer();
        console.log("Preparing executions...");
        //retrieves all the executions by paginated and aggregated.
        aggExecutions(function(err,ex){
            var executions = [];
            var failedExecutions = [];
            for(var k in ex){
                executions.push(ex[k].execution.id);
                if(ex[k].execution.status.id == 2){
                    failedExecutions.push(ex[k].execution.id);
                }
            }

            if(params.cleanAllResults) {
                // To clean up the attachments of the failed executions.
                if(failedExecutions.length !=0){
                    cleanupExecutionAttachments(failedExecutions).then(function(){
                        deferred.fulfill(true);
                    });
                }

                unExecuteExecutions(executions, function(err,res){
                    sleep(params.unExecutionDelay);
                    callback(err,true);
                    deferred.fulfill(true);
                });
                //reverseExecutions(executions,function(err,exList){
                //    unExecuteExecutions(exList, function(err,res){
                //        sleep(params.unExecutionDelay);
                //        callback(err,true);
                //        deferred.fulfill(true);
                //    });
                //});

            }
            else{
                // Only clean the executed ones
                var executionsFilter =  [];
                var failedExecutionFilter = [];
                for (var i in params.issues) {
                    var found = false;
                    for (var j = 0; j < ex.length; j++) {
                        if (params.issues[i] == ex[j].issueKey) {
                            found = true;
                            executionsFilter.push(ex[j].execution.id);
                        }
                        if(j == ex.length-1 && found == false ){
                            params.issuesToAdd.push(params.issues[i]);
                        }
                    }
                }

                if(executionsFilter.length !=0 ){
                    // To clean up the attachments of the failed executions.
                    for(var q=0; q < failedExecutions.length; q++){
                        for(var p in  executionsFilter){
                            if(failedExecutions[q] == executionsFilter[p]){
                                failedExecutionFilter.push(failedExecutions[q]);
                            }
                        }
                    }

                    if(failedExecutionFilter.length !=0){
                        cleanupExecutionAttachments(failedExecutionFilter).then(function(){
                            deferred.fulfill(true);
                        });
                    }

                    unExecuteExecutions(executionsFilter, function(err,res){
                        sleep(params.unExecutionDelay);
                        callback(err,true);
                        deferred.fulfill(true);
                    });

                    //reverseExecutions(executionsFilter,function(err,exList){
                    //    unExecuteExecutions(exList, function(err,res){
                    //        sleep(params.unExecutionDelay);
                    //        callback(err,true);
                    //        deferred.fulfill(true);
                    //    });
                    //})


                }

                if (params.issuesToAdd.length != 0  ) {
                    var msg = "The test cases not existed in test cycle: " + params.issuesToAdd.toString();
                    console.log(msg);
                    callback(null,false);
                    deferred.fulfill(true);
                }
                else if(executionsFilter.length == 0){
                    params.issuesToAdd = params.issues;
                    var msg = "The test cases not existed in test cycle: " + params.issuesToAdd.toString();
                    console.log(msg);
                    callback(null,false);
                    deferred.fulfill(true);
                }
                else{
                    callback(null,true);
                    deferred.fulfill(true);
                }

            }

        });

        return deferred.promise;
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
                return params.executions.executions[i].execution.id;
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
     * getIssueIdFromExecutionByKey finds the Issue ID that matches the test case key,
     * which is the Jira/Zephyr key.
     *
     * @param executions   	Execution data, return from getExecutionData
     * @param key 			The Jira Key (ex EDGE-3333)
     */

    function getIssueIdFromExecutionByKey(key){
        for (var i in params.executions.executions) {
            if (params.executions.executions[i].issueKey == key) {
                return params.executions.executions[i].execution.issueId;
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

    function pass(key, callback) {
        var deferred = protractor.promise.defer();

        console.log('>>pass execution...'+ key);
        var expath = params.zephyrBaseUrl + '/public/rest/api/1.0/execution/' + getExecutionIdByKey(key);

        // encode
        var token = JwtClient.generateJWT('PUT', expath, JWT_EXPIRE);
        //console.log(expath);
        //console.log('JWT '+token);

        var exbody = {};
        exbody.status={};
        exbody.status.id=1;
        exbody.projectId=params.zProdID;
        exbody.issueId=getIssueIdFromExecutionByKey(key);

        var zapioptions = {
            url:  expath,
            method: 'PUT',
            json: true,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'JWT '+token,
                'zapiAccessKey': params.accessKey,
                'User-Agent': 'ZAPI',
            },
            json: exbody
        }
        var response;
        request(zapioptions, function (err, response, body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                callback(null, body);
            }else{
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
                callback(null, body);
            }

        });
        updateRequestCount();
        return deferred.promise;
    }

    /**
     * fail fails a test case by key
     *
     * @param key 		The Jira Key (ex EDGE-3333)
     * @param comment   The comment to leave on the execution
     * @param callback	The callback function
     *
     */

    function fail(key,comment, callback) {
        var deferred = protractor.promise.defer();
        console.log('>>fail execution..'+key );
        var expath = params.zephyrBaseUrl + '/public/rest/api/1.0/execution/' + getExecutionIdByKey(key);

        // encode
        var token = JwtClient.generateJWT('PUT', expath, JWT_EXPIRE);
        //console.log(expath);
        //console.log('JWT '+token);

        var exbody = {};
        exbody.status={};
        exbody.status.id=2;
        exbody.projectId=params.zProdID;
        exbody.issueId=getIssueIdFromExecutionByKey(key);
        exbody.comment=comment;


        var zapioptions = {
            url:  expath,
            method: 'PUT',
            json: true,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'JWT '+token,
                'zapiAccessKey': params.accessKey,
                'User-Agent': 'ZAPI',
            },
            json: exbody
        }
        var response;
        request(zapioptions, function (err, response, body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                callback(null, body);
            }else{
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
                callback(null, body);
            }
        });
        updateRequestCount();
        return deferred.promise;
    }

    /**
     * wip sets a test case to work in progress by key
     *
     * @param key 		The Jira Key (ex EDGE-3333)
     * @param comment   The comment to leave on the execution
     * @param callback	The callback function
     *
     */

    function wip(key, callback) {
        var deferred = protractor.promise.defer();
        var expath = params.zephyrBaseUrl + '/public/rest/api/1.0/execution/' + getExecutionIdByKey(key);

        // encode
        var token = JwtClient.generateJWT('PUT', expath, JWT_EXPIRE);
        //console.log(expath);
        //console.log('JWT '+token);

        var exbody = {};
        exbody.status={};
        exbody.status.id=3;
        exbody.projectId=params.zProdID;
        exbody.issueId=getIssueIdFromExecutionByKey(key);

        var zapioptions = {
            url:  expath,
            method: 'PUT',
            json: true,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'JWT '+token,
                'zapiAccessKey': params.accessKey,
                'User-Agent': 'ZAPI',
            },
            json: exbody
        }
        var response;
        request(zapioptions, function (err, response, body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                callback(null, body);
            }else{
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
                callback(null, body);
            }
        });
        updateRequestCount();
        return deferred.promise;
    }

    /**
     * unExecute sets a test case to unexecuted by key
     *
     * @param key 		The Jira Key (ex EDGE-3333)
     * @param comment   The comment to leave on the execution
     * @param callback	The callback function
     *
     */

    function unExecute(key, callback) {
        var deferred = protractor.promise.defer();
        console.log(">>unExecute " + key);

        var expath = params.zephyrBaseUrl + '/public/rest/api/1.0/execution/' + getExecutionIdByKey(key);

        // encode
        var token = JwtClient.generateJWT('PUT', expath, JWT_EXPIRE);
        //console.log(expath);
        //console.log('JWT '+token);

        var exbody = {};
        exbody.status={};
        exbody.status.id=-1;
        exbody.projectId=params.zProdID;
        exbody.issueId=getIssueIdFromExecutionByKey(key);

        var zapioptions = {
            url:  expath,
            method: 'PUT',
            json: true,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'JWT '+token,
                'zapiAccessKey': params.accessKey,
                'User-Agent': 'ZAPI',
            },
            json: exbody
        }
        var response;
        request(zapioptions, function (err, response, body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                callback(null, body);
            }else{
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
                callback(null, body);
            }
        });
        updateRequestCount();
        return deferred.promise;
    }

    /**
     * Blocked sets a test case to unexecuted by key
     *
     * @param key 		The Jira Key (ex EDGE-3333)
     * @param comment   The comment to leave on the execution
     * @param callback	The callback function
     *
     */

    function blocked(key, callback) {
        var deferred = protractor.promise.defer();
        var expath = params.zephyrBaseUrl + '/public/rest/api/1.0/execution/' + getExecutionIdByKey(key);

        // encode
        var token = JwtClient.generateJWT('PUT', expath, JWT_EXPIRE);
        console.log(expath);
        console.log('JWT '+token);

        var exbody = {};
        exbody.status={};
        exbody.status.id=4;
        exbody.projectId=params.zProdID;
        exbody.issueId=getIssueIdFromExecutionByKey(key);

        var zapioptions = {
            url:  expath,
            method: 'PUT',
            json: true,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'JWT '+token,
                'zapiAccessKey': params.accessKey,
                'User-Agent': 'ZAPI',
            },
            json: exbody
        }
        var response;
        request(zapioptions, function (err, response, body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                callback(null, body);
            }else{
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
                callback(null, body);
            }
        });
        updateRequestCount();
        return deferred.promise;
    }

    function cleanupExecutionAttachments(executions){

        var deferred = protractor.promise.defer();

        console.log("Clean up attachments of failed executions...");

        for(var i=0; i < executions.length; i++){
            getExecutionAttachmentIds(executions[i], function (err, attachmentIds) {
                deleteAllExecutionAttachments(attachmentIds).then(function(){
                    if(i == executions.length-1 ){
                        deferred.fulfill(true);
                    }
                })
            });
        }
        return deferred.promise;

    }

    /**
     * getExecutionAttachmentIds gets the attachments associated with a test execution
     *
     * @param key 		The Jira Key (ex EDGE-3333)
     * @param callback	The callback function
     *
     */

    function getExecutionAttachmentIds(executionId, callback) {

        var deferred = protractor.promise.defer();

       // console.log('>>getExecutionAttachmentIds ...');

       //var executionId = getExecutionIdByKey(key);

        var expath = '/public/rest/api/1.0/attachment/search/execution?entityId=' + executionId;

        CANONICAL_PATH = 'GET&' + '/public/rest/api/1.0/attachment/search/execution&entityId=' + executionId;

        jwt_payload = {
            'sub': params.userName,
            'qsh': hashlib.hex(CANONICAL_PATH),
            'iss': params.accessKey,
            'exp': new Date().getTime()+JWT_EXPIRE,
            'iat': new Date().getTime()
        }

        // encode
        var token = jwt.encode(jwt_payload, params.secretKey);
        //console.log(token);

        var zapioptions = {
            url: params.zephyrBaseUrl + expath,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'JWT '+token,
                'zapiAccessKey': params.accessKey,
                'User-Agent': 'ZAPI',
            },
        }

        var response;
        request(zapioptions, function (err, response, body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                var attachments = []
                var attachmentJSON = JSON.parse(body);
                //for(var key in attachmentJSON){
                //    var value = attachmentJSON[key];
                //    console.log('the key is '+ value);
                //}
                //console.log('length: '+ attachmentJSON[executionId].length );
                for (var i = 0; i < attachmentJSON[executionId].length; i++) {
                    attachments[i] = attachmentJSON[executionId][i].id;
                }
                //console.log('attachmentIds: '+ attachments);
                callback(null, attachments);
            }else{
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
                callback(null, body);
            }

        });
        updateRequestCount();
        return deferred.promise;
    }


    /**
     * deleteExecutionAttachment deletes all attachments that belong to a test execution
     *
     * @param fileId 	The IDs for all attachments, returned by getAttachmentIds
     * @param callback			The callback function
     *
     */

    function deleteExecutionAttachment(attachmentId) {
        var deferred = protractor.promise.defer();

        var zurl =  params.zephyrBaseUrl + '/public/rest/api/1.0/attachment/' + attachmentId;

        // encode
        var token = JwtClient.generateJWT('DELETE', zurl, JWT_EXPIRE);
        //console.log(token);

        var request = require("request");
        request({
            url: zurl,
            method: "DELETE",
            headers: {
                //'Content-Type': 'application/json',
                'Authorization': 'JWT '+token,
                'zapiAccessKey': params.accessKey,
                'User-Agent': 'ZAPI',
            },
        }, function (error, response, body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                deferred.fulfill(true);
            }else{
                console.log("Delete attachment failed!");
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
                deferred.fulfill(false);
            }

        });

        updateRequestCount();
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

        if (attachments.length == 0) {
            deferred.fulfill(true);
        }

        var num = 0;

        for (var i in attachments) {
            deleteExecutionAttachment(attachments[i]).then(function () {
                num++;
                if (num == attachments.length) {
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


        var zurl =  params.zephyrBaseUrl + '/public/rest/api/1.0/attachment/' + attachmentId;

        // encode
        var token = JwtClient.generateJWT('DELETE', zurl, JWT_EXPIRE);
        //console.log(token);

        var request = require("request");
        request({
            url: zurl,
            method: "DELETE",
            headers: {
                //'Content-Type': 'application/json',
                'Authorization': 'JWT '+token,
                'zapiAccessKey': params.accessKey,
                'User-Agent': 'ZAPI',
            },
        }, function (error, response, body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                callback(null, body);
            }else{
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
                callback(null, body);
            }
        });
        updateRequestCount();
    }

    /*
     * getIssueId by issueKey
     * @param issueKey
     * @param callback
     *
     * */

    function getIssueIdByKey(issueKey,callback){
        var zurl =  '/rest/api/2/issue/' + issueKey;

        request({
            method: 'GET',
            url:  params.jiraBaseUrl + zurl,
            auth: {
                user:params.userName,
                pass:params.passwd,
                sendImmediately:true
            },
        }, function (error, response, body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                var issueJSON = JSON.parse(body);
                console.log('issueId: '+ issueJSON.id);
                callback(null, issueJSON.id);
            }else{
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
                callback(null, body);
            }

        })
        updateRequestCount();
    }

    /**
     * attachScreenshotToExecution attaches a screenshot to a test execution.
     *
     * @param key 				The Jira Key (ex EDGE-3333)
     * @param stream 			The screenshot buffer or readstream
     * @param screenShotName	The filename
     *
     */

    function attachScreenshotToExecution(key, stream, screenShotName, comment,callback) {
        //console.log(">>attachScreenshotToExecution..."+ screenShotName);
        //var deferred = protractor.promise.defer();

        var zurl = params.zephyrBaseUrl + '/public/rest/api/1.0/attachment?comment='+comment+'&cycleId='+params.zCycleID+ '&entityId='+getExecutionIdByKey(key)+'&entityName=execution'+'&issueId='+ getIssueIdFromExecutionByKey(key) +'&projectId=' + params.zProdID+'&versionId='+ params.zVerID;

        //console.log(zurl);
        // encode
        var token = JwtClient.generateJWT('POST', zurl, JWT_EXPIRE);
        //console.log(token);


        var request = require('request');
        var FormData = require('form-data');

        var form = new FormData();

        var form = {
            file: {
                value:  stream,
                options: {
                    filename: screenShotName,
                    contentType: 'image/png'
                }
            }
        };

        request({
            method: 'POST',
            url: zurl,
            headers: {
                'Content-Type': 'multipart/form-data',
                'Authorization': 'JWT '+token,
                'zapiAccessKey': params.accessKey,
                'User-Agent': 'ZAPI',
            },
            formData: form
        }, function (error, response, body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                callback(null, body);
            }else{
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
                callback(null, body);
            }
        });

        updateRequestCount();
        //var r = request.post({url:zurl, formData: form}, requestCallback);
        ////r.setHeader("X-Atlassian-Token", "nocheck");
        //r.setHeader('Content-Type', 'multipart/form-data');
        //r.setHeader('Authorization', 'JWT '+token);
        //r.setHeader('zapiAccessKey', params.accessKey);
        //r.setHeader('User-Agent', 'ZAPI');
        ////r.setHeader('Accept', 'application/json');


        //form.append('file', stream, {contentType: 'image/png'});

        //form.getLength(function (err, length) {
        //    if (err) {
        //        //console.log("ERROR");
        //        deferred.fulfill(false);
        //        return requestCallback(err);
        //    }


    }

    /**
     * attachLogToExecution attaches a txt file to a test execution.
     *
     * @param key 				The Jira Key (ex EDGE-3333)
     * @param stream 			A read file stream.
     * @param callback			The callback function
     *
     */

    function attachLogToExecution(key, stream, filename,comment, callback) {
        //console.log(">>attachLogToExecution." + filename);

        var zurl = params.zephyrBaseUrl + '/public/rest/api/1.0/attachment?comment='+comment+'&cycleId='+params.zCycleID+ '&entityId='+getExecutionIdByKey(key)+'&entityName=execution'+'&issueId='+ getIssueIdFromExecutionByKey(key) +'&projectId=' + params.zProdID+'&versionId='+ params.zVerID;

        //console.log(zurl);
        // encode
        var token = JwtClient.generateJWT('POST', zurl, JWT_EXPIRE);
        //console.log(token);


        var request = require('request');
        var FormData = require('form-data');

        var form = new FormData();

        var form = {
            file: {
                value:  stream,
                options: {
                    filename: filename,
                    contentType: 'text/plain'
                }
            }
        };

        request({
            method: 'POST',
            url: zurl,
            headers: {
                'Content-Type': 'multipart/form-data',
                'Authorization': 'JWT '+token,
                'zapiAccessKey': params.accessKey,
                'User-Agent': 'ZAPI',
            },
            formData: form
        }, function (error, response, body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                callback(null, body);
            }else{
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
                callback(null, body);
            }
        });

        updateRequestCount();

        //form.append('file', stream, {
        //    contentType: 'text/plain',
        //    filename: filename
        //});

        //form.getLength(function (err, length) {
        //    if (err) {
        //        //console.log("ERROR");
        //        return requestCallback(err);
        //    }

        //var zheaders = {
        //    //"Accept": "application/json",
        //    "Content-Type": "multipart/form-data",
        //    'Authorization': 'JWT '+token,
        //    'zapiAccessKey': params.accessKey,
        //    'User-Agent': 'ZAPI',
        //}

        //    var r = request.post({
        //        url: zurl,
        //        headers: zheaders
        //    }, requestCallback);
        //    r._form = form;
        //    r.setHeader('content-length', length);
        //});

        //var r = request.post({url:zurl, headers: zheaders, formData: formData}, requestCallback);
        //r.setHeader("X-Atlassian-Token", "nocheck");
        //r.setHeader('Accept-Encoding', 'gzip,deflate');
        //
        //function requestCallback(err, res, body) {
        //    console.log("Status", res.statusCode);
        //    console.log("Headers", JSON.stringify(res.headers));
        //    console.log(body);
        //}
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

    function onPrepare(specs) {


        console.log(">> onPrepare specs=" + specs);

        var deferred = protractor.promise.defer();
        var time = new Date().getTime();;

        console.log("Retrieving ZAPI IDs...");
        //getZapiIDs(function (err, callback) {
        getProductIDByName(function (err, ProdID) {
            params.zProdID = ProdID;
            getVersionIDByName(ProdID, function (err, VerID) {
                params.zVerID = VerID;
                prepareTestCycle(ProdID,VerID).then(function() {
                    getIssueKeysFromSpecFiles(specs).then(function () {
                        prepareExecutions().then(function(){
                            console.log("Getting execution data...");
                            getAllExecutions().then(function () {
                                console.log("Getting test steps...");
                                getAllTestSteps().then(function () {
                                    var finished = new Date().getTime() - time;
                                    console.log(browser.browserName + ': OnPrepare took ' + finished + 'ms');
                                    console.log("ZAPI calls after OnPrepare: " + params.zapiRequestCount);
                                    deferred.fulfill(true);
                                });

                            });
                        });
                    });

                    //removeOldExecutions().then(function(){
                    //    addTestCasesToCycle(params.issues,ProdID,VerID,params.zCycleID,function(err,body){
                    //        // Then get the executions for the cycle
                    //        sleep(params.additionDelay);
                    //        console.log("Getting execution data...");
                    //        getAllExecutions().then(function() {
                    //            // Get all the test step data, save it to the execution data.
                    //            //console.log("Preparing test executions...");
                    //            //prepareExecutions().then(function (p) {
                    //            console.log("Getting test steps...");
                    //            getAllTestSteps().then(function () {
                    //                //prepareTestSteps().then(function (p) {
                    //                var finished = new Date().getTime() - time;
                    //                console.log(browser.browserName + ': OnPrepare took ' + finished + 'ms');
                    //                deferred.fulfill(true);
                    //            });
                    //        });
                    //    });
                    //});
                });
            });
        });

        return deferred.promise;
    }

    /**
     *  Wraps onPrepare to put it into the controlFlow queue.
     *
     */

    this.onPrepare = function (specs) {
        var deferred = protractor.promise.defer();

        //var spec = jasmine.getEnv().currentSpec;

        browser.controlFlow().execute(function () {
            if (params.logToZ) {
                return onPrepare(specs);
            } else {
                return true;
            }
        }).then(function (res) {
            deferred.fulfill(res);
        });

        return deferred.promise;
    }


    function prepareTestCycle(ProdID,VerID){
        var deferred = protractor.promise.defer();

        getCycleID(ProdID,VerID,function(err, CycleID){
            if(CycleID == null){
                createTestCycle(ProdID,VerID,params.zCycleName,function(err,cycleid){
                    params.zCycleID = cycleid;
                    deferred.fulfill(true);
                });
            }
            else{
                params.zCycleID = CycleID;
                deferred.fulfill(true);
            }
        });

        return deferred.promise;
    }


    /**
     * prepareExecutions() does the following:
     * Sets all executions in the cycle to work in progress, and removes old attachments from executions.
     *
     */

    //function prepareExecutions() {
    //    var deferred = protractor.promise.defer();
    //
    //    var pnum = 0; // counts returned promises.
    //    var atnum = 0; // counts returned promises
    //    var expected = params.executions.executions.length;
    //
    //    // Set all executions to unExecuted, and delete attachments.
    //    for (var i in params.executions.executions) {
    //
    //        unExecute(params.executions.executions[i].issueKey, function (err, callback) {
    //            pnum++;
    //
    //            if (pnum == expected) {
    //                deferred.fulfill(true);
    //            }
    //        });
    //
    //        getExecutionAttachmentIds(params.executions.executions[i].issueKey, function (err, attachmentIds) {
    //            deleteAllExecutionAttachments(attachmentIds).then(function () {
    //                atnum++;
    //
    //                if (atnum == expected) {
    //                    deferred.fulfill(true);
    //                }
    //
    //            });
    //        });
    //
    //
    //    }
    //
    //    return deferred.promise;
    //}

    function prepareExecutions() {
        var deferred = protractor.promise.defer();

        cleanUpExecutions(function (err, res){
            if (!res) {
                addTestCasesToCycle(params.issuesToAdd,params.zProdID, params.zVerID, params.zCycleID, function (err, body) {
                    sleep(params.additionDelay);
                    deferred.fulfill(true);
                });
            }
            else{
                deferred.fulfill(true);
            }
        });

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
        console.log('>>prepareTestStepAttachments....');
        var deferred = protractor.promise.defer();
        var num = 0;
        var testSteps = testExecution.testSteps;
        var expected = testSteps.length;

        if (expected == 0) {
            deferred.reject("ZAPI.JS ERROR: No Test Steps for "+JSON.stringify(testExecution.issueKey)+".  Verify in JIRA and try again.");
        } else {
            for (var i in testSteps) {
                //console.log("prepareTestStepAttachments i=" + i + " testSteps[i].id= " + testSteps[i].id);
                unExecuteStepByStepResultID(testSteps[i].id,testExecution.execution.issueId,testExecution.execution.id, function (err, res) {
                    num++;
                    //console.log("success? " + response);
                    if (num == expected) {
                        deferred.fulfill(true);
                        callback(null, true);
                    }
                });

                //.then(function (err) {
                //deleteTestStepAttachments(testSteps[i], function (err, attachments) {
                //    num++;
                //    //console.log("callback from deleteTestStepAttachments num= " + num);
                //    if (expected == num) {
                //        //console.log("callback from deleteTestStepAttachments  testSteps= " + JSON.stringify(testSteps));
                //        callback(null, attachments);
                //       deferred.fulfill(true);
                //    }
                //})
                // });
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

        var expath = params.zephyrBaseUrl + '/public/rest/api/1.0/attachment/search/stepresult';
        //console.log(expath);

        // encode
        var token = JwtClient.generateJWT('POST', expath, JWT_EXPIRE);
        //console.log(token);

        var exbody = {};
        exbody.stepResultId =  testSteps ;

        var zapioptions = {
            url:  expath,
            method: 'POST',
            json: true,
            headers: {
                // 'Content-Type': 'application/json',
                'Authorization': 'JWT '+token,
                'zapiAccessKey': params.accessKey,
                'User-Agent': 'ZAPI',
            },
            json: exbody
        }


        var response;
        request(zapioptions, function (err, response,body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
            }else{
                console.log('Faile to get the attachments of teststep!');
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
            }
            deferred.fulfill(true);
            callback(null, JSON.parse(body));
        });
        updateRequestCount();
        return deferred.promise;
    }

    /*
    To get browserstack session log and attach to the test cases.
     */

    function getBrowserUrl(callback) {
        var deferred = protractor.promise.defer();

        browser.getProcessedConfig().then(function (config){
            getBrowserstackBuildId(function(err, buildId){
                getBrowserstackSessionUrl(buildId,config.capabilities.name,function(error, sessionUrl){
                    //var browserUrl = "curl -u \"" + params.browserstackUser + ":" + params.browserstackKey + "\" " + sessionUrl;
                    //console.log(browserUrl);
                    deferred.fulfill(true);
                    callback(sessionUrl);

                })
            })
        })


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
                            if(params.uploadAttachment){
                                attachLogToExecution(spec.description, logBuffer, consoleLogName,"comment", function (err, callback) {});
                            }

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
            pass(spec.description, function (err, callback) {
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
            if(params.uploadAttachment){
                fs.writeFile(params.logDir + attachmentName, failLog, function (err) {
                    var failBuffer = new Buffer(failLog, 'utf8');
                    attachLogToExecution(spec.description, failBuffer, attachmentName,"comment", function (err, callback) {});

                });
            }

            //Get browserstack link and show in comment if fail.
            getBrowserUrl(function(browserUrl){
                fail(spec.description,browserUrl, function (err, callback) {
                    deferred.fulfill(true);
                });
            })

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
        // console.log('taking screenshot of step: '+ stepName );
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
                    //attachScreenshotToExecution(jasmine.getEnv().currentSpec.description, screenShot, screenShotName,"comment", function (response) {
                    //   deferred.fulfill(response);
                    //});
                    deferred.fulfill(true);
                } else {
                    deferred.fulfill(true);
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


    function takeScreenshotforfailedStep(stepName) {
        //console.log('taking screenshot of step: '+ stepName );
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
                if (params.logToZ && params.uploadAttachment) {
                    attachScreenshotToExecution(jasmine.getEnv().currentSpec.description, screenShot, screenShotName,"comment", function (response) {
                        deferred.fulfill(response);
                    });
                    //deferred.fulfill(true);
                } else {
                    deferred.fulfill(true);
                }
                return deferred.promise;
            })
        });

        return deferred.promise;
    }

    this.takeScreenshotforfailedStep = function (stepName) {
        var deferred = protractor.promise.defer();

        browser.controlFlow().execute(function () {
            if (params.logToZ) {
                return takeScreenshotforfailedStep(stepName);
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


        getStepsOfExecution(params.executions.executions[index].issueKey,params.executions.executions[index].execution.issueId,params.executions.executions[index].execution.id, function (err, orderedTestSteps) {
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
        //console.log(">> beforeEach");

        var deferred = protractor.promise.defer();

        spec = jasmine.getEnv().currentSpec;
        spec.startTime = new Date().getTime();
        spec.failures = 0;
        //console.log('Current spec is: '+ spec.description);
        browser.controlFlow().execute(function() {
            //deferred.fulfill(takeScreenshot('beforeEach'));
            deferred.fulfill(true);
        });

        return deferred.promise;
    }

    this.beforeEach = function(){
        var deferred = protractor.promise.defer();

        browser.controlFlow().execute(function() {
            if(params.logToZ){
                return beforeEach();
            }
            else{
                return true;
            }

        }).then(function(res) {
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
        //console.log(">> completeTestStep stepNumber=" + stepNumber);

        var deferred = protractor.promise.defer();

        browser.controlFlow().execute(function () {
            var description = jasmine.getEnv().currentSpec.description;

            var index = getExecutionIndexByKey(jasmine.getEnv().currentSpec.description);

            spec = jasmine.getEnv().currentSpec;

            if (stepNumber == 'last') {
                stepNumber = params.executions.executions[index].testSteps.length;
            }

            if(spec.failedExpectations.length <= spec.failures){
                if(params.updateStepResultsOpt == stepResultsOpt.updateAll.id){
                    passStep(stepNumber);
                }
                deferred.fulfill(true);
            }else{
                takeScreenshotforfailedStep(stepNumber);
                if(params.updateStepResultsOpt != stepResultsOpt.ignoreResults.id) {
                    failStep(stepNumber);
                }
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


    function getStepsOfExecution(issueKey,issueID,executionId, callback) {
        var deferred = protractor.promise.defer();

        getTestStepsFromIssue(issueID, function (err, testSteps) {
            if(params.updateStepResultsOpt != stepResultsOpt.ignoreResults.id){
                getStepResultsByExecutionId(executionId,issueID, function (err, stepResults) {
                    mergeStepsAndResults(stepResults, testSteps, function (err, orderedTestSteps) {
                        callback(err, orderedTestSteps);
                    });
                });
            }else{
                callback(err,testSteps);
            }

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
        request(zapioptions, function (err, response) {
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
        // console.log(">>getTestStepsFromIssue..." +issueID);
        var zurl = '/public/rest/api/1.0/teststep/' + issueID + '?projectId='+params.zProdID;
        var c_path = 'GET&'+ zurl;
        CANONICAL_PATH = c_path.replace('?','&');

        jwt_payload = {
            'sub': params.userName,
            'qsh': hashlib.hex(CANONICAL_PATH),
            'iss': params.accessKey,
            'exp': new Date().getTime()+JWT_EXPIRE,
            'iat': new Date().getTime()
        }

        // encode
        var token = jwt.encode(jwt_payload, params.secretKey);
        //console.log(token);

        var zapioptions = {
            url: params.zephyrBaseUrl + zurl,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'JWT '+token,
                'zapiAccessKey': params.accessKey,
                'User-Agent': 'ZAPI',
            }

        }

        request(zapioptions, function (err, response, body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                callback(null, JSON.parse(body));
            }else{
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
                callback(null, JSON.parse(body));
            }
        });
        updateRequestCount();
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

    function getStepResultsByExecutionId(executionId,issueId, callback) {
        //console.log(">>getStepResultsByExecutionId...");
        var expath = '/public/rest/api/1.0/stepresult/search?executionId=' + executionId  + '&issueId=' + issueId ;

        var c_path = 'GET&'+ expath;
        CANONICAL_PATH = c_path.replace('?','&');

        jwt_payload = {
            'sub': params.userName,
            'qsh': hashlib.hex(CANONICAL_PATH),
            'iss': params.accessKey,
            'exp': new Date().getTime()+JWT_EXPIRE,
            'iat': new Date().getTime()
        }

        // encode
        var token = jwt.encode(jwt_payload, params.secretKey);
        //console.log(token);

        var zapioptions = {
            url: params.zephyrBaseUrl + expath,
            method: 'GET',
            headers: {
                'Content-Type': 'text/plain',
                'Authorization': 'JWT '+token,
                'zapiAccessKey': params.accessKey,
                'User-Agent': 'ZAPI',
            }

        }
        request(zapioptions, function (err, response, body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                callback(null, JSON.parse(body));
            }else{
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
                callback(null, body);
            }
        });
        updateRequestCount();
    }


    /**
     * mergeStepsAndResults Creates a new array that has the test step IDs and order so we can
     * have useful data
     *
     * @param stepResutls		step result data, has the test step order.
     * @param testSteps			test steps
     *
     */

    function mergeStepsAndResults(stepRes, testSteps, callback) {
        //console.log(">>mergeStepsAndResults...");
        var steps = [];

        for (var i in stepRes.stepResults) {
            for (var j in testSteps) {
                if (stepRes.stepResults[i].stepId == testSteps[j].id) {

                    var step = {
                        id: stepRes.stepResults[i].id,
                        stepId: stepRes.stepResults[i].stepId,
                        orderId: testSteps[j].orderId,
                    };
                    steps.push(step);
                }
            }
        }
        var e = null;
        if (stepRes.stepResults.length != testSteps.length) {
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
                passStepByStepResultID(testSteps[i].id, params.executions.executions[index].execution.issueId, params.executions.executions[index].execution.id, function (err, response) {
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
                failStepByStepResultID(testSteps[i].id, params.executions.executions[index].execution.issueId, params.executions.executions[index].execution.id, function (err, response) {
                    deferred.fulfill(response);
                });
            }
        }
        return deferred.promise;
    }

    /**
     * blockStep finds the step result ID for the test by its stepnum,
     * calls failStepByStepResultID to do the failing.
     *
     * @param stepNum 		The order of the test step.
     */
    function blockStep(stepNum) {
        var index = getExecutionIndexByKey(jasmine.getEnv().currentSpec.description);
        if(index == -1) {
            return;
        }

        var deferred = protractor.promise.defer();

        var testSteps = params.executions.executions[index].testSteps;

        for(var i in testSteps){
            if(testSteps[i].orderId == stepNum){
                blockStepByStepResultID(testSteps[i].id, function(err, response){
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


    function passStepByStepResultID(stepResultId,issueId,executionId, callback) {
        //console.log(">>passStepByStepResultID..."+stepResultId);
        var deferred = protractor.promise.defer();

        var expath = params.zephyrBaseUrl + '/public/rest/api/1.0/stepresult/' + stepResultId ;


        // encode
        var token = JwtClient.generateJWT('PUT', expath, JWT_EXPIRE);
        //console.log(token);

        var exbody = {};
        exbody.status={};
        exbody.status.id=1;
        exbody.issueId=issueId;
        exbody.executionId = executionId;

        var zapioptions = {
            url:  expath,
            method: 'PUT',
            json: true,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'JWT '+token,
                'zapiAccessKey': params.accessKey,
                'User-Agent': 'ZAPI',
            },
            json: exbody
        }

        var response;
        request(zapioptions, function (err, response, body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                deferred.fulfill(true);
            }else{
                console.log('failed to update status of test step! ');
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);

            }
            callback(null, body);
        });

        updateRequestCount();
        return deferred.promise;


    }

    /** failStepByStepResultID sends the http request to fail a test step
     *
     * @params 	stepResultId	The ID that identifies the step to pass.
     *
     */

    function failStepByStepResultID(stepResultId,issueId,executionId, callback) {
        //console.log(">>failStepByStepResultID..."+stepResultId);
        var deferred = protractor.promise.defer();

        var expath = params.zephyrBaseUrl + '/public/rest/api/1.0/stepresult/' + stepResultId ;


        // encode
        var token = JwtClient.generateJWT('PUT', expath, JWT_EXPIRE);
        //console.log(token);

        var exbody = {};
        exbody.status={};
        exbody.status.id=2;
        exbody.issueId=issueId;
        exbody.executionId = executionId;

        var zapioptions = {
            url:  expath,
            method: 'PUT',
            json: true,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'JWT '+token,
                'zapiAccessKey': params.accessKey,
                'User-Agent': 'ZAPI',
            },
            json: exbody
        }

        var response;
        request(zapioptions, function (err, response,body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                deferred.fulfill(true);
            }else{
                console.log('failed to update status of test step! ');
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);

            }
            callback(null, body);
        });
        updateRequestCount();
        return deferred.promise;

    }

    /** wipStepByStepResultID sends the http request to wip a test step
     *
     * @params 	stepResultId	The ID that identifies the step to pass.
     *
     */

    function wipStepByStepResultID(stepResultId,issueId,executionId, callback) {
        console.log(">>wipStepByStepResultID...");
        var deferred = protractor.promise.defer();

        var expath = params.zephyrBaseUrl + '/public/rest/api/1.0/stepresult/' + stepResultId ;


        // encode
        var token = JwtClient.generateJWT('PUT', expath, JWT_EXPIRE);
        //console.log(token);

        var exbody = {};
        exbody.status={};
        exbody.status.id=3;
        exbody.issueId=issueId;
        exbody.executionId = executionId;

        var zapioptions = {
            url:  expath,
            method: 'PUT',
            json: true,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'JWT '+token,
                'zapiAccessKey': params.accessKey,
                'User-Agent': 'ZAPI',
            },
            json: exbody
        }

        var response;
        request(zapioptions, function (err, response,body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                deferred.fulfill(true);
            }else{
                console.log('failed to update status of test step! ');
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);

            }
            callback(null, body);
        });
        updateRequestCount();
        return deferred.promise;

    }

    /** unExecuteStepByStepResultID sends the http request to unexecute a test step
     *
     * @params 	stepResultId	The ID that identifies the step to pass.
     *
     */

    function unExecuteStepByStepResultID(stepResultId,issueId,executionId, callback) {
        console.log(">>unExecuteStepByStepResultID..." + stepResultId);
        var deferred = protractor.promise.defer();

        var expath = params.zephyrBaseUrl + '/public/rest/api/1.0/stepresult/' + stepResultId;


        // encode
        var token = JwtClient.generateJWT('PUT', expath, JWT_EXPIRE);
        //console.log(token);

        var exbody = {};
        exbody.status = {};
        exbody.status.id = -1;
        exbody.issueId = issueId;
        exbody.executionId = executionId;

        var zapioptions = {
            url: expath,
            method: 'PUT',
            json: true,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'JWT ' + token,
                'zapiAccessKey': params.accessKey,
                'User-Agent': 'ZAPI',
            },
            json: exbody
        }

        var response;
        request(zapioptions, function (err, response, body) {
            if (response.statusCode >= 200 && response.statusCode < 300) {
                deferred.fulfill(true);
            } else {
                console.log('failed to update status of test step! ');
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);

            }
            callback(null, body);
        });
        updateRequestCount();
        return deferred.promise;

    }

    /*
     getBrowserstackBuildId gets build id from browserstack.

    */

    function getBrowserstackBuildId(callback){
        var url =  '/builds.json'
        request({
            method: 'GET',
            url:  params.broswerstackHost + url,
            auth: {
                user:params.browserstackUser,
                pass:params.browserstackKey,
                sendImmediately:true
            },
        }, function (error, response, body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                var builds = []
                var buildJSON = JSON.parse(body);
                var buildID;
                for (var i = 0; i < buildJSON.length; i++) {
                    builds[i] = buildJSON[i];
                    if (builds[i].automation_build.name == params.zVer) {
                        buildID = builds[i].automation_build.hashed_id;
                    }
                }
                //console.log('buildID: '+ buildID);
                callback(null, buildID);
            }else{
                console.log('failed to get build id');
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
                callback(null, body);
            }

        })
    }

    /*
     getBrowserstackSessionId gets session id from browserstack.

     */

    function getBrowserstackSessionId(buildId,sessionName,callback){
        var url =  '/builds/'+ buildId + '/session.json?status=running'
        request({
            method: 'GET',
            url:  params.broswerstackHost + url,
            auth: {
                user:params.browserstackUser,
                pass:params.browserstackKey,
                sendImmediately:true
            },
        }, function (error, response, body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                var sessions = []
                var sessionJSON = JSON.parse(body);
                var sessionID;
                for (var i = 0; i < sessionJSON.length; i++) {
                    sessions[i] = sessionJSON[i];
                    if (sessions[i].automation_session.name == sessionName ) {
                        sessionID = sessions[i].automation_session.hashed_id;
                    }
                }
                console.log('sessionID: '+ sessionID);
                callback(null, sessionID);
            }else{
                console.log('failed to get session id');
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
                callback(null, body);
            }

        })
    }

    function getBrowserstackSessionUrl(buildId,sessionName,callback){
        var url =  '/builds/'+ buildId + '/sessions.json?status=running'

        request({
            method: 'GET',
            url:  params.broswerstackHost + url,
            auth: {
                user:params.browserstackUser,
                pass:params.browserstackKey,
                sendImmediately:true
            },
        }, function (error, response, body) {
            if(response.statusCode>= 200 && response.statusCode < 300){
                var sessions = []
                var sessionJSON = JSON.parse(body);
                var sessionUrl;
                for (var i = 0; i < sessionJSON.length; i++) {
                    sessions[i] = sessionJSON[i];
                    if (sessions[i].automation_session.name == sessionName ) {
                        sessionUrl = sessions[i].automation_session.public_url;
                    }
                }
                //console.log('session url: '+ sessionUrl);
                callback(null,sessionUrl);
            }else{
                console.log('failed to get session url');
                console.log('Status:', response.statusCode);
                console.log('Headers:', JSON.stringify(response.headers));
                console.log('Response:', body);
                callback(null, body);
            }

        })
    }

};

module.exports = Zapi;

