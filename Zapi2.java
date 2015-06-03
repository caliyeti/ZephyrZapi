package com.caliyeti.util;

import org.apache.commons.codec.binary.Base64;
import org.apache.http.HttpEntity;
import org.apache.http.HttpHost;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.ContentType;
import org.apache.http.entity.mime.MultipartEntityBuilder;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.util.EntityUtils;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import javax.net.ssl.HttpsURLConnection;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.Proxy;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

//import Zapi.Status;

/**
 * Helper class for calling Zapi
 */
public class Zapi2 {
    static AqatProperty jira = new AqatProperty("src/test/resources/jira.properties");
    /**
     * Status IDs enum
     */
    /**
     * @param statusInput Status as e.g. pass, fail, passes, passed
     * @return scenarioStatus
     * eg 1,2,3,4,-1
     */
    public static String getScenarioStatus(String statusInput) {
        String outputStaus;
        if (statusInput.toLowerCase().contains("PASS".toLowerCase())) {
            outputStaus = "1";
        } else if (statusInput.toLowerCase().contains("FAIL".toLowerCase())) {
            outputStaus = "2";
        } else if (statusInput.toLowerCase().contains("WIP".toLowerCase())) {
            outputStaus = "3";
        } else if (statusInput.toLowerCase().contains("BLOCKED".toLowerCase())) {
            outputStaus = "4";
        } else if (statusInput.toLowerCase().contains("SKIP".toLowerCase()) || statusInput.toLowerCase().contains("UNEXECUTED".toLowerCase())) {
            outputStaus = "-1";
        } else {
            throw new IllegalArgumentException("Invalid Scenario of execution: " + statusInput);
        }
        return outputStaus;

    }

    /**
     * URLS
     */
    private static final String BASE_URL = jira.getProperty("BASE_URL");
    private static final String ZAPI_URL = jira.getProperty("ZAPI_URL");

    /**
     * HTTP Proxy details
     */
    private static final boolean USE_PROXY = Boolean.parseBoolean(jira.getProperty("USE_PROXY"));
    private static final String PROXY_IP = jira.getProperty("PROXY_IP");
    private static final int PROXY_PORT = Integer.parseInt(jira.getProperty("PROXY_PORT"));
    private static final HttpHost HTTP_HOST_PROXY = new HttpHost(PROXY_IP, PROXY_PORT);
    private static final Proxy PROXY = new Proxy(Proxy.Type.HTTP, new InetSocketAddress(PROXY_IP, PROXY_PORT));

    /**
     * JIRA credentials: format "username:password" or "" for none.
     */
    private static final String CREDENTIALS = jira.getProperty("USERNAME") + ":" + jira.getProperty("PASSWORD");

    // ================================================================================
    // Zapi methods
    // ================================================================================

    /**
     * Gets the versionID for the project.
     *
     * @param versionName
     * @param projectId
     * @return the ID for the specified Version in the specified Project
     * @throws IOException
     * @throws JSONException
     */
    public static String getVersionID(String versionName, String projectId)
            throws IOException, JSONException {
        // Get list of versions on the specified project
        JSONObject projectJsonObj = httpGetJSONObject(ZAPI_URL + "util/versionBoard-list?projectId=" + projectId);
        if (projectJsonObj == null) {
            throw new IllegalStateException("JSONObject is null for projectId=" + projectId);
        }
        //unreleasedVersions
        //versionOptions

        JSONArray versionOptions = (JSONArray) projectJsonObj.get("unreleasedVersions");

        // Iterate over versions
        for (int i = 0; i < versionOptions.length(); i++) {
            JSONObject obj2 = versionOptions.getJSONObject(i);
            // If label matches specified version name
            if (obj2.getString("label").equals(versionName)) {
                // Return the ID for this version
                return obj2.getString("value");
            }
        }

        throw new IllegalStateException("Version ID not found for versionName=" + versionName);

    }


    /**
     * Gets the excutionID for the project and checks if the issue is valid.
     *
     * @param issueKey    jiraTicket
     * @param cyclenameIn
     * @return the executionID for the specified cycle
     * @throws IOException
     * @throws JSONException
     */
    public static String getExecutionID(String issueKey,
                                        String cyclenameIn,
                                        String... version)
            throws IOException, JSONException {
        // Get list of versions on the specified project
        //zql/executeSearch?maxRecords=0&offset=0&zqlQuery=issue=%27UI-140%27
        //https://jira.movenetworks.com/rest/zapi/latest/zql/executeSearch?maxRecords=0&offset=0&zqlQuery=issue=%27UI-140%27
        JSONObject projectJsonObj = httpGetJSONObject(ZAPI_URL + "zql/executeSearch?maxRecords=0&offset=0&zqlQuery=issue='" + issueKey + "'");
        if (projectJsonObj == null) {
            throw new IllegalStateException("JSONObject is null for Jira ticket=" + issueKey);
        }

        JSONArray excutionOptions = (JSONArray) projectJsonObj.get("executions");

        // Iterate over versions
        for (int i = 0; i < excutionOptions.length(); i++) {
            JSONObject obj2 = excutionOptions.getJSONObject(i);
            // If label matches specified version name
            if (version.length == 0) {
                if (obj2.getString("cycleName").equals(cyclenameIn)) {
                    // Return the ID for this version
                    return Integer.toString(obj2.getInt("id"));
                }
            } else {
//            	System.out.println("Version name is: "+version[0]);
                if ((obj2.getString("cycleName").equals(cyclenameIn)) && (obj2.getString("versionName").equals(version[0]))) {
                    // Return the ID for this version
                    return Integer.toString(obj2.getInt("id"));
                }
            }
        }

        throw new IllegalStateException("Execution ID not found for jira ticket=" + issueKey);
    }

    /**
     * Updates the specified test execution
     *
     * @param jiraTicket the ticket number(eg. UI-123)
     * @param status     a Zapi.Status value
     * @param comment    a comment for the test execution
     * @throws IOException   put may throw IOException
     * @throws JSONException
     */
    public static JSONObject updateTestExecution(String jiraTicket,
                                                 String status,
                                                 String testCycle,
                                                 String comment,
                                                 String... versionName)
            throws IOException, JSONException {
        String executionId = getExecutionID(jiraTicket, testCycle, versionName);

        // Construct JSON object
        JSONObject obj = new JSONObject();
        obj.put("status", "-1");
        obj.put("comment", "");
        put(ZAPI_URL + "execution/" + executionId + "/execute", obj);
        obj.put("status", getScenarioStatus(status));
        obj.put("comment", comment);

        return put(ZAPI_URL + "execution/" + executionId + "/execute", obj);
    }

    public static void addAttachment(File fileToUpload,
                                     String jiraTicket,
                                     String testcycle,
                                     String... versionName)
            throws RuntimeException, IOException, JSONException {
        String executionId = getExecutionID(jiraTicket, testcycle, versionName);
        addAttachment(fileToUpload, executionId);

    }

    /**
     * Adds attachment to an execution.
     *
     * @param fileToUpload - the file to attach
     * @param executionId
     * @throws RuntimeException
     * @throws IOException
     */
    public static void addAttachment(File fileToUpload, String executionId)
            throws RuntimeException, IOException {
        // set up proxy for http client
        HttpClientBuilder clientBuilder = HttpClientBuilder.create();
        clientBuilder.useSystemProperties();
        if (USE_PROXY) {
            clientBuilder.setProxy(HTTP_HOST_PROXY);
        }
        CloseableHttpClient httpClient = clientBuilder.build();

        HttpPost httpPost = new HttpPost(ZAPI_URL + "attachment?entityId=" + executionId + "&entityType=EXECUTION");
        httpPost.setHeader("X-Atlassian-Token", "nocheck");

        if (!CREDENTIALS.isEmpty()) {
            String encoding = new Base64().encodeToString(CREDENTIALS.getBytes());
            httpPost.setHeader("Authorization", "Basic " + encoding);
        }

        MultipartEntityBuilder builder = MultipartEntityBuilder.create();
        builder.addBinaryBody("file", fileToUpload, ContentType.APPLICATION_OCTET_STREAM, fileToUpload.getName());
        HttpEntity multipart = builder.build();
        httpPost.setEntity(multipart);

        CloseableHttpResponse response = httpClient.execute(httpPost);
        HttpEntity responseEntity = response.getEntity();
        if (responseEntity != null) {
            EntityUtils.consume(responseEntity);
        }

        // ensure file was uploaded correctly
        if (response.getStatusLine().getStatusCode() != 200) {
            throw new RuntimeException("Error uploading file");
        }
    }

    /**
     * Deletes all of the attachments on the specified execution
     *
     * @param executionId the id of the execution
     * @throws IOException   delete may throw IOException
     * @throws JSONException
     */
    public static List<JSONObject> deleteAttachments(String executionId) throws IOException, JSONException {
        ArrayList<String> fileIds = new ArrayList<String>();
        // Note the IDs for the files currently attached to the execution
        JSONObject obj = httpGetJSONObject(ZAPI_URL + "attachment/attachmentsByEntity?entityId=" + executionId + "&entityType=EXECUTION");
        if (obj == null) {
            throw new IllegalStateException("Response is null");
        }

        JSONArray data = (JSONArray) obj.get("data");
        for (int i = 0; i < data.length(); i++) {
            JSONObject fileData = data.getJSONObject(i);
            fileIds.add(fileData.getString("fileId"));
        }

        // Iterate over attachments
        ArrayList<JSONObject> responses = new ArrayList<JSONObject>(data.length());
        for (String fileId : fileIds) {
            responses.add(delete(ZAPI_URL + "attachment/" + fileId));
        }
        return responses;
    }

    // ================================================================================
    // HTTP request methods
    // ================================================================================

    /**
     * Send GET request to the specified URL
     *
     * @param url
     * @throws IOException
     * @throws JSONException
     */
    private static JSONObject httpGetJSONObject(String url) throws IOException, JSONException {
        return new JSONObject(httpGetJSONString(url));
    }

    /**
     * Send GET request to the specified URL
     *
     * @param url
     * @throws IOException
     * @throws JSONException
     */
    private static JSONArray httpGetJSONArray(String url) throws IOException, JSONException {
        return new JSONArray(httpGetJSONString(url));
    }

    /**
     * Get a string from a url.
     *
     * @param url the URL to perform the GET method on
     * @return a String representing the body of the http response
     * @throws IOException
     */
    private static String httpGetJSONString(String url) throws IOException {
        HttpURLConnection httpCon = createHttpCon(url, "GET");
        InputStreamReader inputStreamReader = new InputStreamReader(httpCon.getInputStream());
        BufferedReader br = new BufferedReader(inputStreamReader);
        StringBuffer httpResponse = new StringBuffer();
        String line = "";
        while (null != (line = br.readLine())) {
            httpResponse.append(line);
        }

        return httpResponse.toString();
    }

    /**
     * Send a request with JSON content with the specified method
     *
     * @param url    - the URL to send the request to
     * @param obj    - the JSON content to send
     * @param method - e.g. PUT
     * @throws IOException
     * @throws JSONException
     */
    private static JSONObject sendRequest(String url, JSONObject obj,
                                          String method) throws IOException, JSONException {
        HttpURLConnection httpCon = createHttpCon(url, method);

        if (obj != null) {
            OutputStreamWriter out = new OutputStreamWriter(httpCon.getOutputStream());
            out.write(obj.toString());
            out.close();
        }
        InputStreamReader inputStreamReader = new InputStreamReader(httpCon.getInputStream());
        BufferedReader rd = new BufferedReader(inputStreamReader);
        StringBuffer result = new StringBuffer();
        String line = "";
        while (null != (line = rd.readLine())) {
            result.append(line);
        }
        return new JSONObject(result.toString());
    }

    /**
     * Send PUT request to the specified URL
     *
     * @param url - the URL to send the request to
     * @param obj - the JSON content to send
     * @throws IOException
     * @throws JSONException
     */
    private static JSONObject put(String url, JSONObject obj) throws IOException, JSONException {
        return sendRequest(url, obj, "PUT");
    }

    /**
     * Send POST request to the specified URL
     *
     * @param url - the URL to send the request to
     * @param obj - the JSON content to send
     * @throws IOException
     * @throws JSONException
     */
    private static JSONObject post(String url, JSONObject obj) throws IOException, JSONException {
        return sendRequest(url, obj, "POST");
    }

    /**
     * Send DELETE request to the specified URL
     *
     * @param url - the URL to send the request to
     * @throws IOException
     * @throws JSONException
     */
    private static JSONObject delete(String url) throws IOException, JSONException {
        return sendRequest(url, null, "DELETE");
    }

    /**
     * Return a HttpURLConnection object for the specified URL and request method
     *
     * @param url    the URL to connect to
     * @param method - e.g. GET
     */
    private static HttpURLConnection createHttpCon(String url, String method)
            throws IOException {
        HttpURLConnection httpCon;
        if (USE_PROXY) {
            httpCon = (HttpURLConnection) new URL(url).openConnection(PROXY);
        } else {
            httpCon = (HttpURLConnection) new URL(url).openConnection();
        }

        httpCon.setDoOutput(true);
        httpCon.setRequestMethod(method);

        if (!CREDENTIALS.isEmpty()) {
            String encoding = new Base64().encodeToString(CREDENTIALS.getBytes());
            httpCon.setRequestProperty("Authorization", "Basic " + encoding);
        }

        httpCon.setRequestProperty("Content-type", "application/json");

        return httpCon;
    }

    public static void main(String[] args) throws Throwable {
        //Zapi.getIssueID("UI-1039","Ad hoc");
        //Zapi zap=new Zapi();
        updateTestExecution("UI-550", "Pass", "Ad hoc", "Updated by Amy", "Unscheduled");
        //Zapi.getVersionID("Android 4.0.","11445");
    }


    public static void sendGet() throws Exception {

        String url = "http://www.google.com/search?q=sling";

        URL obj = new URL(url);
        HttpURLConnection con = (HttpURLConnection) obj.openConnection();

        // optional default is GET
        con.setRequestMethod("GET");

        //add request header
        //con.setRequestProperty("User-Agent", USER_AGENT);

        int responseCode = con.getResponseCode();
        System.out.println("\nSending 'GET' request to URL : " + url);
        System.out.println("Response Code : " + responseCode);

        BufferedReader in = new BufferedReader(
                new InputStreamReader(con.getInputStream()));
        String inputLine;
        StringBuffer response = new StringBuffer();

        while ((inputLine = in.readLine()) != null) {
            response.append(inputLine);
        }
        in.close();

        //print result
        System.out.println(response.toString());

    }

    // HTTP POST request
    // Ignore this
    private void sendPost() throws Exception {

        //String url = "https://selfsolve.apple.com/wcResults.do";
        // /services/rest/latest/cycle/
        // https://jira.movenetworks.com/rest/zapi/latest/cycle/
        String url =  "http://jira.movenetworks.com/rest/zapi/latest/cycle/";
        URL obj = new URL(url);
        HttpsURLConnection con = (HttpsURLConnection) obj.openConnection();

        //add reuqest header
        con.setRequestMethod("POST");
        con.setRequestProperty("User-Agent", USER_AGENT);
        con.setRequestProperty("Accept-Language", "en-US,en;q=0.5");

        //String urlParameters = "sn=C02G8416DRJM&cn=&locale=&caller=&num=12345";
        String urlParameters = "";

        // Send post request
        con.setDoOutput(true);
        DataOutputStream wr = new DataOutputStream(con.getOutputStream());
        wr.writeBytes(urlParameters);
        wr.flush();
        wr.close();

        int responseCode = con.getResponseCode();
        System.out.println("\nSending 'POST' request to URL : " + url);
        System.out.println("Post parameters : " + urlParameters);
        System.out.println("Response Code : " + responseCode);

        BufferedReader in = new BufferedReader(
                new InputStreamReader(con.getInputStream()));
        String inputLine;
        StringBuffer response = new StringBuffer();

        while ((inputLine = in.readLine()) != null) {
            response.append(inputLine);
        }
        in.close();

        //print result
        System.out.println(response.toString());

    }
}
